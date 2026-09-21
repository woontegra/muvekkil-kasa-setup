const fs = require("node:fs");

const path = require("node:path");

const {

  ensureBuilds,

  bundleEntry,

  spawnElectronBundle,

  root,

} = require("./lib/premium-e2e-runner.cjs");



const SIZES = [

  [1100, 720],

  [1366, 768],

  [1920, 1080],

  [2560, 1440],

];



const outDir = path.join(root, "test-results", "premium-responsive");

const entryTs = path.join(__dirname, "premium-responsive-size-entry.ts");

const bundleOut = path.join(__dirname, "lib", ".premium-e2e-bundle-premium-responsive-size-entry.cjs");



async function main() {

  const runStartedMs = Date.now();

  fs.mkdirSync(outDir, { recursive: true });

  for (const f of fs.readdirSync(outDir).filter((n) => n.endsWith(".png"))) {

    fs.unlinkSync(path.join(outDir, f));

  }



  ensureBuilds();

  bundleEntry(entryTs, bundleOut);



  console.log("\n=== Premium Responsive Test (seri, çözünürlük başına izole Electron) ===\n");



  for (const [w, h] of SIZES) {

    const label = `Responsive ${w}x${h}`;

    console.log(`\n--- ${label} ---`);

    const runId = `responsive-${w}x${h}-${Date.now()}`;

    const { exitCode } = await spawnElectronBundle(bundleOut, {

      env: {

        MKD_PREMIUM_RESPONSIVE_SIZE: "1",

        MKD_RESPONSIVE_WIDTH: String(w),

        MKD_RESPONSIVE_HEIGHT: String(h),

        MKD_E2E_RUN_ID: runId,

      },

      label,

      timeoutMs: 180000,

    });

    if (exitCode !== 0) {

      console.error(`[FAIL] ${label}: exit code ${exitCode}`);

      process.exit(exitCode);

    }

    const expected = [

      `login-${w}x${h}.png`,

      `overview-${w}x${h}.png`,

      `muvekkiller-${w}x${h}.png`,

      `muvekkil-detail-${w}x${h}.png`,

      `dosya-detail-${w}x${h}.png`,

      `ofis-kasasi-${w}x${h}.png`,

      `icra-tahsilat-${w}x${h}.png`,

      `ayarlar-${w}x${h}.png`,

      `raporlar-${w}x${h}.png`,

    ];

    for (const file of expected) {

      const p = path.join(outDir, file);

      if (!fs.existsSync(p)) {

        console.error(`[FAIL] Screenshot eksik: ${p}`);

        process.exit(1);

      }

      const st = fs.statSync(p);

      if (st.size <= 0 || st.mtimeMs < runStartedMs - 3000) {

        console.error(`[FAIL] Screenshot geçersiz: ${p}`);

        process.exit(1);

      }

    }

    console.log(`[PASS] ${label}: 9 screenshot doğrulandı`);

  }



  const total = fs.readdirSync(outDir).filter((f) => f.endsWith(".png")).length;

  console.log(`\n[DONE] Premium responsive: ${total} screenshot, 4 çözünürlük (exit 0)\n`);

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


