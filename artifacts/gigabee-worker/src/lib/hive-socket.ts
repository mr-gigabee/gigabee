/**
 * Socket.io client for the /hive namespace.
 *
 * Handles:
 *   - Connection & reconnection with jittered exponential backoff
 *   - worker:register / worker:heartbeat
 *   - job:offer → Ollama inference → job:token stream → job:complete / job:error
 *   - Graceful shutdown (finish active job before disconnecting)
 */

import { io, type Socket } from "socket.io-client";
import { runInference, type OllamaMessage } from "./ollama.js";
import { logger } from "./logger.js";
import { amber, green, red, dim } from "./ansi.js";

const DEFAULT_HOST = process.env["GIGABEE_HOST"] ?? "https://gigabee.io";
const HEARTBEAT_INTERVAL_MS = 10_000;

export interface WorkerRegistration {
  type: "native";
  model: string;
  benchTps: number;
  version: string;
  token: string;
}

export interface HiveCallbacks {
  onRegistered: (workerId: string) => void;
  onEarning: (pendingUsd: number, availableUsd: number) => void;
  onJobStart: (jobId: string) => void;
  onJobToken: (tps: number) => void;
  onJobEnd: () => void;
  onStatusChange: (status: string) => void;
  onReputation: (score: number, uptimePct: number) => void;
}

interface JobOffer {
  jobId: string;
  model: string;
  messages: OllamaMessage[];
  maxTokens: number;
}

interface WorkerEarning {
  pendingUsdMicro: number;
  availableUsdMicro: number;
}

interface ReputationUpdate {
  score: number;
  uptimePct: number;
}

export class HiveClient {
  private socket: Socket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private activeJob: AbortController | null = null;
  private shuttingDown = false;
  private workerId: string | null = null;
  private registration: WorkerRegistration;
  private callbacks: HiveCallbacks;
  private jobsDone = 0;
  private jobsFailed = 0;
  private oomCount = 0;
  private lastOomMs = 0;

  constructor(reg: WorkerRegistration, cbs: HiveCallbacks) {
    this.registration = reg;
    this.callbacks = cbs;
  }

  connect(): void {
    const socket = io("/hive", {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { token: this.registration.token },
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      autoConnect: true,
      hostname: DEFAULT_HOST,
    } as Parameters<typeof io>[1]);

    socket.on("connect", () => {
      console.log(`\n  ${green("●")} Connected to Hive`);
      void logger.info("hive connected", { socketId: socket.id });
      this.callbacks.onStatusChange("idle");
      this.register(socket);
      this.startHeartbeat(socket);
    });

    socket.on("worker:registered", ({ workerId }: { workerId: string }) => {
      this.workerId = workerId;
      void logger.info("registered", { workerId });
      this.callbacks.onRegistered(workerId);
    });

    socket.on("job:offer", (payload: JobOffer) => {
      if (this.shuttingDown) return; // do not accept new jobs while draining
      void this.handleJobOffer(socket, payload);
    });

    socket.on("worker:earning", (payload: WorkerEarning) => {
      const pendingUsd = payload.pendingUsdMicro / 1_000_000;
      const availableUsd = payload.availableUsdMicro / 1_000_000;
      this.callbacks.onEarning(pendingUsd, availableUsd);
    });

    socket.on("worker:reputation", (payload: ReputationUpdate) => {
      this.callbacks.onReputation(payload.score, payload.uptimePct);
    });

    socket.on("disconnect", (reason) => {
      void logger.warn("hive disconnected", { reason });
      this.callbacks.onStatusChange("reconnecting...");
      this.stopHeartbeat();
    });

    socket.on("connect_error", (err) => {
      void logger.error("connect error", { msg: err.message });
    });

    this.socket = socket;
  }

  private register(socket: Socket): void {
    socket.emit("worker:register", {
      type: "native",
      models: [this.registration.model],
      benchTps: this.registration.benchTps,
      version: this.registration.version,
    });
  }

  private startHeartbeat(socket: Socket): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      socket.emit("worker:heartbeat", { load: 0, vramFreeMb: undefined });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handleJobOffer(socket: Socket, offer: JobOffer): Promise<void> {
    const { jobId, model, messages, maxTokens: _maxTokens } = offer;
    void logger.info("job offer accepted", { jobId, model });

    socket.emit("job:accept", { jobId });
    this.callbacks.onJobStart(jobId);

    const abortCtrl = new AbortController();
    this.activeJob = abortCtrl;

    let tokenIndex = 0;
    let lastTokenTime = Date.now();
    const tokenTimestamps: number[] = [];

    try {
      const result = await runInference(
        model,
        messages,
        (delta, index) => {
          socket.emit("job:token", { jobId, delta, index });
          tokenIndex = index + 1;
          const now = Date.now();
          tokenTimestamps.push(now);
          if (tokenTimestamps.length > 10) tokenTimestamps.shift();
          const windowMs = now - (tokenTimestamps[0] ?? now);
          const tps = windowMs > 0
            ? Math.round((tokenTimestamps.length / windowMs) * 1_000)
            : 0;
          this.callbacks.onJobToken(tps);
          lastTokenTime = now;
        },
        abortCtrl.signal,
      );

      socket.emit("job:complete", {
        jobId,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });

      this.jobsDone++;
      this.oomCount = 0;
      void logger.info("job complete", { jobId, tokens: result.completionTokens });
    } catch (err: unknown) {
      const isOom = err instanceof Error && err.message.toLowerCase().includes("oom");
      const code = isOom ? "oom" : "model_error";
      socket.emit("job:error", { jobId, code });
      this.jobsFailed++;
      void logger.error("job error", { jobId, code });

      if (isOom) {
        const now = Date.now();
        const twoMinMs = 2 * 60 * 1_000;
        if (this.oomCount >= 1 && now - this.lastOomMs < twoMinMs) {
          this.callbacks.onStatusChange("offline (OOM — run `gigabee-worker doctor`)");
          console.error(`\n  ${red("OOM twice in 2 min — going offline. Run: gigabee-worker doctor")}`);
          void logger.error("two OOMs in 2min — going offline");
          this.gracefulStop();
          return;
        }
        this.oomCount++;
        this.lastOomMs = now;
        console.warn(`\n  ${amber("OOM on job, restarting Ollama runner...")}`);
      }
    } finally {
      this.activeJob = null;
      if (!this.shuttingDown) {
        this.callbacks.onStatusChange("idle");
        this.callbacks.onJobEnd();
      }
    }

    // If shutdown was requested and no active job, disconnect now
    if (this.shuttingDown) {
      this.socket?.disconnect();
    }
  }

  /** Graceful: stop accepting new jobs, finish the current one, then disconnect. */
  gracefulStop(): void {
    this.shuttingDown = true;
    this.callbacks.onStatusChange("draining...");
    if (!this.activeJob) {
      this.stopHeartbeat();
      this.socket?.disconnect();
    }
    // Otherwise, handleJobOffer will disconnect after the job finishes
  }

  /** Force quit — the orchestrator will requeue the job. */
  forceStop(): void {
    this.activeJob?.abort();
    this.stopHeartbeat();
    this.socket?.disconnect();
  }

  getJobsDone(): number { return this.jobsDone; }
  getJobsFailed(): number { return this.jobsFailed; }

  isShuttingDown(): boolean { return this.shuttingDown; }

  printStatus(): void {
    console.log(
      `  ${dim("workerId")}   ${this.workerId ?? "not registered"}\n` +
      `  ${dim("jobs")}      ${this.jobsDone} done · ${this.jobsFailed} failed\n`,
    );
  }
}
