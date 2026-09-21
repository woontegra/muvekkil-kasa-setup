const path = require("node:path");
const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");

runPremiumElectronEntry({
  entryTs: path.join(__dirname, "premium-gui-test-entry.ts"),
  envKey: "MKD_PREMIUM_GUI_TEST",
  label: "Premium GUI Live Test",
  timeoutMs: 420000,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
