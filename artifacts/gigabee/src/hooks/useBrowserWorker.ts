import { useState, useRef, useCallback, useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getSessionToken } from "@/lib/socket";

export type BrowserWorkerStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "benchmarking"
  | "ready"
  | "processing"
  | "reconnecting"
  | "error";

// 0.5B quantised model — suitable for Bee Nano (fast, lightweight) only.
// bee-hover and bee-glide require native Ollama workers with 8B+ models.
const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const HIVE_MODELS = ["bee-nano"];
// Must be well under WORKER_DEAD_AFTER (25 000 ms) on the server
const HEARTBEAT_MS = 10_000;

// Short system prompt injected into every browser-worker inference call
const BEE_SYSTEM_PROMPT =
  "You are Bee — the AI assistant of Gigabee, a decentralized AI network. " +
  "Be concise, accurate, and helpful. You are running directly in the user's browser via WebGPU.";

/** Warm up the engine then measure actual tokens/sec over a short run. */
async function measureBenchTps(engine: { chat: { completions: { create: (opts: unknown) => Promise<AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>> } } }): Promise<number> {
  const BENCH_PROMPT = [
    { role: "system", content: BEE_SYSTEM_PROMPT },
    { role: "user", content: "Say 'benchmark ready' and nothing else." },
  ];
  // Warm-up pass (loads model weights into GPU cache, result discarded)
  await engine.chat.completions.create({ messages: BENCH_PROMPT, max_tokens: 16, stream: false });
  // Timed pass
  const start = performance.now();
  let tokens = 0;
  const stream = await engine.chat.completions.create({ messages: BENCH_PROMPT, max_tokens: 48, stream: true });
  for await (const chunk of stream as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>) {
    if (chunk.choices?.[0]?.delta?.content) tokens++;
  }
  const elapsed = (performance.now() - start) / 1000;
  return elapsed > 0 ? Math.round(tokens / elapsed) : 8;
}

export interface BrowserWorkerState {
  status: BrowserWorkerStatus;
  progress: number;
  jobsServed: number;
  tokensGenerated: number;
  currentJobTokens: number;
  /** Tokens per second during the active job; 0 when idle. */
  currentTps: number;
  honeyEarned: number;
  errorMessage: string | null;
  gpuSupported: boolean | null;
  start: () => void;
  stop: () => void;
}

export function useBrowserWorker(): BrowserWorkerState {
  const [status, setStatus] = useState<BrowserWorkerStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [jobsServed, setJobsServed] = useState(0);
  const [tokensGenerated, setTokensGenerated] = useState(0);
  const [currentJobTokens, setCurrentJobTokens] = useState(0);
  const [currentTps, setCurrentTps] = useState(0);
  const [honeyEarned, setHoneyEarned] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gpuSupported, setGpuSupported] = useState<boolean | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const currentJobIdRef = useRef<string | null>(null);
  const jobStartRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Check WebGPU support once on mount
  useEffect(() => {
    setGpuSupported(!!(navigator as Navigator & { gpu?: unknown }).gpu);
  }, []);

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    // Terminate the Web Worker thread
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    engineRef.current = null;
    processingRef.current = false;
    currentJobIdRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setCurrentJobTokens(0);
    setCurrentTps(0);
  }, [cleanup]);

  const start = useCallback(async () => {
    setStatus("checking");
    setErrorMessage(null);

    if (!(navigator as Navigator & { gpu?: unknown }).gpu) {
      setGpuSupported(false);
      setStatus("error");
      setErrorMessage("WebGPU not supported. Use Chrome 113+ with WebGPU enabled.");
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setStatus("error");
      setErrorMessage("Not logged in. Connect your wallet first.");
      return;
    }

    try {
      setStatus("downloading");
      setProgress(0);

      // Watchdog: if no progress event arrives within 90 s, surface an error (#11)
      watchdogRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus("error");
        setErrorMessage("Model download timed out. Check your network connection and try again.");
        cleanup();
      }, 90_000);

      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");

      const worker = new Worker(
        new URL("../workers/browser-inference.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      const engine = await CreateWebWorkerMLCEngine(worker, MODEL_ID, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          if (!mountedRef.current) return;
          const pct = Math.round(report.progress * 100);
          setProgress(pct);
          const txt = (report.text ?? "").toLowerCase();
          if (pct >= 98 || txt.includes("finish") || (txt.includes("loading") && !txt.includes("fetch"))) {
            setStatus("loading");
          } else {
            setStatus("downloading");
          }
        },
      });

      if (!mountedRef.current) {
        worker.terminate();
        workerRef.current = null;
        return;
      }

      // Model fully loaded — clear the download watchdog
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }

      engineRef.current = engine;

      // Measure real GPU throughput before advertising capability to the hive.
      // Uses "benchmarking" status so the earn page can show a distinct message (#10).
      setStatus("benchmarking");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const measuredTps = await measureBenchTps(engine as any);
      if (!mountedRef.current) { worker.terminate(); return; }

      setStatus("ready");

      const socket = io("/hive", {
        path: "/api/socket.io",
        auth: { token },
        reconnection: true,
        reconnectionDelay: 2_000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        // Re-register on every connect (initial + reconnects) with real measured TPS
        if (mountedRef.current) setStatus((s) => (s === "reconnecting" ? "ready" : s));
        socket.emit("worker:register", {
          type: "browser",
          models: HIVE_MODELS,
          benchTps: measuredTps,
          version: "1.0.0",
        });
      });

      socket.on("disconnect", () => {
        // Stop in-flight job cleanly
        if (processingRef.current) {
          engineRef.current?.interruptGenerate?.();
          processingRef.current = false;
          currentJobIdRef.current = null;
        }
        // Pause heartbeat; socket.io will reconnect automatically
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (mountedRef.current) setStatus("reconnecting");
      });

      socket.on("connect_error", () => {
        if (mountedRef.current) setStatus("reconnecting");
      });

      socket.on("worker:registered", () => {
        // Clear any pre-existing heartbeat before starting a new one
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        heartbeatRef.current = setInterval(() => {
          socket.emit("worker:heartbeat", { load: processingRef.current ? 1 : 0 });
        }, HEARTBEAT_MS);
        if (mountedRef.current) setStatus("ready");
      });

      socket.on(
        "job:offer",
        async (payload: {
          jobId: string;
          model: string;
          messages: Array<{ role: string; content: string }>;
          maxTokens?: number;
        }) => {
          if (processingRef.current) return;
          processingRef.current = true;
          currentJobIdRef.current = payload.jobId;
          if (mountedRef.current) {
            setStatus("processing");
            setCurrentJobTokens(0);
          }
          socket.emit("job:accept", { jobId: payload.jobId });

          let tokenIndex = 0;
          let promptTokens = 0;
          let completionTokens = 0;
          jobStartRef.current = performance.now();

          try {
            // Prepend Bee system prompt if the messages don't already have one
            const hasSystem = payload.messages[0]?.role === "system";
            const messages = hasSystem
              ? payload.messages
              : [{ role: "system", content: BEE_SYSTEM_PROMPT }, ...payload.messages];

            const stream = await engineRef.current.chat.completions.create({
              messages,
              stream: true,
              max_tokens: payload.maxTokens ?? 512,
              stream_options: { include_usage: true },
            });

            for await (const chunk of stream) {
              const delta = chunk.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                if (mountedRef.current) {
                  setTokensGenerated((t) => t + 1);
                  setCurrentJobTokens((t) => t + 1);
                  // Update live TPS every 5 tokens to avoid excessive re-renders (#10)
                  if (tokenIndex > 0 && tokenIndex % 5 === 0) {
                    const elapsed = (performance.now() - jobStartRef.current) / 1000;
                    setCurrentTps(elapsed > 0 ? Math.round(tokenIndex / elapsed) : 0);
                  }
                }
                socket.emit("job:token", {
                  jobId: payload.jobId,
                  delta,
                  index: tokenIndex++,
                });
              }
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens ?? 0;
                completionTokens = chunk.usage.completion_tokens ?? 0;
              }
            }

            socket.emit("job:complete", {
              jobId: payload.jobId,
              promptTokens,
              completionTokens: completionTokens || tokenIndex,
            });
            if (mountedRef.current) setJobsServed((j) => j + 1);
          } catch {
            socket.emit("job:error", { jobId: payload.jobId, code: "model_error" });
          }

          processingRef.current = false;
          currentJobIdRef.current = null;
          if (mountedRef.current) {
            setStatus("ready");
            setCurrentJobTokens(0);
            setCurrentTps(0);
          }
        },
      );

      socket.on("job:cancel", ({ jobId }: { jobId: string }) => {
        if (jobId !== currentJobIdRef.current) return;
        engineRef.current?.interruptGenerate?.();
        processingRef.current = false;
        currentJobIdRef.current = null;
        if (mountedRef.current) {
          setStatus("ready");
          setCurrentJobTokens(0);
        }
      });

      socket.on("worker:earning", ({ usdMicro }: { usdMicro: number }) => {
        if (mountedRef.current) setHoneyEarned((h) => h + usdMicro / 1_000_000);
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to initialize browser worker",
      );
      cleanup();
    }
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    progress,
    jobsServed,
    tokensGenerated,
    currentJobTokens,
    currentTps,
    honeyEarned,
    errorMessage,
    gpuSupported,
    start,
    stop,
  };
}
