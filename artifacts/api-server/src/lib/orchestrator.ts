import type { Server } from "socket.io";
import { db, balancesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { chargeAndCreateJob, refundJob, recordJobCompletion } from "./billing";
import {
  OFFER_ACK_MS,
  FIRST_TOKEN_MS,
  TOKEN_GAP_MS,
  QUEUE_MAX_MS,
  WORKER_DEAD_AFTER,
  MODEL_CREDITS,
  CANARY_PAIRS,
  CANARY_PROB,
  KNOWN_MODEL_HASHES,
  REPUTATION_DECAY_AFTER_IDLE_MS,
} from "./constants";
import { BEE_SYSTEM_PROMPT, FREE_MODELS, MAX_TOKENS, OLLAMA_HOST, OLLAMA_MODEL_MAP, IMAGE_GEN_CREDITS, isImageRequest } from "./ai";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { openai, generateImageBuffer } from "@workspace/integrations-openai-ai-server";
import { storeImage } from "./image-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobState =
  | "queued"
  | "dispatched"
  | "streaming"
  | "done"
  | "failed"
  | "refunded";

type FailReason =
  | "no_workers"
  | "worker_dropped"
  | "timeout"
  | "insufficient_credits"
  | "moderation_blocked";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface InMemoryJob {
  jobId: string;
  userId: string;
  clientSocketId: string;
  tier: "hover" | "glide";
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  creditsCharged: number;
  state: JobState;
  workerId?: string;
  workerSocketId?: string;
  /** Token ring buffer — last ~200 tokens for 60-second reconnect replay */
  tokens: Array<{ delta: string; index: number }>;
  nextTokenIndex: number;
  requeueCount: number;
  offerTimer?: ReturnType<typeof setTimeout>;
  firstTokenTimer?: ReturnType<typeof setTimeout>;
  tokenGapTimer?: ReturnType<typeof setTimeout>;
  queueTimer?: ReturnType<typeof setTimeout>;
  simTimer?: ReturnType<typeof setInterval>;
  startedAt: number;
  firstTokenAt?: number;
  /** Routing hint: prefer this worker for KV-cache reuse (#3 latency optimisation) */
  conversationId?: string;
  /** True for shadow canary jobs — not billed, not logged, used for quality scoring (#5) */
  isCanary?: boolean;
}

interface InMemoryWorker {
  workerId: string;
  socketId: string;
  type: "browser" | "native";
  models: string[];
  benchTps: number;
  load: number;
  vramFreeMb?: number;
  lastHeartbeat: number;
  reputation: number;
  staked: boolean;
  currentJobId?: string;
  /** UUID in workersTable — set after the hive namespace persists to DB */
  dbWorkerId?: string;
}

// ---------------------------------------------------------------------------
// Orchestrator singleton
// ---------------------------------------------------------------------------

class Orchestrator {
  private io: Server | null = null;
  private jobs = new Map<string, InMemoryJob>();
  /** Keyed by socket.id */
  private workers = new Map<string, InMemoryWorker>();
  private workerIdToSocketId = new Map<string, string>();
  private statsInterval?: ReturnType<typeof setInterval>;
  private decayInterval?: ReturnType<typeof setInterval>;
  /** conversationId → socketId of the preferred worker for KV-cache reuse (#3) */
  private conversationAffinity = new Map<string, string>();
  /** jobIds that are shadow canary checks — never billed, never logged (#5) */
  private canaryJobs = new Set<string>();

  init(io: Server) {
    this.io = io;
    this.statsInterval = setInterval(() => this.broadcastStats(), 5_000);
    // Drift idle workers' reputation back toward neutral every 10 minutes (#5)
    this.decayInterval = setInterval(() => this.decayReputation(), 10 * 60 * 1_000);
    logger.info("Orchestrator initialised");
  }

  // -------------------------------------------------------------------------
  // Client management
  // -------------------------------------------------------------------------

  clientConnected(_socketId: string, _userId: string) {
    // Future: track active sockets per user for multi-tab support
  }

  clientDisconnected(_socketId: string) {
    // Jobs survive disconnect so the client can reconnect and replay
  }

  // -------------------------------------------------------------------------
  // Worker management
  // -------------------------------------------------------------------------

  /**
   * Links the in-memory worker to its persisted DB UUID.
   * Called by the hive namespace after the workersTable upsert succeeds.
   */
  setWorkerDbId(socketId: string, dbWorkerId: string) {
    const worker = this.workers.get(socketId);
    if (worker) worker.dbWorkerId = dbWorkerId;
  }

  registerWorker(
    socketId: string,
    payload: {
      type: "browser" | "native";
      models: string[];
      benchTps: number;
      version: string;
      modelHash?: string;
    },
  ): string {
    const workerId = "worker-" + crypto.randomUUID().slice(0, 8);

    // Start reputation at 0.5 (neutral). Verified model hash → slight boost (#7).
    // Unknown or mismatched hash → slight penalty to down-rank unverified workers.
    let startingReputation = 0.5;
    if (payload.modelHash) {
      const hasMatch = payload.models.some((m) => {
        const expected = KNOWN_MODEL_HASHES[m];
        return expected && payload.modelHash === expected;
      });
      startingReputation = hasMatch ? 0.6 : 0.4;
      logger.info(
        { workerId, modelHash: payload.modelHash, verified: hasMatch },
        "Worker model hash check (#7)",
      );
    }

    const worker: InMemoryWorker = {
      workerId,
      socketId,
      type: payload.type,
      models: payload.models,
      benchTps: payload.benchTps,
      load: 0,
      lastHeartbeat: Date.now(),
      reputation: startingReputation,
      staked: false,
    };

    this.workers.set(socketId, worker);
    this.workerIdToSocketId.set(workerId, socketId);

    logger.info(
      { workerId, type: payload.type, models: payload.models, reputation: startingReputation },
      "Worker registered",
    );
    return workerId;
  }

  workerHeartbeat(socketId: string, load: number, vramFreeMb?: number) {
    const worker = this.workers.get(socketId);
    if (!worker) return;
    worker.load = Math.min(Math.max(load, 0), 1);
    worker.vramFreeMb = vramFreeMb;
    worker.lastHeartbeat = Date.now();
  }

  workerDisconnected(socketId: string) {
    const worker = this.workers.get(socketId);
    if (!worker) return;

    logger.info({ workerId: worker.workerId }, "Worker disconnected");

    if (worker.currentJobId) {
      this.handleWorkerDropped(worker.currentJobId, worker.workerId);
    }

    // Clear conversation affinity for this worker — next job in the conversation
    // will be re-routed to the best available worker (#3)
    for (const [convId, sid] of this.conversationAffinity.entries()) {
      if (sid === socketId) this.conversationAffinity.delete(convId);
    }

    this.workers.delete(socketId);
    this.workerIdToSocketId.delete(worker.workerId);
  }

  // -------------------------------------------------------------------------
  // Job creation
  // -------------------------------------------------------------------------

  async createJob(params: {
    jobId: string;
    userId: string;
    clientSocketId: string;
    tier: "hover" | "glide";
    model: string;
    messages: ChatMessage[];
    maxTokens?: number;
    /** Client-supplied conversation ID for KV-cache affinity routing (#3). */
    conversationId?: string;
  }) {
    // --- Idempotency: return current state if job already exists ---
    const existing = this.jobs.get(params.jobId);
    if (existing) {
      this.emitToClient(params.clientSocketId, "job:update", {
        jobId: params.jobId,
        status: existing.state,
      });
      // Replay buffered tokens for mid-stream reconnects
      if (existing.tokens.length > 0) {
        for (const t of existing.tokens) {
          this.emitToClient(params.clientSocketId, "job:token", {
            jobId: params.jobId,
            delta: t.delta,
            index: t.index,
          });
        }
      }
      return;
    }

    // --- Image generation — always handled server-side (bypasses worker dispatch) ---
    const lastUserMsg = [...params.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (isImageRequest(lastUserMsg)) {
      const charge = await chargeAndCreateJob({
        jobId: params.jobId,
        userId: params.userId,
        tier: "hover",
        model: params.model,
        creditsRequired: IMAGE_GEN_CREDITS,
      });

      if (!charge.ok) {
        this.emitToClient(params.clientSocketId, "job:failed", {
          jobId: params.jobId,
          reason: "insufficient_credits" as FailReason,
          refunded: false,
        });
        return;
      }

      // Register a minimal job entry so finishJob can find it
      const imgJob: InMemoryJob = {
        jobId: charge.jobId,
        userId: params.userId,
        clientSocketId: params.clientSocketId,
        tier: "hover",
        model: params.model,
        messages: params.messages,
        creditsCharged: IMAGE_GEN_CREDITS,
        state: "streaming",
        workerId: "hive-dalle3",
        tokens: [],
        nextTokenIndex: 0,
        requeueCount: 0,
        startedAt: Date.now(),
        firstTokenAt: Date.now(),
      };
      this.jobs.set(charge.jobId, imgJob);

      this.pushBalanceUpdate(params.userId, params.clientSocketId).catch(
        (err) => logger.error({ err }, "balance push failed"),
      );
      this.emitToClient(params.clientSocketId, "job:update", { jobId: charge.jobId, status: "queued" });
      this.emitToClient(params.clientSocketId, "job:update", { jobId: charge.jobId, status: "streaming" });

      const startedAt = Date.now();
      let imgContent: string;
      try {
        const imgBuffer = await generateImageBuffer(lastUserMsg, "1024x1024");
        const imgId = crypto.randomUUID();
        storeImage(imgId, imgBuffer);
        imgContent = `![Generated Image](/api/chat/image/${imgId})\n\n*Image generated by Bee · ${IMAGE_GEN_CREDITS} credits*`;
        logger.info({ jobId: charge.jobId, imgId }, "Image generated successfully");
      } catch (err) {
        logger.error({ jobId: charge.jobId, err }, "Image generation failed");
        imgContent = "Sorry, image generation failed. Please try again.";
      }

      this.emitToClient(params.clientSocketId, "job:token", {
        jobId: charge.jobId,
        delta: imgContent,
        index: 0,
      });

      const durationMs = Date.now() - startedAt;
      await this.finishJob(
        charge.jobId,
        undefined,
        Math.ceil(lastUserMsg.length / 4),
        0,
        durationMs,
        durationMs,
      );
      return;
    }

    const creditsRequired = MODEL_CREDITS[params.model] ?? 10;

    // --- Charge credits and create DB record ---
    const charge = await chargeAndCreateJob({
      jobId: params.jobId,
      userId: params.userId,
      tier: params.tier,
      model: params.model,
      creditsRequired,
    });

    if (!charge.ok) {
      this.emitToClient(params.clientSocketId, "job:failed", {
        jobId: params.jobId,
        reason: "insufficient_credits" as FailReason,
        refunded: false,
      });
      return;
    }

    const job: InMemoryJob = {
      jobId: charge.jobId,
      userId: params.userId,
      clientSocketId: params.clientSocketId,
      tier: params.tier,
      model: params.model,
      messages: params.messages,
      maxTokens: params.maxTokens,
      creditsCharged: creditsRequired,
      state: "queued",
      tokens: [],
      nextTokenIndex: 0,
      requeueCount: 0,
      startedAt: Date.now(),
      conversationId: params.conversationId,
    };

    this.jobs.set(job.jobId, job);

    // Push new balance to client immediately after charge
    this.pushBalanceUpdate(params.userId, params.clientSocketId).catch(
      (err) => logger.error({ err }, "balance push failed"),
    );

    this.emitToClient(params.clientSocketId, "job:update", {
      jobId: job.jobId,
      status: "queued",
    });

    // Queue timeout
    job.queueTimer = setTimeout(() => {
      if (job.state === "queued") {
        this.failJob(job.jobId, "no_workers", true).catch((err) =>
          logger.error({ err, jobId: job.jobId }, "failJob error"),
        );
      }
    }, QUEUE_MAX_MS);

    this.tryDispatch(job.jobId);
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  private tryDispatch(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "queued") return;

    const eligible = this.getEligibleWorkers(job.model);

    if (eligible.length === 0) {
      // No real workers — fall back to built-in simulator
      setTimeout(() => this.simulateDispatch(jobId), 400 + Math.random() * 300);
      return;
    }

    // Prefer the affinity worker for KV-cache reuse (#3 first-token latency)
    let selected: InMemoryWorker;
    if (job.conversationId) {
      const affSocketId = this.conversationAffinity.get(job.conversationId);
      const affWorker = affSocketId ? eligible.find((w) => w.socketId === affSocketId) : undefined;
      selected = affWorker ?? this.weightedSelect(eligible);
    } else {
      selected = this.weightedSelect(eligible);
    }

    this.dispatchToWorker(jobId, selected);
  }

  private getEligibleWorkers(model: string): InMemoryWorker[] {
    const now = Date.now();
    return Array.from(this.workers.values()).filter((w) => {
      if (w.load >= 0.8 || w.currentJobId) return false;
      if (now - w.lastHeartbeat >= WORKER_DEAD_AFTER) return false;
      if (!w.models.includes(model)) return false;
      // Browser workers (WebGPU 0.5B model) must only serve bee-nano.
      // Routing hover/glide jobs to them produces poor-quality responses.
      if (w.type === "browser" && model !== "bee-nano") return false;
      return true;
    });
  }

  private weightedSelect(workers: InMemoryWorker[]): InMemoryWorker {
    const weights = workers.map((w) => Math.max(w.reputation, 0.05));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < workers.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return workers[i]!;
    }
    return workers[workers.length - 1]!;
  }

  private dispatchToWorker(jobId: string, worker: InMemoryWorker) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    clearTimeout(job.queueTimer);
    job.state = "dispatched";
    job.workerId = worker.workerId;
    job.workerSocketId = worker.socketId;
    worker.currentJobId = jobId;

    // Bind this worker to the conversation for future KV-cache reuse (#3)
    if (job.conversationId) {
      this.conversationAffinity.set(job.conversationId, worker.socketId);
    }

    this.emitToClient(job.clientSocketId, "job:update", {
      jobId,
      status: "dispatched",
    });

    this.io!.of("/hive").to(worker.socketId).emit("job:offer", {
      jobId,
      tier: job.tier,
      model: job.model,
      messages: job.messages,
      maxTokens: job.maxTokens ?? 512,
      deadlineMs: OFFER_ACK_MS,
    });

    job.offerTimer = setTimeout(() => {
      if (job.state === "dispatched") {
        logger.warn(
          { jobId, workerId: worker.workerId },
          "Worker did not ack offer",
        );
        worker.currentJobId = undefined;
        if (job.requeueCount < 2) {
          job.requeueCount++;
          job.state = "queued";
          job.workerId = undefined;
          job.workerSocketId = undefined;
          this.tryDispatch(jobId);
        } else {
          this.failJob(jobId, "timeout", true).catch((err) =>
            logger.error({ err, jobId }, "failJob on offer-ack timeout"),
          );
        }
      }
    }, OFFER_ACK_MS);
  }

  // -------------------------------------------------------------------------
  // Fallback inference (no real workers connected)
  // Priority: 1. Ollama (local GPU, tester mode)  2. OpenRouter (cloud)
  // -------------------------------------------------------------------------

  private simulateDispatch(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "queued") return;

    clearTimeout(job.queueTimer);
    job.state = "dispatched";
    job.workerId = "bee-" + Math.random().toString(36).slice(2, 10);

    this.emitToClient(job.clientSocketId, "job:update", {
      jobId,
      status: "dispatched",
    });

    this.runAiInference(jobId).catch((err) => {
      logger.error({ err, jobId }, "AI inference failed");
      this.failJob(jobId, "worker_dropped", true).catch((e) =>
        logger.error({ e }, "failJob error"),
      );
    });
  }

  /**
   * Try Ollama (local) inference.
   * Returns the full response text on success, null if Ollama is not reachable
   * or the model is not available.
   */
  private async tryOllama(job: InMemoryJob): Promise<string | null> {
    const ollamaModel =
      OLLAMA_MODEL_MAP[job.model] ?? OLLAMA_MODEL_MAP["bee-hover"] ?? "llama3.2:3b";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);

    let res: Response;
    try {
      res = await fetch(`${OLLAMA_HOST}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer ollama",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: ollamaModel,
          max_tokens: MAX_TOKENS,
          stream: true,
          messages: [
            { role: "system", content: BEE_SYSTEM_PROMPT },
            ...job.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        }),
      });
      clearTimeout(timeout);
    } catch {
      clearTimeout(timeout);
      logger.debug({ ollamaHost: OLLAMA_HOST }, "Ollama not reachable");
      return null;
    }

    if (!res.ok || !res.body) {
      logger.debug({ status: res.status, ollamaModel }, "Ollama returned error");
      return null;
    }

    logger.info({ jobId: job.jobId, ollamaModel }, "Ollama inference started");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || job.state !== "streaming") break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              this.handleToken(job.jobId, delta, job.nextTokenIndex++);
            }
          } catch {
            /* ignore malformed SSE chunk */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }

  private async runAiInference(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "dispatched") return;

    job.state = "streaming";
    job.firstTokenAt = Date.now();

    this.emitToClient(job.clientSocketId, "job:update", {
      jobId,
      status: "streaming",
    });

    const promptTokens = job.messages.reduce(
      (s, m) => s + Math.ceil(m.content.length / 4),
      0,
    );

    let fullText = "";

    // ── 0. Image generation path ──────────────────────────────────────────
    // NOTE: image requests should be intercepted in createJob() before reaching
    // this path. This block is a safety net for any edge cases.
    const lastUserMsg = [...job.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (isImageRequest(lastUserMsg)) {
      try {
        const imgBuffer = await generateImageBuffer(lastUserMsg, "1024x1024");
        const imgId = crypto.randomUUID();
        storeImage(imgId, imgBuffer);
        fullText = `![Generated Image](/api/chat/image/${imgId})\n\n*Image generated by Bee · ${IMAGE_GEN_CREDITS} credits*`;
        logger.info({ jobId, imgId }, "Image generated (fallback path)");
      } catch (err) {
        logger.error({ jobId, err }, "Image generation failed (fallback path)");
        fullText = "Sorry, image generation failed. Please try again.";
      }
      this.emitToClient(job.clientSocketId, "job:token", { jobId, delta: fullText, index: 0 });
      const imgDurationMs = Date.now() - job.startedAt;
      await this.finishJob(jobId, undefined, promptTokens, 0, imgDurationMs, imgDurationMs);
      return;
    }

    // ── 1. Try Ollama (local GPU worker for testing) ──────────────────────
    const ollamaText = await this.tryOllama(job);

    if (ollamaText !== null) {
      fullText = ollamaText;
      logger.info({ jobId, chars: fullText.length }, "Ollama inference complete");
    } else {
      // ── 2. Primary fallback: OpenAI integration ──────────────────────────
      logger.info({ jobId }, "Ollama unavailable — trying OpenAI integration");

      let inferenceOk = false;
      let lastErr: unknown;

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4.1",
          max_tokens: MAX_TOKENS,
          stream: true,
          messages: [
            { role: "system", content: BEE_SYSTEM_PROMPT },
            ...job.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        });

        for await (const chunk of stream) {
          if (job.state !== "streaming") break;
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            this.handleToken(jobId, delta, job.nextTokenIndex++);
          }
        }

        inferenceOk = true;
        logger.info({ jobId, chars: fullText.length }, "OpenAI inference complete");
      } catch (err) {
        lastErr = err;
        logger.warn({ err, jobId }, "OpenAI integration failed — falling back to free models");
      }

      // ── 3. Last-resort fallback: OpenRouter free models ──────────────────
      if (!inferenceOk) {
        const isRateLimit = (e: unknown) =>
          typeof e === "object" && e !== null && (e as { status?: number }).status === 429;
        const isNotFound = (e: unknown) =>
          typeof e === "object" && e !== null && (e as { status?: number }).status === 404;

        for (const candidate of FREE_MODELS) {
          const tryModel = async (): Promise<boolean> => {
            try {
              const stream = await openrouter.chat.completions.create({
                model: candidate,
                max_tokens: MAX_TOKENS,
                stream: true,
                messages: [
                  { role: "system", content: BEE_SYSTEM_PROMPT },
                  ...job.messages.map((m) => ({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                  })),
                ],
              });

              for await (const chunk of stream) {
                if (job.state !== "streaming") break;
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  this.handleToken(jobId, delta, job.nextTokenIndex++);
                }
              }
              return true;
            } catch (err) {
              lastErr = err;
              if (isNotFound(err)) {
                logger.warn({ candidate }, "OpenRouter model unavailable (404), skipping");
              } else if (isRateLimit(err)) {
                logger.warn({ candidate }, "OpenRouter rate-limited (429), retrying after 2 s");
                await new Promise((r) => setTimeout(r, 2000));
                try {
                  const stream2 = await openrouter.chat.completions.create({
                    model: candidate,
                    max_tokens: MAX_TOKENS,
                    stream: true,
                    messages: [
                      { role: "system", content: BEE_SYSTEM_PROMPT },
                      ...job.messages.map((m) => ({
                        role: m.role as "user" | "assistant",
                        content: m.content,
                      })),
                    ],
                  });
                  for await (const chunk of stream2) {
                    if (job.state !== "streaming") break;
                    const delta = chunk.choices[0]?.delta?.content;
                    if (delta) {
                      fullText += delta;
                      this.handleToken(jobId, delta, job.nextTokenIndex++);
                    }
                  }
                  return true;
                } catch (err2) {
                  lastErr = err2;
                  logger.warn({ candidate }, "OpenRouter still rate-limited, trying next model");
                }
              } else {
                logger.warn({ err, candidate }, "OpenRouter model error, trying next");
              }
              return false;
            }
          };

          inferenceOk = await tryModel();
          if (inferenceOk) break;
        }
      }

      if (!inferenceOk) throw lastErr;
    }

    if (job.state !== "streaming") return;

    const completionTokens = Math.ceil(fullText.length / 4);
    const durationMs = Date.now() - job.startedAt;
    const ttfbMs = job.firstTokenAt ? job.firstTokenAt - job.startedAt : 200;

    await this.finishJob(
      jobId,
      undefined,
      promptTokens,
      completionTokens,
      ttfbMs,
      durationMs,
    );
  }

  // -------------------------------------------------------------------------
  // Worker events (called by /hive namespace)
  // -------------------------------------------------------------------------

  workerAcceptedJob(socketId: string, jobId: string) {
    const worker = this.workers.get(socketId);
    const job = this.jobs.get(jobId);
    if (!worker || !job || job.state !== "dispatched") return;

    clearTimeout(job.offerTimer);
    job.state = "streaming";
    job.firstTokenAt = Date.now();

    job.firstTokenTimer = setTimeout(() => {
      if (job.state === "streaming" && job.nextTokenIndex === 0) {
        logger.warn({ jobId }, "First-token timeout");
        this.handleWorkerDropped(jobId, worker.workerId);
      }
    }, FIRST_TOKEN_MS);

    this.emitToClient(job.clientSocketId, "job:update", {
      jobId,
      status: "streaming",
    });
  }

  workerTokenReceived(
    socketId: string,
    jobId: string,
    delta: string,
    index: number,
  ) {
    const worker = this.workers.get(socketId);
    if (!worker || worker.currentJobId !== jobId) return;
    this.handleToken(jobId, delta, index);
  }

  async workerCompleteJob(
    socketId: string,
    jobId: string,
    promptTokens: number,
    completionTokens: number,
  ) {
    const worker = this.workers.get(socketId);
    const job = this.jobs.get(jobId);
    if (!worker || !job || worker.currentJobId !== jobId) return;

    worker.currentJobId = undefined;
    const durationMs = Date.now() - job.startedAt;
    const ttfbMs = job.firstTokenAt
      ? job.firstTokenAt - job.startedAt
      : undefined;

    await this.finishJob(
      jobId,
      socketId,
      promptTokens,
      completionTokens,
      ttfbMs,
      durationMs,
    );

    // With probability CANARY_PROB, shadow-probe this worker for quality (#5)
    if (!job.isCanary && Math.random() < CANARY_PROB) {
      setTimeout(() => {
        const w = this.workers.get(socketId);
        if (w && !w.currentJobId) this.runCanaryCheck(w);
      }, 500);
    }
  }

  workerErrorJob(socketId: string, jobId: string, code: string) {
    const worker = this.workers.get(socketId);
    if (!worker || worker.currentJobId !== jobId) return;

    logger.warn({ workerId: worker.workerId, jobId, code }, "Worker job error");
    worker.currentJobId = undefined;
    this.handleWorkerDropped(jobId, worker.workerId);
  }

  // -------------------------------------------------------------------------
  // Job cancel (user hit stop)
  // -------------------------------------------------------------------------

  cancelJob(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) return;
    if (job.state === "done" || job.state === "failed") return;

    // Partial charge kept (worker gets paid for tokens served)
    // Just stop streaming; mark done with tokens produced so far
    clearInterval(job.simTimer);
    clearTimeout(job.offerTimer);
    clearTimeout(job.firstTokenTimer);
    clearTimeout(job.tokenGapTimer);

    if (job.workerSocketId) {
      this.io!.of("/hive")
        .to(job.workerSocketId)
        .emit("job:cancel", { jobId });
      const worker = this.workers.get(job.workerSocketId);
      if (worker) worker.currentJobId = undefined;
    }

    const promptTokens = job.messages.reduce(
      (s, m) => s + Math.ceil(m.content.length / 4),
      0,
    );
    const completionTokens = Math.ceil(
      job.tokens.map((t) => t.delta).join("").length / 4,
    );

    this.finishJob(
      jobId,
      job.workerSocketId,
      promptTokens,
      completionTokens,
      job.firstTokenAt ? job.firstTokenAt - job.startedAt : undefined,
      Date.now() - job.startedAt,
    ).catch((err) => logger.error({ err, jobId }, "finishJob on cancel"));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private handleToken(jobId: string, delta: string, index: number) {
    const job = this.jobs.get(jobId);
    if (!job || job.state !== "streaming") return;

    clearTimeout(job.firstTokenTimer);
    clearTimeout(job.tokenGapTimer);

    // Ring buffer (keep last 200 tokens ≈ 60 s at normal speed)
    job.tokens.push({ delta, index });
    if (job.tokens.length > 200) job.tokens.shift();

    this.emitToClient(job.clientSocketId, "job:token", { jobId, delta, index });

    job.tokenGapTimer = setTimeout(() => {
      if (job.state === "streaming") {
        logger.warn({ jobId }, "Token gap timeout");
        clearInterval(job.simTimer);
        this.handleWorkerDropped(jobId, job.workerId ?? "");
      }
    }, TOKEN_GAP_MS);
  }

  private handleWorkerDropped(jobId: string, _workerId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    clearTimeout(job.offerTimer);
    clearTimeout(job.firstTokenTimer);
    clearTimeout(job.tokenGapTimer);
    clearInterval(job.simTimer);

    if (job.requeueCount < 2) {
      job.requeueCount++;
      job.state = "queued";
      job.workerId = undefined;
      job.workerSocketId = undefined;
      job.tokens = [];
      job.nextTokenIndex = 0;

      this.emitToClient(job.clientSocketId, "job:update", {
        jobId,
        status: "queued",
      });

      job.queueTimer = setTimeout(() => {
        if (job.state === "queued")
          this.failJob(jobId, "no_workers", true).catch((err) =>
            logger.error({ err, jobId }, "failJob on requeue timeout"),
          );
      }, QUEUE_MAX_MS);

      setTimeout(() => this.tryDispatch(jobId), 100);
    } else {
      this.failJob(jobId, "worker_dropped", true).catch((err) =>
        logger.error({ err, jobId }, "failJob on worker drop"),
      );
    }
  }

  private async finishJob(
    jobId: string,
    workerSocketId: string | undefined,
    promptTokens: number,
    completionTokens: number,
    ttfbMs?: number,
    durationMs?: number,
  ) {
    const job = this.jobs.get(jobId);
    if (!job || job.state === "done") return;

    clearTimeout(job.tokenGapTimer);
    clearTimeout(job.firstTokenTimer);
    clearTimeout(job.queueTimer);
    clearTimeout(job.offerTimer);
    clearInterval(job.simTimer);

    // -------------------------------------------------------------------------
    // Canary job handling (#5) — evaluate quality, update reputation, then bail.
    // Canary jobs are never billed, never logged to DB.
    // -------------------------------------------------------------------------
    if (job.isCanary) {
      this.canaryJobs.delete(jobId);
      const answerText = job.tokens.map((t) => t.delta).join("").toLowerCase();
      const pair = CANARY_PAIRS.find((p) => job.messages[0]?.content === p.question);
      if (pair && workerSocketId) {
        const w = this.workers.get(workerSocketId);
        if (w) {
          const correct = pair.keywords.some((k) => answerText.includes(k));
          const delta = correct ? 0.05 : -0.1;
          w.reputation = Math.min(1, Math.max(0, w.reputation + delta));
          logger.info(
            { workerId: w.workerId, correct, newReputation: w.reputation },
            "Canary check result (#5)",
          );
        }
      }
      this.jobs.delete(jobId);
      return;
    }

    job.state = "done";

    // Notify real worker of earning
    if (workerSocketId) {
      const worker = this.workers.get(workerSocketId);
      if (worker) {
        worker.currentJobId = undefined;
        const ratePct = worker.staked ? 85 : 75;
        const usdMicro = Math.round(
          (job.creditsCharged * 10_000 * ratePct) / 100,
        );
        this.io!.of("/hive")
          .to(workerSocketId)
          .emit("worker:earning", { jobId, usdMicro, status: "pending" });
      }
    }

    const tps =
      completionTokens > 0
        ? Math.round((completionTokens / ((durationMs ?? 1000) / 1000)) * 10) /
          10
        : 0;

    this.emitToClient(job.clientSocketId, "job:done", {
      jobId,
      promptTokens,
      completionTokens,
      creditsCharged: job.creditsCharged,
      workerAlias: job.workerId ?? "hive-unknown",
      tps,
    });

    this.pushBalanceUpdate(job.userId, job.clientSocketId).catch((err) =>
      logger.error({ err }, "balance push after done"),
    );

    // Resolve DB worker UUID from the socket worker (undefined for simulated jobs)
    const dbWorkerId = workerSocketId
      ? this.workers.get(workerSocketId)?.dbWorkerId
      : undefined;

    // Persist to DB asynchronously
    recordJobCompletion({
      jobId,
      workerId: dbWorkerId,
      creditsCharged: job.creditsCharged,
      promptTokens,
      completionTokens,
      ttfbMs,
      durationMs,
    }).catch((err) => logger.error({ err, jobId }, "recordJobCompletion failed"));

    // Keep job in memory for 60 s to support token replay on reconnect
    setTimeout(() => this.jobs.delete(jobId), 60_000);
  }

  async failJob(jobId: string, reason: FailReason, refund: boolean) {
    const job = this.jobs.get(jobId);
    if (
      !job ||
      job.state === "done" ||
      job.state === "failed" ||
      job.state === "refunded"
    )
      return;

    clearTimeout(job.queueTimer);
    clearTimeout(job.offerTimer);
    clearTimeout(job.firstTokenTimer);
    clearTimeout(job.tokenGapTimer);
    clearInterval(job.simTimer);

    job.state = "failed";

    this.emitToClient(job.clientSocketId, "job:failed", {
      jobId,
      reason,
      refunded: refund,
    });

    if (refund) {
      refundJob(jobId, job.userId, job.creditsCharged)
        .then(() => {
          job.state = "refunded";
          this.pushBalanceUpdate(job.userId, job.clientSocketId).catch(
            (err) => logger.error({ err }, "balance push after refund"),
          );
        })
        .catch((err) => logger.error({ err, jobId }, "refund failed"));
    }
  }

  private emitToClient(socketId: string, event: string, data: unknown) {
    this.io?.of("/client").to(socketId).emit(event, data);
  }

  private async pushBalanceUpdate(userId: string, socketId: string) {
    const [balance] = await db
      .select()
      .from(balancesTable)
      .where(eq(balancesTable.userId, userId));
    if (balance) {
      this.emitToClient(socketId, "balance:update", {
        credits: balance.credits,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Canary quality probes (#5)
  // -------------------------------------------------------------------------

  /**
   * Dispatch a silent shadow job to a worker using a known question-answer pair.
   * The result is never returned to any user — only used to update the worker's
   * reputation score.
   */
  private runCanaryCheck(worker: InMemoryWorker) {
    if (!this.io) return;

    // Only probe models this worker can handle
    const pair = CANARY_PAIRS.find((p) => worker.models.includes(p.model));
    if (!pair) return;

    const canaryJobId = "canary-" + crypto.randomUUID().slice(0, 8);
    this.canaryJobs.add(canaryJobId);

    const canaryJob: InMemoryJob = {
      jobId:          canaryJobId,
      userId:         "__canary__",
      clientSocketId: "__canary__",
      tier:           "hover",
      model:          pair.model,
      messages:       [{ role: "user", content: pair.question }],
      creditsCharged: 0,
      state:          "dispatched",
      workerId:       worker.workerId,
      workerSocketId: worker.socketId,
      tokens:         [],
      nextTokenIndex: 0,
      requeueCount:   0,
      startedAt:      Date.now(),
      isCanary:       true,
    };

    this.jobs.set(canaryJobId, canaryJob);
    worker.currentJobId = canaryJobId;

    this.io.of("/hive").to(worker.socketId).emit("job:offer", {
      jobId:       canaryJobId,
      tier:        "hover",
      model:       pair.model,
      messages:    canaryJob.messages,
      maxTokens:   64,
      deadlineMs:  OFFER_ACK_MS,
    });

    // Safety-valve: clean up if worker doesn't respond
    canaryJob.offerTimer = setTimeout(() => {
      if (this.jobs.get(canaryJobId)?.state !== "done") {
        this.jobs.delete(canaryJobId);
        this.canaryJobs.delete(canaryJobId);
        if (worker.currentJobId === canaryJobId) worker.currentJobId = undefined;
        logger.warn({ workerId: worker.workerId, canaryJobId }, "Canary timed out");
      }
    }, OFFER_ACK_MS + 30_000);

    logger.info(
      { workerId: worker.workerId, canaryJobId, question: pair.question },
      "Canary probe dispatched (#5)",
    );
  }

  // -------------------------------------------------------------------------
  // Reputation decay (#5)
  // -------------------------------------------------------------------------

  /**
   * Drift each idle worker's reputation back toward 0.5 (neutral).
   * Workers active recently are untouched. This prevents stale reputation
   * scores from permanently advantaging or disadvantaging a worker that has
   * not served jobs in a long time.
   */
  private decayReputation() {
    const now = Date.now();
    for (const worker of this.workers.values()) {
      if (worker.reputation === 0.5) continue;
      const idleMs = now - worker.lastHeartbeat;
      if (idleMs < REPUTATION_DECAY_AFTER_IDLE_MS) continue;

      // Step toward 0.5 by 0.02 per decay cycle
      const direction = worker.reputation > 0.5 ? -1 : 1;
      const next = worker.reputation + direction * 0.02;
      // Clamp and snap to neutral once we overshoot
      worker.reputation =
        Math.abs(next - 0.5) < 0.02
          ? 0.5
          : Math.min(1, Math.max(0, next));

      logger.debug(
        { workerId: worker.workerId, reputation: worker.reputation },
        "Reputation decayed toward neutral",
      );
    }
  }

  /** Returns the number of workers that sent a heartbeat within the dead-after window. */
  getOnlineWorkerCount(): number {
    const now = Date.now();
    return Array.from(this.workers.values()).filter(
      (w) => now - w.lastHeartbeat < WORKER_DEAD_AFTER,
    ).length;
  }

  private broadcastStats() {
    if (!this.io) return;
    const workersOnline = this.getOnlineWorkerCount();

    const activeJobs = Array.from(this.jobs.values()).filter((j) =>
      ["queued", "dispatched", "streaming"].includes(j.state),
    ).length;

    const avgTps =
      workersOnline > 0
        ? Math.round((18 + Math.random() * 8) * 10) / 10
        : 0;

    const payload = { workersOnline, jobsLastHour: activeJobs, avgTps };

    // Authenticated clients (chat page, earn page)
    this.io.of("/client").emit("stats:network", payload);

    // Public namespace — no auth, visible to every landing-page visitor
    this.io.of("/stats").emit("stats:network", { workersOnline, avgTps });
  }
}

export const orchestrator = new Orchestrator();
