import chalk from "chalk";
import ora from "ora";
import { makeClient } from "../lib/api";

export async function runStats(): Promise<void> {
  const client = makeClient();

  const spinner = ora({ text: chalk.dim("Fetching network stats..."), color: "yellow" }).start();

  try {
    const s = await client.getStats();
    spinner.stop();

    console.log();
    console.log(chalk.yellow("  ╔════════════════════════════════════════╗"));
    console.log(chalk.yellow("  ║") + chalk.bold("  NETWORK STATS                         ") + chalk.yellow("║"));
    console.log(chalk.yellow("  ╠════════════════════════════════════════╣"));

    const rows: [string, string][] = [
      ["Workers Online", String(s.workersOnline)],
      ["Jobs This Hour", String(s.jobsToday)],
      ["Tokens Generated", s.tokensGenerated.toLocaleString()],
      ["Active Models", String(s.activeModels)],
      ["Honey Paid Out", `$${s.honeyPaidOutUsd.toFixed(2)} USDC`],
    ];

    for (const [label, value] of rows) {
      const l = ("  " + label).padEnd(26);
      const v = value.padStart(12);
      console.log(chalk.yellow("  ║") + chalk.dim(l) + chalk.bold.yellow(v) + "  " + chalk.yellow("║"));
    }

    console.log(chalk.yellow("  ╚════════════════════════════════════════╝"));
    console.log();

    if (s.byModel.length > 0) {
      console.log(chalk.bold.yellow("  By Model\n"));
      const colW = [18, 10, 14];
      const header = ["Model", "Jobs", "Tokens"].map((h, i) => h.padEnd(colW[i]!)).join("  ");
      console.log("  " + chalk.dim(header));
      console.log("  " + chalk.dim("─".repeat(header.length)));
      for (const m of s.byModel.slice(0, 10)) {
        const r = [
          (m.model ?? "–").padEnd(colW[0]!),
          String(m.jobs).padEnd(colW[1]!),
          m.tokens.toLocaleString().padEnd(colW[2]!),
        ].join("  ");
        console.log("  " + r);
      }
      console.log();
    }
  } catch (err) {
    spinner.stop();
    console.log(chalk.red(`\n  ✗  ${err instanceof Error ? err.message : String(err)}\n`));
    process.exitCode = 1;
  }
}
