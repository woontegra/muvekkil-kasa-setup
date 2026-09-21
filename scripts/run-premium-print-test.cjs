const path = require("node:path");

const { runPremiumElectronEntry } = require("./lib/premium-e2e-runner.cjs");



let capturedStderr = "";



runPremiumElectronEntry({

  entryTs: path.join(__dirname, "premium-print-test-entry.ts"),

  envKey: "MKD_PREMIUM_PRINT_TEST",

  label: "Premium Print Parity Test",

  timeoutMs: 360000,

  pipeOutput: true,

  onComplete: ({ stderr, stdout, exitCode }) => {

    capturedStderr = stderr;

    if (exitCode !== 0) return;

    const uiPass = stdout.includes("[MKD_PRINT_BUSY_GUARD] ui=pass");

    if (!uiPass) {

      console.error("[FAIL] Print busy-guard UI doğrulaması stdout'ta bulunamadı");

      process.exit(1);

    }

    const printerHits = (stderr.match(/Printer: print_view_manager/g) || []).length;

    if (printerHits < 1) {

      console.error(`[FAIL] Print dialog logu yok (Printer: print_view_manager = 0)`);

      process.exit(1);

    }

    if (printerHits > 2) {

      console.error(`[FAIL] Beklenenden fazla printer logu: ${printerHits}`);

      process.exit(1);

    }

    console.log(`[PASS] Print busy-guard: UI disabled + printer log=${printerHits}`);

  },

}).catch((e) => {

  console.error(e);

  if (capturedStderr) {

    console.error("[INFO] stderr son 500 karakter:", capturedStderr.slice(-500));

  }

  process.exit(1);

});


