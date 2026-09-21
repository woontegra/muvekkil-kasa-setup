/**
 * Paketli win-unpacked exe üzerinde MKD_* smoke testleri.
 * Kullanım: node scripts/run-packed-smoke.cjs [pending-approval|masraf-input|vekalet-sil-input]
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const unpackedDir = path.join(root, "release", "win-unpacked");
const exeName = "Woontegra Müvekkil Kasa Defteri.exe";
const exePath = path.join(unpackedDir, exeName);

const testKey = (process.argv[2] || "").trim().toLowerCase();
const envMap = {
  "pending-approval": "MKD_PENDING_APPROVAL_TEST",
  "masraf-input": "MKD_MASRAF_INPUT_TEST",
  "vekalet-sil-input": "MKD_VEKALET_SIL_INPUT_TEST",
};

const envVar = envMap[testKey];
if (!envVar) {
  console.error("Kullanım: node scripts/run-packed-smoke.cjs <pending-approval|masraf-input|vekalet-sil-input>");
  process.exit(1);
}

if (!fs.existsSync(exePath)) {
  console.error(`Paketli exe bulunamadı: ${exePath}`);
  console.error("Önce npm run dist:win çalıştırın.");
  process.exit(1);
}

const env = { ...process.env };
for (const key of Object.keys(env).filter((k) => k.startsWith("MKD_") || k === "ELECTRON_RUN_AS_NODE")) {
  delete env[key];
}
env[envVar] = "1";

console.log(`=== Paketli smoke: ${testKey} ===`);
console.log(exePath);
const run = spawnSync(exePath, [], { cwd: unpackedDir, stdio: "inherit", env, shell: false });
process.exit(run.status ?? 1);
