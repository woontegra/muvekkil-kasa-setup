/**
 * Mevcut imzalı Setup EXE üzerinden latest.yml ve blockmap yenileme.
 * SSL.com şifresi veya OTP istemez; yeniden imzalama yapmaz.
 */
const {
  readPackageJson,
  findSetupExe,
  verifyAuthenticode,
  refreshSignedReleaseMetadata,
} = require("./lib/release-metadata.cjs");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function logStep(msg) {
  console.log(`[release:update:metadata] ${msg}`);
}

async function main() {
  if (process.platform !== "win32") {
    die("release:update:metadata yalnızca Windows üzerinde çalıştırılabilir.");
  }

  const pkg = readPackageJson();
  const setupPath = findSetupExe(pkg.version);
  logStep(`Setup EXE: ${setupPath}`);

  const authStatus = verifyAuthenticode(setupPath);
  logStep(`Authenticode: ${authStatus}`);

  const result = await refreshSignedReleaseMetadata({
    setupPath,
    version: pkg.version,
    log: (msg) => logStep(msg),
  });

  logStep(`SHA-512 hesaplandı: ${result.sha512}`);
  logStep(`latest.yml yeniden oluşturuldu: ${result.latestPath}`);
  logStep("SHA-512 eşleşti");
  logStep(`blockmap mevcut: ${result.blockmapPath}`);

  console.log("");
  console.log("[release:update:metadata] Metadata hazırlama tamamlandı.");
  console.log(`  Setup EXE : ${setupPath}`);
  console.log(`  Authenticode: Valid`);
  console.log(`  latest.yml : ${result.latestPath}`);
  console.log(`  blockmap   : ${result.blockmapPath}`);
  console.log(`  sha512     : ${result.sha512}`);
  console.log(`  size       : ${result.size}`);
  console.log("");
  console.log("Manuel R2 yükleme: woontegra-downloads/updates/muvekkil-kasa-defteri/windows/");
}

main().catch((e) => {
  console.error("[release:update:metadata] Hata:", e.message || e);
  process.exit(1);
});
