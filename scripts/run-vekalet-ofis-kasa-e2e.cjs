/**
 * Gerçek servis E2E — derlenmiş main bundle üzerinden:
 *   npm run build && node scripts/run-vekalet-ofis-kasa-e2e.cjs
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const electronExe = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const mainJs = path.join(root, "out", "main", "index.js");

if (!fs.existsSync(electronExe)) {
  console.error("electron.exe bulunamadı — önce npm install çalıştırın");
  process.exit(1);
}
if (!fs.existsSync(mainJs)) {
  console.error("out/main/index.js yok — önce npm run build çalıştırın");
  process.exit(1);
}

const r = spawnSync(electronExe, [mainJs], {
  cwd: root,
  env: { ...process.env, MKD_E2E_VEKALET_OFIS: "1" },
  encoding: "utf8",
  stdio: "pipe",
  timeout: 60000,
});

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
