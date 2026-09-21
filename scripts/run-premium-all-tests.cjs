const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const node = process.execPath;
const scripts = [
  "run-premium-responsive-test.cjs",
  "run-premium-print-test.cjs",
  "run-premium-crud-gui-test.cjs",
  "run-premium-input-regression-test.cjs",
  "run-premium-gui-test.cjs",
];

console.log("=== Premium All Tests (seri) ===\n");
for (const s of scripts) {
  console.log(`>> node scripts/${s}`);
  const r = spawnSync(node, [path.join(__dirname, s)], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[FAIL] scripts/${s}: exit ${r.status ?? 1}`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n[DONE] Premium all tests passed (seri).");
