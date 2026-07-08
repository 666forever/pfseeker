import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = "dist";
const clientDir = join(distDir, "client");
const serverEntry = join(distDir, "server", "entry.mjs");
const workerEntry = join(clientDir, "_worker.js");
const assetsIgnore = join(clientDir, ".assetsignore");
const wranglerDeployRedirect = join(".wrangler", "deploy", "config.json");

if (!existsSync(clientDir)) {
  throw new Error("Expected Astro client output at dist/client.");
}

if (!existsSync(serverEntry)) {
  throw new Error("Expected Astro server entrypoint at dist/server/entry.mjs.");
}

await writeFile(
  workerEntry,
  [
    'import worker from "../server/entry.mjs";',
    "",
    "export default worker;",
    "",
  ].join("\n"),
);

await writeFile(
  assetsIgnore,
  ["wrangler.json", ".dev.vars", "_worker.js", ""].join("\n"),
);

await rm(wranglerDeployRedirect, { force: true });
