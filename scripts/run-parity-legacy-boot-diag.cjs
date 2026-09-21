/**
 * 15s bootstrap teşhisi — parity legacy Electron child neden başlamıyor?
 * Tam UI akışı, login, premium, DB, build YOK.
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

const TIMEOUT_MS = 15000;
const entryTs = path.join(__dirname, "parity-flow-entry.ts");
const bundleOut = path.join(__dirname, "lib", ".premium-e2e-bundle-parity-flow-entry.cjs");
const wrapperPath = path.join(__dirname, "parity-legacy-boot-wrapper.cjs");

async function main() {
  console.log("\n=== Parity Legacy Bootstrap Teşhis (15s) ===\n");

  ensureBuilds();
  bundleEntry(entryTs, bundleOut);

  if (!fs.existsSync(bundleOut)) {
    console.error("[FAIL] Bundle dosyası yok:", bundleOut);
    process.exit(1);
  }
  const bundleStat = fs.statSync(bundleOut);
  if (bundleStat.size <= 0) {
    console.error("[FAIL] Bundle boyutu sıfır:", bundleOut);
    process.exit(1);
  }
  console.log(`[DIAG] bundle OK: ${bundleOut} (${bundleStat.size} bytes)`);

  if (!fs.existsSync(wrapperPath)) {
    console.error("[FAIL] Wrapper yok:", wrapperPath);
    process.exit(1);
  }
  const wrapperStat = fs.statSync(wrapperPath);
  console.log(`[DIAG] wrapper OK: ${wrapperPath} (${wrapperStat.size} bytes)`);

  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv).filter((k) => k.startsWith("MKD_"))) {
    delete childEnv[key];
  }
  childEnv.MKD_PARITY_BOOT_TARGET = bundleOut;
  // MKD_PARITY_LEGACY_FLOW bilerek SET EDİLMİYOR — UI akışı başlamasın

  const args = [wrapperPath];
  const cwd = root;

  console.log("[SPAWN] electron executable:", electronPath);
  console.log("[SPAWN] entry (wrapper):", wrapperPath);
  console.log("[SPAWN] bundle target:", bundleOut);
  console.log("[SPAWN] cwd:", cwd);
  console.log("[SPAWN] args:", JSON.stringify(args));
  console.log("[SPAWN] ELECTRON_RUN_AS_NODE:", childEnv.ELECTRON_RUN_AS_NODE ?? "(yok)");
  console.log("[SPAWN] MKD_TEST_DB:", childEnv.MKD_TEST_DB ?? "(yok — child entry atar)");
  console.log("[SPAWN] userData:", "(child içinde electron app.getPath ile loglanır)");
  console.log("[SPAWN] komut:", `"${electronPath}" ${args.map((a) => `"${a}"`).join(" ")}`);
  console.log(`[SPAWN] timeout: ${TIMEOUT_MS}ms\n`);

  const started = Date.now();
  const { exitCode, timedOut } = await spawnWithTimeout({
    command: electronPath,
    args,
    cwd,
    env: childEnv,
    label: "parity-legacy-boot-diag",
    timeoutMs: TIMEOUT_MS,
    pipeOutput: false,
  });

  const elapsed = Date.now() - started;
  console.log(`\n[DIAG] Bitti: exit=${exitCode} timedOut=${timedOut} elapsed=${elapsed}ms`);
  process.exit(timedOut ? 1 : exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
