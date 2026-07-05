import chalk from "chalk";
import ora from "ora";
import { GigabeeAuthError } from "gigabee-sdk";
import { makeClient } from "../lib/api";

export async function runBalance(): Promise<void> {
  const client = makeClient();

  const spinner = ora({
    text: chalk.dim("Fetching balance..."),
    color: "yellow",
  }).start();

  try {
    const balance = await client.getBalance();
    spinner.stop();

    console.log();
    console.log(chalk.yellow("  ╔═══════════════════════════╗"));
    console.log(
      chalk.yellow("  ║") +
        chalk.bold("  CREDIT BALANCE            ") +
        chalk.yellow("║"),
    );
    console.log(chalk.yellow("  ╠═══════════════════════════╣"));
    console.log(
      chalk.yellow("  ║") +
        chalk.bold.yellow(`  ${balance.credits} credits`.padEnd(28)) +
        chalk.yellow("║"),
    );
    console.log(
      chalk.yellow("  ║") +
        chalk.dim(`  ≈ $${balance.usdValue.toFixed(2)} USD`.padEnd(28)) +
        chalk.yellow("║"),
    );
    console.log(chalk.yellow("  ╚═══════════════════════════╝"));
    console.log();
    console.log(chalk.dim("  1 credit = $0.01  ·  Credits never expire"));
    console.log();
  } catch (err) {
    spinner.stop();
    if (err instanceof GigabeeAuthError) {
      console.log(chalk.red("\n  ✗  Not authenticated."));
      console.log(chalk.dim("     Run: gigabee config set-token <your-token>\n"));
    } else {
      console.log(chalk.red(`\n  ✗  ${err instanceof Error ? err.message : String(err)}\n`));
    }
    process.exitCode = 1;
  }
}

export async function runPackages(): Promise<void> {
  const client = makeClient();

  const spinner = ora({ text: chalk.dim("Fetching packages..."), color: "yellow" }).start();

  try {
    const data = await client.getCreditPackages();
    spinner.stop();

    console.log();
    console.log(chalk.bold.yellow("  Credit Packages\n"));

    const colW = [16, 12, 10, 8];
    const header = ["Package", "USDC", "Credits", "Bonus"].map((h, i) => h.padEnd(colW[i]!)).join("  ");
    console.log("  " + chalk.dim(header));
    console.log("  " + chalk.dim("─".repeat(header.length)));

    for (const pkg of data.packages) {
      const row = [
        pkg.label.padEnd(colW[0]!),
        `$${pkg.usdcAmount}`.padEnd(colW[1]!),
        String(pkg.credits).padEnd(colW[2]!),
        (pkg.bonus > 0 ? `+${pkg.bonus}` : "–").padEnd(colW[3]!),
      ].join("  ");
      console.log("  " + chalk.white(row));
    }

    console.log();
    console.log(chalk.dim(`  Treasury: ${data.treasuryWallet}`));
    console.log();
  } catch (err) {
    spinner.stop();
    console.log(chalk.red(`\n  ✗  ${err instanceof Error ? err.message : String(err)}\n`));
    process.exitCode = 1;
  }
}
