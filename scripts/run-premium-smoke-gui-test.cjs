const path = require("node:path");
const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");

runPremiumElectronEntry({
  entryTs: path.join(__dirname, "premium-smoke-test-entry.ts"),
  envKey: "MKD_PREMIUM_SMOKE_TEST",
  label: "Premium Geniş Smoke",
  timeoutMs: 420000,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
