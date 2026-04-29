// Patches openai's src/tsconfig.json to suppress the moduleResolution=node10
// deprecation warning that VS Code's TS server picks up via declaration maps.
// This runs automatically after npm install via the postinstall script.
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "../node_modules/openai/src/tsconfig.json");

try {
  if (!fs.existsSync(target)) process.exit(0);

  // The file contains // comments so we strip them before JSON.parse
  const raw = fs.readFileSync(target, "utf8");
  const stripped = raw.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
  const cfg = JSON.parse(stripped);

  if (cfg.compilerOptions?.ignoreDeprecations === "6.0") process.exit(0); // already patched

  cfg.compilerOptions = cfg.compilerOptions || {};
  cfg.compilerOptions.ignoreDeprecations = "6.0";

  fs.writeFileSync(target, JSON.stringify(cfg, null, 2) + "\n");
  console.log("Patched openai/src/tsconfig.json");
} catch (e) {
  // Non-fatal — don't break installs
  console.warn("Could not patch openai/src/tsconfig.json:", e.message);
}
