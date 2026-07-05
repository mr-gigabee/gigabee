import chalk from "chalk";
import { GigabeeClient } from "gigabee-sdk";
import type { NetworkStats } from "gigabee-sdk";
import { BANNER_LINES, VERSION } from "../lib/logo";
import { makeClient } from "../lib/api";

const W = 62;
const I = W - 2;

const y = (s: string) => chalk.yellow(s);
const top    = y(`╔${"═".repeat(I)}╗`);
const bottom = y(`╚${"═".repeat(I)}╝`);
const sep    = y(`╠${"═".repeat(I)}╣`);
const blank  = y("║") + " ".repeat(I) + y("║");

function pad(s: string, width: number): string {
  const lp = Math.max(0, Math.floor((width - s.length) / 2));
  const rp = Math.max(0, width - s.length - lp);
  return " ".repeat(lp) + s + " ".repeat(rp);
}

function row(content: string): string {
  const inner = content.slice(0, I).padEnd(I);
  return y("║") + inner + y("║");
}

function statCard(label: string, value: string): string {
  const w = Math.floor(I / 4);
  return pad(value, w);
}

function render(stats: NetworkStats | null, error: string | null): void {
  process.stdout.write("\x1B[2J\x1B[H");

  console.log();
  for (const line of BANNER_LINES) {
    console.log("  " + chalk.bold.yellow(line));
  }
  console.log();
  console.log(
    chalk.dim(pad("Decentralized AI Inference Network  ·  v" + VERSION, BANNER_LINES[0]!.length + 4)),
  );
  console.log();

  console.log(top);
  console.log(blank);

  if (error) {
    console.log(row("  " + chalk.red("✗") + chalk.dim("  " + error)));
    console.log(blank);
    console.log(bottom);
    return;
  }

  const colW = Math.floor(I / 4);

  const labels = ["WORKERS LIVE", "JOBS / HOUR", "TOKENS (TOTAL)", "HONEY PAID"];
  const values = stats
    ? [
        String(stats.workersOnline),
        String(stats.jobsToday),
        stats.tokensGenerated.toLocaleString(),
        `$${stats.honeyPaidOutUsd.toFixed(2)}`,
      ]
    : ["–", "–", "–", "–"];

  const labelRow = labels.map((l) => pad(l, colW)).join("").padEnd(I);
  const valueRow = values.map((v) => pad(v, colW)).join("").padEnd(I);

  console.log(y("║") + chalk.dim(labelRow) + y("║"));
  console.log(blank);
  console.log(y("║") + chalk.bold.yellow(valueRow) + y("║"));
  console.log(blank);
  console.log(sep);

  const ts = new Date().toLocaleTimeString();
  const footerLeft = stats
    ? chalk.green(" ●") + chalk.dim(` LIVE  ·  Updated ${ts}  ·  Ctrl+C to exit`)
    : chalk.dim(` ○  Connecting...  ·  ${ts}  ·  Ctrl+C to exit`);
  const strippedLen = ` ● LIVE  ·  Updated ${ts}  ·  Ctrl+C to exit`.length;
  const footerPad = " ".repeat(Math.max(0, I - strippedLen));
  console.log(y("║") + footerLeft + footerPad + y("║"));
  console.log(bottom);
  console.log();
}

export async function runDashboard(opts: { apiUrl?: string } = {}): Promise<void> {
  const client = opts.apiUrl
    ? new GigabeeClient({ baseUrl: opts.apiUrl })
    : makeClient();

  process.stdout.write("\x1B[?25l");

  const cleanup = () => {
    process.stdout.write("\x1B[?25h\n");
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  let stats: NetworkStats | null = null;
  let fetchError: string | null = null;

  const refresh = async () => {
    try {
      stats = await client.getStats();
      fetchError = null;
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
    render(stats, fetchError);
  };

  await refresh();

  const interval = setInterval(refresh, 5000);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      clearInterval(interval);
      resolve();
    });
  });
}
