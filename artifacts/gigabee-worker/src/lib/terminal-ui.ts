/**
 * Steady-state live-updating terminal block.
 *
 * Renders a fixed-height block and re-draws it in place using ANSI
 * cursor-up. No scroll spam — only the block lines change.
 *
 * Format (7 lines including borders):
 *
 *   Gigabee worker · bea-glide · online 2h 14m
 *   ────────────────────────────────────────────
 *   status      serving job (34 tok/s)
 *   jobs        47 done · 0 failed
 *   honey       $3.82 pending · $11.05 available
 *   reputation  0.94   uptime 99.2%
 *   ────────────────────────────────────────────
 *   ctrl+c to stop (finishes the current job first)
 */

import { A, amber, green, dim } from "./ansi.js";

const RULE = "─".repeat(44);
const BLOCK_LINES = 8;

export interface UiState {
  model: string;
  status: string;
  jobsDone: number;
  jobsFailed: number;
  pendingUsd: number;
  availableUsd: number;
  reputation: number;
  uptimePct: number;
  uptimeMs: number;
  currentTps?: number;
  honeyFlash?: boolean;
}

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1_000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtUsd(n: number): string {
  return "$" + n.toFixed(2);
}

let firstRender = true;

export function renderUi(state: UiState): void {
  const statusStr = state.currentTps
    ? `serving job (${state.currentTps} tok/s)`
    : state.status;

  const honeyLine = state.honeyFlash
    ? amber(`${fmtUsd(state.pendingUsd)} pending · ${fmtUsd(state.availableUsd)} available`)
    : `${dim(fmtUsd(state.pendingUsd))} pending · ${green(fmtUsd(state.availableUsd))} available`;

  const header = `${amber("Gigabee worker")} · ${state.model} · online ${fmtUptime(state.uptimeMs)}`;

  const lines = [
    header,
    dim(RULE),
    `status      ${statusStr}`,
    `jobs        ${state.jobsDone} done · ${state.jobsFailed === 0 ? dim("0 failed") : amber(String(state.jobsFailed) + " failed")}`,
    `honey       ${honeyLine}`,
    `reputation  ${state.reputation.toFixed(2)}   uptime ${state.uptimePct.toFixed(1)}%`,
    dim(RULE),
    dim("ctrl+c to stop (finishes the current job first)"),
  ];

  if (!firstRender) {
    // Move cursor up to overwrite previous block
    process.stdout.write(A.up(BLOCK_LINES));
  }
  firstRender = false;

  for (const line of lines) {
    process.stdout.write(A.clearLine + line + "\n");
  }
}

export function clearUi(): void {
  if (!firstRender) {
    process.stdout.write(A.up(BLOCK_LINES));
    for (let i = 0; i < BLOCK_LINES; i++) {
      process.stdout.write(A.clearLine + "\n");
    }
    process.stdout.write(A.up(BLOCK_LINES));
  }
}
