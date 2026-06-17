/**
 * Ofis Kasası servis mantığı — Electron Node ortamında:
 *   node scripts/run-ofis-kasa-test.cjs
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const electronExe = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const testScript = path.join(__dirname, "ofis-kasa-test-main.cjs");

if (!fs.existsSync(electronExe)) {
  console.error("electron.exe bulunamadı — önce npm install çalıştırın");
  process.exit(1);
}

const r = spawnSync(electronExe, [testScript], {
  cwd: root,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  encoding: "utf8",
  stdio: "pipe",
});

if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
