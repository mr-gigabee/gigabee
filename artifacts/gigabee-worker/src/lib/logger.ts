/**
 * Operational file logger — writes to ~/.gigabee/worker.log.
 * NEVER logs message content (prompts / completions). This is enforced
 * by convention: only call log() with metadata strings, never with job
 * payload content.  Rotates at ~10 MB.
 */

import { appendFile, stat, rename } from "node:fs/promises";
import { logFilePath, ensureDir } from "./credentials.js";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type Level = "info" | "warn" | "error";

async function rotateMaybe(): Promise<void> {
  try {
    const s = await stat(logFilePath());
    if (s.size >= MAX_BYTES) {
      await rename(logFilePath(), logFilePath() + ".1");
    }
  } catch {
    // file does not yet exist — that's fine
  }
}

async function write(level: Level, msg: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    await ensureDir();
    await rotateMaybe();
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      msg,
      ...(meta ?? {}),
    }) + "\n";
    await appendFile(logFilePath(), line, "utf8");
  } catch {
    // logger must never crash the process
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};
