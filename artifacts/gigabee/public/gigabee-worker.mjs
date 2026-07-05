#!/usr/bin/env node
/**
 * Gigabee Native GPU Worker
 * ─────────────────────────
 * Connects your local Ollama instance to the Gigabee hive and earns Honey
 * (USDC) for every inference job you complete.
 *
 * Requirements:
 *   - Node.js 18 or newer
 *   - Ollama running locally (https://ollama.ai)
 *   - At least one model pulled: ollama pull llama3.3:70b
 *
 * Usage:
 *   node gigabee-worker.mjs
 *
 * Environment variables:
 *   GIGABEE_SERVER    Gigabee server URL   (default: https://gigabee.io)
 *   GIGABEE_TOKEN     Your Gigabee session token (required)
 *   OLLAMA_HOST       Ollama base URL      (default: http://localhost:11434)
 *   GIGABEE_MODELS    Comma-separated list of Gigabee model IDs to serve
 *                     (default: bee-glide)
 *                     Supported: bee-hover, bee-glide
 */

import { io } from "socket.io-client";

// ─── Config ──────────────────────────────────────────────────────────────────

const SERVER      = process.env.GIGABEE_SERVER ?? "https://gigabee.io";
const TOKEN       = process.env.GIGABEE_TOKEN  ?? "";
const OLLAMA_HOST = process.env.OLLAMA_HOST    ?? "http://localhost:11434";
const MODEL_IDS   = (process.env.GIGABEE_MODELS ?? "bee-glide").split(",").map(s => s.trim());

/** Maps Gigabee model IDs → local Ollama model names */
const MODEL_MAP = {
  "bee-hover": "llama3.2:3b",
  "bee-glide": "llama3.3:70b",
};

const VERSION = "1.0.0";
const HEARTBEAT_INTERVAL_MS = 10_000;

// ─── Validate ────────────────────────────────────────────────────────────────

if (!TOKEN) {
  console.error("[gigabee] ERROR: GIGABEE_TOKEN is required.");
  console.error("  Set it with:  export GIGABEE_TOKEN=<your-session-token>");
  console.error("  Get your token from: " + SERVER + "/earn");
  process.exit(1);
}

const supportedModels = MODEL_IDS.filter(id => MODEL_MAP[id]);
if (supportedModels.length === 0) {
  console.error("[gigabee] ERROR: No supported models. Use: bee-hover, bee-glide");
  process.exit(1);
}

// ─── Ollama helpers ──────────────────────────────────────────────────────────

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    const data = await res.json();
    const pulled = (data.models ?? []).map(m => m.name);
    return { ok: true, pulled };
  } catch {
    return { ok: false, pulled: [] };
  }
}

async function benchmarkModel(ollamaModel) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const start = Date.now();
    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel,
        prompt: "Hi",
        stream: false,
        options: { num_predict: 10 },
      }),
    });
    clearTimeout(timeout);
    const data = await res.json();
    const elapsed = (Date.now() - start) / 1000;
    const tokens = data.eval_count ?? 10;
    return Math.round(tokens / elapsed);
  } catch {
    return 5; // slow CPU fallback tps
  }
}

/**
 * Run inference on Ollama and stream tokens via callback.
 * @param {object} params
 * @param {string} params.model         - Ollama model name
 * @param {Array}  params.messages      - Chat messages [{role, content}]
 * @param {number} params.maxTokens     - Max tokens to generate
 * @param {function} params.onToken     - Called with each token delta string
 * @param {function} params.onAbort     - Returns true if job was cancelled
 * @returns {Promise<{promptTokens: number, completionTokens: number}>}
 */
async function runOllamaInference({ model, messages, maxTokens, onToken, onAbort }) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: { num_predict: maxTokens ?? 512 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let promptTokens = 0;
  let completionTokens = 0;
  let buffer = "";

  while (true) {
    if (onAbort()) break;

    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let chunk;
      try { chunk = JSON.parse(line); } catch { continue; }

      const delta = chunk.message?.content ?? "";
      if (delta) {
        completionTokens++;
        onToken(delta);
      }

      if (chunk.done) {
        promptTokens = chunk.prompt_eval_count ?? 0;
        completionTokens = chunk.eval_count ?? completionTokens;
      }
    }
  }

  return { promptTokens, completionTokens };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🐝 Gigabee Worker v${VERSION}`);
  console.log(`   Server : ${SERVER}`);
  console.log(`   Ollama : ${OLLAMA_HOST}`);
  console.log(`   Models : ${supportedModels.join(", ")}\n`);

  // Check Ollama
  const { ok: ollamaOk, pulled } = await checkOllama();
  if (!ollamaOk) {
    console.error("[gigabee] ERROR: Cannot reach Ollama at " + OLLAMA_HOST);
    console.error("  Start Ollama with:  ollama serve");
    process.exit(1);
  }
  console.log(`[gigabee] Ollama OK — ${pulled.length} model(s) available`);

  // Warn about missing models
  for (const id of supportedModels) {
    const ollamaModel = MODEL_MAP[id];
    const isPulled = pulled.some(n => n.startsWith(ollamaModel.split(":")[0]));
    if (!isPulled) {
      console.warn(`[gigabee] WARNING: ${ollamaModel} not found locally.`);
      console.warn(`  Pull it with:  ollama pull ${ollamaModel}`);
    }
  }

  // Benchmark
  const benchModel = MODEL_MAP[supportedModels[0]];
  console.log(`[gigabee] Benchmarking ${benchModel}…`);
  const benchTps = await benchmarkModel(benchModel);
  console.log(`[gigabee] Benchmark: ~${benchTps} tok/s\n`);

  // Connect Socket.io
  const socket = io(`${SERVER}/hive`, {
    path: "/api/socket.io",
    transports: ["websocket"],
    auth: { token: TOKEN },
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  let workerId = null;
  let currentJobId = null;
  let jobAborted = false;

  socket.on("connect", () => {
    console.log("[gigabee] Connected to hive — registering…");
    socket.emit("worker:register", {
      type: "native",
      models: supportedModels,
      benchTps,
      version: VERSION,
    });
  });

  socket.on("worker:registered", ({ workerId: id }) => {
    workerId = id;
    console.log(`[gigabee] Registered as ${workerId}`);
    console.log("[gigabee] Waiting for jobs…\n");

    // Heartbeat
    setInterval(() => {
      const load = currentJobId ? 1.0 : 0.0;
      socket.emit("worker:heartbeat", { load });
    }, HEARTBEAT_INTERVAL_MS);
  });

  socket.on("job:offer", async (payload) => {
    const { jobId, model, messages, maxTokens } = payload;

    if (currentJobId) {
      console.log(`[gigabee] Busy — rejecting job ${jobId}`);
      return; // orchestrator will reroute
    }

    const ollamaModel = MODEL_MAP[model];
    if (!ollamaModel) {
      console.log(`[gigabee] Unknown model ${model} — skipping`);
      socket.emit("job:error", { jobId, code: "model_error" });
      return;
    }

    currentJobId = jobId;
    jobAborted = false;
    socket.emit("job:accept", { jobId });

    console.log(`[job ${jobId.slice(0, 8)}] Accepted (${model} → ${ollamaModel})`);

    let tokenIndex = 0;
    const start = Date.now();

    try {
      const { promptTokens, completionTokens } = await runOllamaInference({
        model: ollamaModel,
        messages,
        maxTokens,
        onToken: (delta) => {
          socket.emit("job:token", { jobId, delta, index: tokenIndex++ });
        },
        onAbort: () => jobAborted,
      });

      if (!jobAborted) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const tps = Math.round(completionTokens / (Date.now() - start) * 1000);
        console.log(`[job ${jobId.slice(0, 8)}] Done — ${completionTokens} tokens, ~${tps} tok/s, ${elapsed}s`);
        socket.emit("job:complete", { jobId, promptTokens, completionTokens });
      }
    } catch (err) {
      console.error(`[job ${jobId.slice(0, 8)}] Error:`, err.message);
      socket.emit("job:error", { jobId, code: "model_error" });
    }

    currentJobId = null;
    jobAborted = false;
  });

  socket.on("job:cancel", ({ jobId }) => {
    if (currentJobId === jobId) {
      console.log(`[job ${jobId.slice(0, 8)}] Cancelled by orchestrator`);
      jobAborted = true;
    }
  });

  socket.on("worker:earning", ({ jobId, usdMicro }) => {
    const usd = (usdMicro / 1_000_000).toFixed(4);
    console.log(`[job ${jobId.slice(0, 8)}] Earned $${usd} Honey (pending 24h)`);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[gigabee] Disconnected: ${reason} — reconnecting…`);
    currentJobId = null;
    jobAborted = false;
  });

  socket.on("connect_error", (err) => {
    console.error("[gigabee] Connection error:", err.message);
  });

  socket.on("error:auth", ({ message }) => {
    console.error("[gigabee] Auth error:", message);
    console.error("  Check your GIGABEE_TOKEN is valid.");
    process.exit(1);
  });

  process.on("SIGINT", () => {
    console.log("\n[gigabee] Shutting down…");
    socket.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[gigabee] Fatal error:", err);
  process.exit(1);
});
