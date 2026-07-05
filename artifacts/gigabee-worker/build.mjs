import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "cli.mjs"),
    logLevel: "info",
    external: ["*.node", "bufferutil", "utf-8-validate"],
    sourcemap: "linked",
    banner: {
      js: `#!/usr/bin/env node\nimport { createRequire as __crReq } from 'node:module';\nglobalThis.require = __crReq(import.meta.url);\n`,
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
