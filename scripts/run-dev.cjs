const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const electronDir = path.join(root, "node_modules", "electron");
const pathFile = path.join(electronDir, "path.txt");

/** Test/E2E oturumlarından kalan env — Electron'u Node gibi çalıştırır ve dev'i çökertir. */
const DEV_ENV_UNSET = [
  "ELECTRON_RUN_AS_NODE",
  "MKD_E2E_VEKALET_OFIS",
  "MKD_GUI_LIVE_TEST",
  "MKD_TEST_DB",
];

const env = { ...process.env };
for (const key of DEV_ENV_UNSET) {
  delete env[key];
}

if (fs.existsSync(pathFile)) {
  const executablePath = fs.readFileSync(pathFile, "utf8").trim();
  env.ELECTRON_EXEC_PATH = path.join(electronDir, "dist", executablePath);
}

const args = process.argv.slice(2);
const legacyRequested =
  args.includes("--renderer=legacy") || process.env.MKD_RENDERER === "legacy";

const viteArgs = ["electron-vite", "dev"];
if (legacyRequested) {
  env.MKD_RENDERER = "legacy";
} else {
  viteArgs.push("--config", "electron.vite.premium.config.ts");
  env.MKD_RENDERER = "premium";
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", viteArgs, {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 1));
