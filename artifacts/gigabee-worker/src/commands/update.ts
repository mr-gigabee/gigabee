import { spawn } from "node:child_process";
import { amber, green, red, dim } from "../lib/ansi.js";

export async function runUpdate(): Promise<void> {
  console.log(`\n  ${dim("Updating gigabee-worker via npm...")} `);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", "gigabee-worker@latest"], {
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm exited with code ${code}`));
    });
  }).then(() => {
    console.log(`  ${green("✓")} Updated. Run ${amber("gigabee-worker start")} to restart.\n`);
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ${red("Update failed:")} ${dim(msg)}\n`);
    process.exit(1);
  });
}
