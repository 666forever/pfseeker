import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const astroPackageJson = require.resolve("astro/package.json");
const astroBin = join(dirname(astroPackageJson), "bin", "astro.mjs");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Expected an Astro command.");
  process.exit(1);
}

const env = { ...process.env };
delete env.ASTRO_LOG_FORMAT;
env.ASTRO_DEV_BACKGROUND = "1";

const child = spawn(process.execPath, [astroBin, command, ...args], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
