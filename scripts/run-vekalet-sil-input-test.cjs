const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const rendererHtml = path.join(root, "out", "renderer", "index.html");

if (!fs.existsSync(rendererHtml)) {
  console.log("Renderer build yok — npm run build çalıştırılıyor…");
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const electronDir = path.join(root, "node_modules", "electron");
const executablePath = fs.readFileSync(path.join(electronDir, "path.txt"), "utf8").trim();
const electronPath = path.join(electronDir, "dist", executablePath);

const env = { ...process.env };
for (const key of [
  "ELECTRON_RUN_AS_NODE",
  "MKD_E2E_VEKALET_OFIS",
  "MKD_GUI_LIVE_TEST",
  "MKD_TEST_DB",
  "ELECTRON_RENDERER_URL",
  "MKD_VEKALET_UYARI_TEST",
  "MKD_VEKALET_SCROLL_TEST",
  "MKD_VEKALET_LIMIT_TEST",
  "MKD_ICRA_TAHSILAT_TEST",
]) {
  delete env[key];
}
env.MKD_VEKALET_SIL_INPUT_TEST = "1";

console.log("=== MKD Vekalet Sil → Tek Taksit Input Testi ===");
const run = spawnSync(electronPath, ["."], { cwd: root, stdio: "inherit", env });
process.exit(run.status ?? 1);
