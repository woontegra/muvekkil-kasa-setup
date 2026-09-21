const path = require("node:path");
const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");

runPremiumElectronEntry({
  entryTs: path.join(__dirname, "premium-input-regression-test-entry.ts"),
  envKey: "MKD_PREMIUM_INPUT_TEST",
  label: "Premium Input Regression Test",
  timeoutMs: 300000,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
