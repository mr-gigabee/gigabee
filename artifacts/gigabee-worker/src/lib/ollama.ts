import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { logger } from "./logger.js";
import { amber, green, dim } from "./ansi.js";

const execAsync = promisify(exec);

const OLLAMA_BASE = "http://localhost:11434";

// ── Version check ──────────────────────────────────────────────────────────

export async function getOllamaVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/version`);
    if (!res.ok) return null;
    const body = await res.json() as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  return (await getOllamaVersion()) !== null;
}

// ── Install ────────────────────────────────────────────────────────────────

export async function installOllama(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(dim("  Running official Ollama installer..."));
    const child = spawn("sh", ["-c", "curl -fsSL https://ollama.ai/install.sh | sh"], {
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => resolve(code === 0));
  });
}

// ── Model pull ─────────────────────────────────────────────────────────────

export async function pullModel(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n  Pulling ${amber(model)}...`);
    const child = spawn("ollama", ["pull", model], { stdio: ["ignore", "pipe", "inherit"] });

    let lastPct = -1;
    const rl = createInterface({ input: child.stdout! });

    rl.on("line", (line) => {
      try {
        const row = JSON.parse(line) as {
          status?: string;
          completed?: number;
          total?: number;
        };
        if (row.total && row.completed) {
          const pct = Math.floor((row.completed / row.total) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            process.stdout.write(`\r  ${dim(row.status ?? "downloading")} ${amber(pct + "%")}   `);
          }
        } else if (row.status) {
          process.stdout.write(`\r  ${dim(row.status)}                    `);
        }
      } catch { /* non-JSON line */ }
    });

    child.on("close", (code) => {
      process.stdout.write("\n");
      if (code === 0) {
        console.log(`  ${green("✓")} ${model} ready`);
        resolve();
      } else {
        reject(new Error(`ollama pull exited with code ${code}`));
      }
    });
  });
}

// ── Inference (streaming) ──────────────────────────────────────────────────

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InferenceResult {
  promptTokens: number;
  completionTokens: number;
}

export async function runInference(
  model: string,
  messages: OllamaMessage[],
  onToken: (delta: string, index: number) => void,
  signal?: AbortSignal,
): Promise<InferenceResult> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let tokenIndex = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as {
          message?: { content?: string };
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        if (chunk.message?.content) {
          onToken(chunk.message.content, tokenIndex++);
        }
        if (chunk.done) {
          promptTokens = chunk.prompt_eval_count ?? 0;
          completionTokens = chunk.eval_count ?? tokenIndex;
        }
      } catch {
        // partial JSON line; ignore
      }
    }
  }

  await logger.info("inference complete", { promptTokens, completionTokens });
  return { promptTokens, completionTokens };
}

// ── Healthcheck after start ────────────────────────────────────────────────

export async function waitForOllama(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isOllamaRunning()) return true;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  return false;
}

// ── Ensure ollama serve is running ─────────────────────────────────────────

export async function ensureOllamaServe(): Promise<void> {
  if (await isOllamaRunning()) return;
  try {
    await execAsync("which ollama");
  } catch {
    throw new Error("Ollama is not installed");
  }
  // Start in background
  spawn("ollama", ["serve"], { detached: true, stdio: "ignore" }).unref();
  const started = await waitForOllama();
  if (!started) throw new Error("Ollama failed to start within 30s");
}
