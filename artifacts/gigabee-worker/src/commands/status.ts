import { loadCredentials } from "../lib/credentials.js";
import { getWorkerStatus } from "../lib/api.js";
import { amber, green, red, dim } from "../lib/ansi.js";

export async function runStatus(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log(`\n  ${red("Not linked.")} Run: ${amber("gigabee-worker start")}\n`);
    process.exit(1);
  }

  try {
    const status = await getWorkerStatus();
    const onlineStr = status.online ? green("online") : red("offline");
    console.log(
      `\n  ${amber("Gigabee worker status")}\n` +
      `  ${"─".repeat(32)}\n` +
      `  status      ${onlineStr}\n` +
      `  reputation  ${status.reputation.toFixed(2)}\n` +
      `  uptime      ${status.uptimePct.toFixed(1)}%\n` +
      `  jobs done   ${status.jobsDone}\n` +
      `  jobs failed ${status.jobsFailed}\n`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  ${red("Could not fetch status:")} ${dim(msg)}\n`);
    process.exit(1);
  }
}
