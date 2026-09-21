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
for (const key of Object.keys(env).filter((k) => k.startsWith("MKD_") || k === "ELECTRON_RUN_AS_NODE")) {
  delete env[key];
}
env.MKD_ACCOUNTING_PERIOD_TEST = "1";

console.log("=== MKD Accounting Period Test ===");
const run = spawnSync(electronPath, ["."], { cwd: root, stdio: "inherit", env });
process.exit(run.status ?? 1);
