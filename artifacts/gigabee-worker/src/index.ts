#!/usr/bin/env node
/**
 * gigabee-worker CLI
 *
 * Usage:
 *   npx gigabee-worker start          # start earning (most people only need this)
 *   gigabee-worker status             # is my worker online?
 *   gigabee-worker earnings           # honey balance
 *   gigabee-worker link <code>        # bind this machine to an account
 *   gigabee-worker logout             # remove credentials
 *   gigabee-worker doctor             # full diagnostics
 *   gigabee-worker update             # self-update via npm
 */

import { Command } from "commander";
import { runStart, type StartOptions } from "./commands/start.js";
import { runStatus } from "./commands/status.js";
import { runEarnings } from "./commands/earnings.js";
import { runLink } from "./commands/link.js";
import { runLogout } from "./commands/logout.js";
import { runDoctor } from "./commands/doctor.js";
import { runUpdate } from "./commands/update.js";

const program = new Command();

program
  .name("gigabee-worker")
  .description("Gigabee native GPU worker — earn Honey by serving AI inference")
  .version("0.1.0");

// ── start ──────────────────────────────────────────────────────────────────
program
  .command("start")
  .description("Start the worker and connect to the Hive (default command)")
  .option("--model <name>", "Model to serve", "bea-glide")
  .option("--max-load <n>", "Refuse jobs above this GPU utilization (0–1)", parseFloat, 0.8)
  .option("--hours <range>", "Serving window in local time, e.g. 22:00-07:00")
  .action((opts: StartOptions) => runStart(opts).catch(fatal));

// ── status ─────────────────────────────────────────────────────────────────
program
  .command("status")
  .description("Show whether this worker is online and earning")
  .action(() => runStatus().catch(fatal));

// ── earnings ───────────────────────────────────────────────────────────────
program
  .command("earnings")
  .description("Show Honey balance (pending vs available)")
  .action(() => runEarnings().catch(fatal));

// ── link ───────────────────────────────────────────────────────────────────
program
  .command("link <code>")
  .description("Bind this machine to a Gigabee account using a pairing code")
  .action((code: string) => runLink(code).catch(fatal));

// ── logout ─────────────────────────────────────────────────────────────────
program
  .command("logout")
  .description("Remove credentials from this machine")
  .action(() => runLogout().catch(fatal));

// ── doctor ─────────────────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Full diagnostic (GPU, VRAM, Ollama, network, last errors)")
  .action(() => runDoctor().catch(fatal));

// ── update ─────────────────────────────────────────────────────────────────
program
  .command("update")
  .description("Self-update to the latest version via npm")
  .action(() => runUpdate().catch(fatal));

// Default to `start` when called with no subcommand (npx gigabee-worker)
if (process.argv.length === 2) {
  process.argv.push("start");
}

program.parse(process.argv);

// ── Error handler ──────────────────────────────────────────────────────────
function fatal(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n  \x1B[31mError:\x1B[0m ${msg}\n`);
  process.exit(1);
}
