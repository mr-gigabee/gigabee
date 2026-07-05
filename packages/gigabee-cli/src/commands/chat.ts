import * as readline from "readline";
import chalk from "chalk";
import ora from "ora";
import { GigabeeAuthError } from "gigabee-sdk";
import { BANNER_LINES } from "../lib/logo";
import { makeClient } from "../lib/api";

export async function runChat(opts: { model?: string } = {}): Promise<void> {
  const client = makeClient();

  console.log();
  for (const line of BANNER_LINES) {
    console.log("  " + chalk.bold.yellow(line));
  }
  console.log();
  console.log(chalk.dim("  Chat with Bee — type your message and press Enter"));
  console.log(chalk.dim("  Model: " + (opts.model ?? "bee-hover") + "  ·  /exit or Ctrl+C to quit"));
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  const prompt = () => {
    rl.question(chalk.yellow("  You  › "), async (input) => {
      const text = input.trim();

      if (!text) return prompt();
      if (text === "/exit" || text === "/quit") {
        console.log(chalk.dim("\n  Goodbye! 🐝\n"));
        rl.close();
        return;
      }
      if (text === "/clear") {
        history.length = 0;
        console.clear();
        console.log(chalk.dim("  Conversation cleared.\n"));
        return prompt();
      }

      history.push({ role: "user", content: text });

      const spinner = ora({
        text: chalk.dim("  Bee is thinking..."),
        color: "yellow",
        prefixText: "",
      }).start();

      try {
        const res = await client.chat({
          messages: history,
          model: (opts.model as "bee-hover" | "bee-glide" | "bee-nano") ?? "bee-hover",
        });
        spinner.stop();

        history.push({ role: "assistant", content: res.content });

        console.log();
        process.stdout.write(chalk.yellow("  Bee  › "));

        const words = res.content.split(" ");
        for (let i = 0; i < words.length; i++) {
          process.stdout.write((i > 0 ? " " : "") + chalk.white(words[i]!));
          await new Promise((r) => setTimeout(r, 12));
        }

        console.log();
        console.log(
          chalk.dim(
            `\n        ${res.promptTokens + res.completionTokens} tokens  ·  ${res.creditsCharged} credits  ·  ${res.durationMs}ms`,
          ),
        );
        console.log();
      } catch (err) {
        spinner.stop();
        if (err instanceof GigabeeAuthError) {
          console.log(chalk.red("\n  ✗  Not authenticated."));
          console.log(chalk.dim("     Run: gigabee config set-token <your-token>\n"));
        } else {
          console.log(chalk.red(`\n  ✗  ${err instanceof Error ? err.message : String(err)}\n`));
        }
      }

      prompt();
    });
  };

  prompt();

  await new Promise<void>((resolve) => {
    rl.on("close", resolve);
    process.on("SIGINT", () => {
      console.log(chalk.dim("\n  Goodbye! 🐝\n"));
      rl.close();
      resolve();
    });
  });
}
