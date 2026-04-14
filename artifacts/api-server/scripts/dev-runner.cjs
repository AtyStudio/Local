const { spawnSync } = require("node:child_process");

process.env.NODE_ENV = process.env.NODE_ENV || "development";

const build = spawnSync(
  process.execPath,
  ["./build.mjs"],
  {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  },
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const start = spawnSync(
  process.execPath,
  [
    "--env-file-if-exists=../../.env.local",
    "--env-file-if-exists=../../.env",
    "--enable-source-maps",
    "./dist/index.mjs",
  ],
  {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  },
);

process.exit(start.status ?? 1);
