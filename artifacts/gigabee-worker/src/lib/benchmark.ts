import { runInference } from "./ollama.js";
import { dim, amber } from "./ansi.js";

const BENCH_PROMPTS = [
  [{ role: "user" as const, content: "What is 17 × 24?" }],
  [{ role: "user" as const, content: "Name three planets in the solar system." }],
  [{ role: "user" as const, content: "What is the capital of France?" }],
];

/**
 * Run three fixed prompts through Ollama and measure tokens/second.
 * Only the TPS measurement is reported; no prompt or response content
 * leaves this function or is logged anywhere.
 */
export async function runBenchmark(model: string): Promise<number> {
  process.stdout.write(`\n  ${dim("Benchmarking")} ${amber(model)} ${dim("(3 prompts)...")}\n`);

  let totalTokens = 0;
  const startMs = Date.now();

  for (let i = 0; i < BENCH_PROMPTS.length; i++) {
    const messages = BENCH_PROMPTS[i]!;
    process.stdout.write(`\r  prompt ${i + 1}/3...  `);
    const result = await runInference(
      model,
      messages,
      () => { totalTokens++; },
    );
    totalTokens += result.completionTokens - totalTokens > 0
      ? result.completionTokens - totalTokens
      : 0;
  }

  const elapsedSec = (Date.now() - startMs) / 1_000;
  const tps = Math.round(totalTokens / elapsedSec);

  process.stdout.write(`\r  ${amber(String(tps) + " tok/s")} measured         \n`);
  return tps;
}
