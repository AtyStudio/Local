const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
for (const filename of ["package-lock.json", "yarn.lock"]) {
  const filePath = path.join(root, filename);
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
