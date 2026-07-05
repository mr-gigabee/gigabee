import { loadCredentials } from "../lib/credentials.js";
import { getEarnings } from "../lib/api.js";
import { amber, green, dim, red } from "../lib/ansi.js";

export async function runEarnings(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log(`\n  ${red("Not linked.")} Run: ${amber("gigabee-worker start")}\n`);
    process.exit(1);
  }

  try {
    const e = await getEarnings();
    const fmt = (n: number) => "$" + n.toFixed(2);
    console.log(
      `\n  ${amber("Honey earnings")}\n` +
      `  ${"─".repeat(32)}\n` +
      `  pending     ${dim(fmt(e.pendingUsd))}  (24h hold)\n` +
      `  available   ${green(fmt(e.availableUsd))}\n` +
      `  lifetime    ${fmt(e.lifetimeUsd)}\n` +
      `  jobs        ${e.jobsCompleted} completed\n`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${red("Could not fetch earnings:")} ${dim(msg)}\n`);
    process.exit(1);
  }
}
