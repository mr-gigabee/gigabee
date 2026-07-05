/**
 * `gigabee-worker start` — the main command.
 *
 * First-run flow:
 *   1. Hardware check (≥20 GB VRAM)
 *   2. Ollama check / install
 *   3. Account link (if no credentials)
 *   4. Model pull (if not present)
 *   5. Benchmark (seeds initial reputation TPS)
 *   6. Go online → steady-state live UI
 */

import { amber, green, red, dim } from "../lib/ansi.js";
import { loadCredentials, saveCredentials } from "../lib/credentials.js";
import { detectGpu, vramGb, MIN_VRAM_GB } from "../lib/hardware.js";
import {
  isOllamaRunning,
  installOllama,
  pullModel,
  ensureOllamaServe,
} from "../lib/ollama.js";
import { runBenchmark } from "../lib/benchmark.js";
import { requestLinkCode, pollLinkStatus } from "../lib/api.js";
import { HiveClient } from "../lib/hive-socket.js";
import { renderUi, type UiState } from "../lib/terminal-ui.js";
import { logger } from "../lib/logger.js";
import { createInterface } from "node:readline";

const VERSION = "0.1.0";

export interface StartOptions {
  model: string;
  maxLoad: number;
  hours?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

// ── Step 1: Hardware check ─────────────────────────────────────────────────

async function checkHardware(): Promise<void> {
  process.stdout.write("  Checking GPU...");
  const gpu = await detectGpu();

  if (!gpu) {
    process.stdout.write("\n");
    console.error(
      `\n  ${red("No supported GPU found.")}\n` +
      `  You can still earn in your browser: ${amber("gigabee.io/earn")}\n`,
    );
    process.exit(2);
  }

  const gb = vramGb(gpu);
  if (gb < MIN_VRAM_GB) {
    process.stdout.write("\n");
    console.error(
      `\n  ${red(`This machine has ${gb.toFixed(0)} GB VRAM. Bee Glide needs ${MIN_VRAM_GB} GB+.`)}\n` +
      `  You can still earn in your browser: ${amber("gigabee.io/earn")}\n`,
    );
    process.exit(1);
  }

  console.log(` ${green("✓")} ${gpu.name} (${gb.toFixed(0)} GB VRAM)`);
}

// ── Step 2: Ollama check ───────────────────────────────────────────────────

async function checkOllama(): Promise<void> {
  process.stdout.write("  Checking Ollama...");
  const running = await isOllamaRunning();

  if (running) {
    console.log(` ${green("✓")} Ollama running`);
    return;
  }

  // Not running — try to start it if installed, else offer to install
  try {
    process.stdout.write("\n  Ollama not running, starting...");
    await ensureOllamaServe();
    console.log(` ${green("✓")}`);
    return;
  } catch {
    process.stdout.write("\n");
  }

  const ans = await ask(`  ${amber("Ollama not found.")} Install it now? (Y/n) `);
  if (ans.toLowerCase() === "n") {
    console.log(`  Install manually: ${dim("https://ollama.com")}`);
    process.exit(1);
  }

  const ok = await installOllama();
  if (!ok) {
    console.error(`  ${red("Ollama install failed.")} Install manually: https://ollama.com`);
    process.exit(1);
  }

  await ensureOllamaServe();
  console.log(`  ${green("✓")} Ollama ready`);
}

// ── Step 3: Account link ───────────────────────────────────────────────────

async function ensureLinked(): Promise<string> {
  const creds = await loadCredentials();
  if (creds?.token) return creds.token;

  console.log(`\n  ${dim("No account linked yet.")}`);

  let resp;
  try {
    resp = await requestLinkCode();
  } catch {
    // Offline or server unreachable — let user provide a token manually
    const token = await ask("  Paste your worker token: ");
    await saveCredentials({ token, accountId: "unknown", createdAt: new Date().toISOString() });
    return token;
  }

  console.log(`\n  Visit ${amber("gigabee.io/link")} and enter this code: ${amber(resp.code)}\n`);
  console.log(`  Waiting... (expires at ${resp.expiresAt})`);

  const POLL_INTERVAL_MS = 3_000;
  const expires = new Date(resp.expiresAt).getTime();

  while (Date.now() < expires) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const status = await pollLinkStatus(resp.code);
      if (status.status === "claimed" && status.token) {
        await saveCredentials({
          token: status.token,
          accountId: status.accountId ?? "unknown",
          createdAt: new Date().toISOString(),
        });
        console.log(`  ${green("✓")} Account linked`);
        return status.token;
      }
      process.stdout.write(".");
    } catch {
      // transient error; keep polling
    }
  }

  console.error(`\n  ${red("Link code expired.")} Run again to get a new code.`);
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function runStart(opts: StartOptions): Promise<void> {
  console.log(`\n  ${amber("Gigabee worker")} ${dim("v" + VERSION)} starting...\n`);

  await checkHardware();
  await checkOllama();
  const token = await ensureLinked();

  await pullModel(opts.model);
  const benchTps = await runBenchmark(opts.model);

  await logger.info("worker starting", { model: opts.model, benchTps });

  // ── Steady-state UI state ─────────────────────────────────────────────

  const uiState: UiState = {
    model: opts.model,
    status: "idle",
    jobsDone: 0,
    jobsFailed: 0,
    pendingUsd: 0,
    availableUsd: 0,
    reputation: 0,
    uptimePct: 100,
    uptimeMs: 0,
  };

  const startMs = Date.now();
  let honeyFlashTimer: ReturnType<typeof setTimeout> | null = null;

  function redraw() {
    uiState.uptimeMs = Date.now() - startMs;
    renderUi(uiState);
  }

  // Tick every second to update uptime
  const ticker = setInterval(redraw, 1_000);

  // ── Hive client ───────────────────────────────────────────────────────

  const hive = new HiveClient(
    { type: "native", model: opts.model, benchTps, version: VERSION, token },
    {
      onRegistered: (workerId) => {
        uiState.status = "idle";
        void logger.info("registered", { workerId });
      },
      onEarning: (pendingUsd, availableUsd) => {
        uiState.pendingUsd = pendingUsd;
        uiState.availableUsd = availableUsd;
        uiState.honeyFlash = true;
        if (honeyFlashTimer) clearTimeout(honeyFlashTimer);
        honeyFlashTimer = setTimeout(() => { uiState.honeyFlash = false; }, 1_500);
      },
      onJobStart: (_jobId) => { uiState.status = "serving job"; },
      onJobToken: (tps) => { uiState.currentTps = tps; },
      onJobEnd: () => { uiState.currentTps = undefined; uiState.jobsDone = hive.getJobsDone(); },
      onStatusChange: (status) => { uiState.status = status; },
      onReputation: (score, uptimePct) => {
        uiState.reputation = score;
        uiState.uptimePct = uptimePct;
      },
    },
  );

  // ── Ctrl+C handling ───────────────────────────────────────────────────

  let sigintCount = 0;

  process.on("SIGINT", () => {
    sigintCount++;
    if (sigintCount === 1) {
      clearInterval(ticker);
      console.log(`\n\n  ${amber("Stopping after current job...")}`);
      hive.gracefulStop();
      // Give it up to 60s to finish the current job
      setTimeout(() => {
        console.log("\n  Timed out waiting for job — force quitting.");
        hive.forceStop();
        process.exit(0);
      }, 60_000).unref();
    } else {
      console.log("\n  Force quit.");
      hive.forceStop();
      process.exit(0);
    }
  });

  process.stdout.write("\n");
  hive.connect();
}
