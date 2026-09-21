const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { runPremiumElectronEntry, ensureBuilds, bundleEntry, spawnElectronBundle } = require("./lib/premium-e2e-runner.cjs");
const { compareDbs, compareVisible } = require("./lib/parity/db-compare.cjs");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "test-results", "parity");

async function main() {
  console.log("\n=== Legacy–Premium Parite Testi ===\n");
  fs.mkdirSync(outDir, { recursive: true });

  await runPremiumElectronEntry({
    entryTs: path.join(__dirname, "parity-bootstrap-entry.ts"),
    envKey: "MKD_PARITY_BOOTSTRAP",
    label: "Parity Bootstrap",
    timeoutMs: 120000,
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));

  await runPremiumElectronEntry({
    entryTs: path.join(__dirname, "parity-flow-entry.ts"),
    envKey: "MKD_PARITY_FLOW",
    label: "Parity Legacy Flow",
    timeoutMs: 900000,
    extraEnv: { MKD_PARITY_RENDERER: "legacy" },
  });

  await runPremiumElectronEntry({
    entryTs: path.join(__dirname, "parity-flow-entry.ts"),
    envKey: "MKD_PARITY_FLOW",
    label: "Parity Premium Flow",
    timeoutMs: 900000,
    extraEnv: { MKD_PARITY_RENDERER: "premium" },
  });

  const dbResult = compareDbs(manifest.legacyDb, manifest.premiumDb);
  const visResult = compareVisible(
    path.join(outDir, "legacy-visible.json"),
    path.join(outDir, "premium-visible.json"),
  );

  const report = {
    db: dbResult,
    visible: visResult,
    legacyConsole: JSON.parse(fs.readFileSync(path.join(outDir, "legacy-console.json"), "utf8")),
    premiumConsole: JSON.parse(fs.readFileSync(path.join(outDir, "premium-console.json"), "utf8")),
  };
  fs.writeFileSync(path.join(outDir, "compare-report.json"), JSON.stringify(report, null, 2));

  if (!dbResult.ok) {
    console.error("[FAIL] DB farkları:", JSON.stringify(dbResult.diffs, null, 2));
    process.exit(1);
  }
  if (!visResult.ok) {
    console.error("[FAIL] Görünür değer farkları:", JSON.stringify(visResult.diffs, null, 2));
    process.exit(1);
  }

  console.log("[PASS] DB ve görünür değer paritesi");

  console.log("\n=== npm run build ===\n");
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    console.error("[FAIL] npm run build");
    process.exit(build.status ?? 1);
  }

  await runPremiumElectronEntry({
    entryTs: path.join(__dirname, "parity-prod-verify-entry.ts"),
    envKey: "MKD_PARITY_PROD",
    label: "Parity Production Verify",
    timeoutMs: 120000,
  });

  console.log("\n=== PARİTE GEÇTİ ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
