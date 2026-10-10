/**
 * test:premium-smoke — premium-nav + tahsilat + multi-currency + geniş GUI smoke.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const steps = [
  { label: "test:premium-nav", args: ["run", "test:premium-nav"] },
  { label: "test:tahsilat-merkezi", args: ["run", "test:tahsilat-merkezi"] },
  { label: "test:multi-currency", args: ["run", "test:multi-currency"] },
  { label: "premium-smoke-gui", args: ["run", "test:premium-smoke-gui"] },
];

console.log("=== MKD Premium Smoke Suite ===\n");

for (const step of steps) {
  console.log(`>> ${step.label}`);
  const r = spawnSync(npm, step.args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`\n[FAIL] ${step.label}: exit ${r.status ?? 1}`);
    process.exit(r.status ?? 1);
  }
}

console.log("\n=== Premium smoke suite: TÜM TESTLER GEÇTİ ===\n");
