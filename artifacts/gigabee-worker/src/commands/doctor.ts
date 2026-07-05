/**
 * `gigabee-worker doctor` — full diagnostics.
 * Prints a copy-pasteable block for support requests.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { detectGpu, vramGb } from "../lib/hardware.js";
import { getOllamaVersion, isOllamaRunning } from "../lib/ollama.js";
import { loadCredentials, logFilePath } from "../lib/credentials.js";
import { amber, green, red, dim } from "../lib/ansi.js";

const execAsync = promisify(exec);

async function nodeVersion(): Promise<string> {
  return process.version;
}

async function osInfo(): Promise<string> {
  try {
    const { stdout } = await execAsync("uname -a");
    return stdout.trim();
  } catch {
    return process.platform;
  }
}

async function pingOrchestrator(): Promise<string> {
  const base = process.env["GIGABEE_API_URL"] ?? "https://gigabee.io/api";
  const start = Date.now();
  try {
    const res = await fetch(`${base}/stats`, { signal: AbortSignal.timeout(5_000) });
    const ms = Date.now() - start;
    return res.ok ? `${ms}ms` : `HTTP ${res.status}`;
  } catch (err: unknown) {
    return err instanceof Error ? err.message : "unreachable";
  }
}

async function lastLogLines(n: number): Promise<string[]> {
  try {
    const raw = await readFile(logFilePath(), "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.slice(-n);
  } catch {
    return ["(no log file)"];
  }
}

export async function runDoctor(): Promise<void> {
  console.log(`\n  ${amber("Gigabee worker doctor")}\n  ${"─".repeat(44)}`);

  const [gpu, ollamaVer, ollamaRunning, creds, os, orchestratorLatency, lastErrors] =
    await Promise.all([
      detectGpu(),
      getOllamaVersion(),
      isOllamaRunning(),
      loadCredentials(),
      osInfo(),
      pingOrchestrator(),
      lastLogLines(5),
    ]);

  const gpuLine = gpu
    ? `${green("✓")} ${gpu.name} (${vramGb(gpu).toFixed(0)} GB VRAM)`
    : `${red("✗")} No supported GPU detected`;

  const ollamaLine = ollamaRunning
    ? `${green("✓")} running (v${ollamaVer ?? "?"})`
    : ollamaVer
    ? `${amber("!")} installed (v${ollamaVer}) but not running`
    : `${red("✗")} not found`;

  const linkedLine = creds
    ? `${green("✓")} linked (accountId: ${creds.accountId})`
    : `${red("✗")} not linked`;

  const rows = [
    ["node",         await nodeVersion()],
    ["os",           os],
    ["gpu",          gpuLine],
    ["ollama",       ollamaLine],
    ["account",      linkedLine],
    ["orchestrator", orchestratorLatency],
  ] as const;

  for (const [key, val] of rows) {
    console.log(`  ${dim(key.padEnd(14))} ${val}`);
  }

  console.log(`\n  ${dim("Last 5 log entries:")}`);
  for (const line of lastErrors) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const lvl = String(parsed["level"] ?? "info");
      const msg = String(parsed["msg"] ?? "");
      const color = lvl === "error" ? red : lvl === "warn" ? amber : dim;
      console.log(`  ${color(`[${lvl}]`)} ${msg}`);
    } catch {
      console.log(`  ${dim(line)}`);
    }
  }

  console.log(`\n  ${dim("Log file:")} ${logFilePath()}\n`);
}
