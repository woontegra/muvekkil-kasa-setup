/**
 * Premium Login & Müvekkiller tasarım screenshot'ları.
 *   node scripts/capture-premium-design-review.cjs
 */
const path = require("node:path");
const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");

const outDir = "test-results/premium-design-review";

runPremiumElectronEntry({
  entryTs: path.join(__dirname, "premium-design-capture-entry.ts"),
  envKey: "MKD_PREMIUM_DESIGN_CAPTURE",
  label: "Premium Design Screenshot Capture",
  timeoutMs: 180000,
  verifyScreenshots: [
    `${outDir}/login-1920x1080.png`,
    `${outDir}/login-1366x768.png`,
    `${outDir}/muvekkiller-1920x1080.png`,
    `${outDir}/muvekkiller-1366x768.png`,
  ],
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
