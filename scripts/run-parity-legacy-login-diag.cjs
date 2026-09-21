const path = require("node:path");
const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");

runPremiumElectronEntry({
  entryTs: path.join(__dirname, "parity-legacy-login-diag-entry.ts"),
  envKey: "MKD_PARITY_LEGACY_LOGIN_DIAG",
  label: "Legacy Login Diag",
  timeoutMs: 90000,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
