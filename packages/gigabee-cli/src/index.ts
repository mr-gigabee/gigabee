import { Command } from "commander";
import chalk from "chalk";
import { BANNER_LINES, VERSION } from "./lib/logo";
import { loadConfig, saveConfig, configFilePath } from "./lib/config";
import { runDashboard } from "./commands/dashboard";
import { runChat } from "./commands/chat";
import { runBalance, runPackages } from "./commands/balance";
import { runStats } from "./commands/stats";

const program = new Command();

program
  .name("gigabee")
  .description("Gigabee CLI — Decentralized AI Inference Network")
  .version(VERSION, "-v, --version");

program
  .command("dashboard", { isDefault: true })
  .description("Live ASCII network dashboard (default command)")
  .option("--api-url <url>", "Override API base URL")
  .action(async (opts: { apiUrl?: string }) => {
    await runDashboard(opts);
  });

program
  .command("chat")
  .description("Interactive chat with Bee")
  .option("-m, --model <model>", "Model to use: bee-nano, bee-hover, bee-glide", "bee-hover")
  .action(async (opts: { model?: string }) => {
    await runChat(opts);
  });

program
  .command("stats")
  .description("Print current network statistics and exit")
  .action(async () => {
    await runStats();
  });

program
  .command("balance")
  .description("Show your credit balance")
  .action(async () => {
    await runBalance();
  });

program
  .command("packages")
  .description("List available credit packages")
  .action(async () => {
    await runPackages();
  });

const config = program.command("config").description("Manage CLI configuration");

config
  .command("set-token <token>")
  .description("Save your Gigabee API token")
  .action((token: string) => {
    saveConfig({ token });
    console.log(chalk.green("  ✓  Token saved to " + configFilePath()));
  });

config
  .command("set-url <url>")
  .description("Set the API base URL")
  .action((url: string) => {
    saveConfig({ apiUrl: url });
    console.log(chalk.green("  ✓  API URL saved: " + url));
  });

config
  .command("show")
  .description("Show current configuration")
  .action(() => {
    const cfg = loadConfig();
    console.log();
    for (const line of BANNER_LINES) {
      console.log("  " + chalk.bold.yellow(line));
    }
    console.log();
    console.log(chalk.yellow("  ╔═══════════════════════════════════════╗"));
    console.log(chalk.yellow("  ║") + chalk.bold("  CONFIGURATION                        ") + chalk.yellow("║"));
    console.log(chalk.yellow("  ╠═══════════════════════════════════════╣"));
    console.log(chalk.yellow("  ║") + chalk.dim("  API URL  ") + chalk.white(cfg.apiUrl.padEnd(28)) + chalk.yellow("║"));
    const tokenDisplay = cfg.token
      ? cfg.token.slice(0, 8) + "..." + cfg.token.slice(-4)
      : "(not set)";
    console.log(chalk.yellow("  ║") + chalk.dim("  Token   ") + chalk.white(tokenDisplay.padEnd(29)) + chalk.yellow("║"));
    console.log(chalk.yellow("  ╚═══════════════════════════════════════╝"));
    console.log(chalk.dim("\n  Config file: " + configFilePath() + "\n"));
  });

program.addHelpText(
  "beforeAll",
  () => {
    const lines: string[] = [""];
    for (const line of BANNER_LINES) {
      lines.push("  " + chalk.bold.yellow(line));
    }
    lines.push("");
    lines.push(chalk.dim("  Decentralized AI Inference Network  ·  v" + VERSION));
    lines.push("");
    return lines.join("\n");
  },
);

program.parse(process.argv);
