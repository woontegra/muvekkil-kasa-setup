/**
 * Legacy parity Electron başlangıç doğrulaması — yalnız [START] 1. Giriş'e kadar.
 * Toplam timeout 20s; app.whenReady entry içinde 10s.
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  bundleEntry,
  ensureBuilds,
  electronPath,
  root,
  spawnWithTimeout,
} = require("./lib/premium-e2e-runner.cjs");

const TIMEOUT_MS = 20000;
const entryTs = path.join(__dirname, "parity-flow-entry.ts");
const bundleOut = path.join(__dirname, "lib", ".premium-e2e-bundle-parity-flow-entry.cjs");
const wrapperPath = path.join(__dirname, "parity-legacy-boot-wrapper.cjs");

async function main() {
  console.log("\n=== Parity Legacy Startup Probe (20s) ===\n");

  ensureBuilds();
  bundleEntry(entryTs, bundleOut);

  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv).filter((k) => k.startsWith("MKD_"))) {
    delete childEnv[key];
  }
  childEnv.MKD_PARITY_LEGACY_FLOW = "1";
  childEnv.MKD_PARITY_LEGACY_STARTUP_PROBE = "1";
  childEnv.MKD_PARITY_BOOT_TARGET = bundleOut;

  const args = [wrapperPath];
  console.log(`[PROBE] MKD_PARITY_LEGACY_FLOW=${childEnv.MKD_PARITY_LEGACY_FLOW}`);
  console.log(`[PROBE] timeout=${TIMEOUT_MS}ms\n`);

  const { exitCode, timedOut } = await spawnWithTimeout({
    command: electronPath,
    args,
    cwd: root,
    env: childEnv,
    label: "parity-legacy-startup-probe",
    timeoutMs: TIMEOUT_MS,
    pipeOutput: false,
  });

  if (timedOut || exitCode !== 0) {
    console.error(`[FAIL] startup probe: exit=${exitCode} timedOut=${timedOut}`);
    process.exit(1);
  }
  console.log("[PASS] startup probe tamam");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
