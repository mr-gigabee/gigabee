import { saveCredentials } from "../lib/credentials.js";
import { amber, green, red } from "../lib/ansi.js";

export async function runLink(code: string): Promise<void> {
  if (!code || !/^[A-Z0-9-]{6,12}$/i.test(code)) {
    console.error(`\n  ${red("Invalid code format.")}\n  Usage: gigabee-worker link BEE-XXXX\n`);
    process.exit(1);
  }

  console.log(`\n  Linking account with code ${amber(code)}...`);

  try {
    const res = await fetch(
      `${process.env["GIGABEE_API_URL"] ?? "https://gigabee.io/api"}/workers/link-status?code=${encodeURIComponent(code)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json() as { status?: string; token?: string; accountId?: string };

    if (body.status !== "claimed" || !body.token) {
      console.error(`  ${red("Code not yet claimed or invalid.")} Visit gigabee.io/link first.\n`);
      process.exit(1);
    }

    await saveCredentials({
      token: body.token,
      accountId: body.accountId ?? "unknown",
      createdAt: new Date().toISOString(),
    });

    console.log(`  ${green("✓")} Account linked. Run: ${amber("gigabee-worker start")}\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ${red("Link failed:")} ${msg}\n`);
    process.exit(1);
  }
}
