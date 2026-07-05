import { clearCredentials, loadCredentials } from "../lib/credentials.js";
import { amber, green, dim } from "../lib/ansi.js";

export async function runLogout(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    console.log(`\n  ${dim("Already logged out.")}\n`);
    return;
  }
  await clearCredentials();
  console.log(`\n  ${green("✓")} Credentials removed from this machine.\n  Run ${amber("gigabee-worker start")} to re-link.\n`);
}
