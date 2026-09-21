const path = require("node:path");
const fs = require("node:fs");
const {
  bundleEntry,
  ensureBuilds,
  electronPath,
  root,
  spawnWithTimeout,
} = require("./lib/premium-e2e-runner.cjs");

const entryTs = path.join(__dirname, "parity-flow-entry.ts");
const bundleOut = path.join(__dirname, "lib", ".premium-e2e-bundle-parity-flow-entry.cjs");
const wrapperPath = path.join(__dirname, "parity-legacy-boot-wrapper.cjs");
const timeoutMs = 45000;

async function main() {
  ensureBuilds();
  bundleEntry(entryTs, bundleOut);

  const bundleStat = fs.statSync(bundleOut);
  if (bundleStat.size <= 0) {
    console.error("[FAIL] Bundle boyutu sıfır:", bundleOut);
    process.exit(1);
  }

  const childEnv = { ...process.env, MKD_PARITY_LEGACY_FLOW: "1", MKD_PARITY_BOOT_TARGET: bundleOut };
  for (const key of Object.keys(childEnv).filter((k) => k.startsWith("MKD_") && k !== "MKD_PARITY_LEGACY_FLOW" && k !== "MKD_PARITY_BOOT_TARGET")) {
    delete childEnv[key];
  }

  const args = [wrapperPath];
  const cwd = root;

  console.log("\n=== Parity Legacy Flow ===");
  console.log("[SPAWN] electron executable:", electronPath);
  console.log("[SPAWN] entry (wrapper):", wrapperPath);
  console.log("[SPAWN] bundle target:", bundleOut, `(${bundleStat.size} bytes)`);
  console.log("[SPAWN] cwd:", cwd);
  console.log("[SPAWN] args:", JSON.stringify(args));
  console.log("[SPAWN] ELECTRON_RUN_AS_NODE:", childEnv.ELECTRON_RUN_AS_NODE ?? "(yok)");
  console.log("[SPAWN] MKD_TEST_DB:", childEnv.MKD_TEST_DB ?? "(yok — child entry atar)");
  console.log("[SPAWN] userData:", "(child içinde electron app.getPath ile loglanır)");
  console.log("[SPAWN] komut:", `"${electronPath}" ${args.map((a) => `"${a}"`).join(" ")}`);
  console.log(`[INFO] Timeout: ${timeoutMs}ms\n`);

  const { exitCode, timedOut } = await spawnWithTimeout({
    command: electronPath,
    args,
    cwd,
    env: childEnv,
    label: "Parity Legacy Flow",
    timeoutMs,
    pipeOutput: false,
  });

  if (exitCode !== 0) {
    console.error(`[FAIL] Parity Legacy Flow: exit code ${exitCode}${timedOut ? " (timeout)" : ""}`);
    process.exit(1);
  }
  console.log("[DONE] Parity Legacy Flow: başarılı (exit 0)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});