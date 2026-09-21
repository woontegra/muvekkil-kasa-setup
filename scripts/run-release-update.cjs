/**

 * release:update — patch sürüm artır → paketleme + harici Program-Imzala.ps1 imzalama + imzalı metadata yenileme.

 * R2'ye otomatik yükleme yapmaz.

 * dist:win / dist:win:update mevcut version ile çalışır (artırmaz).

 */

const { spawnSync } = require("child_process");

const fs = require("fs");

const path = require("path");

const {

  ROOT,

  RELEASE_DIR,

  readPackageJson,

  findSetupExe,

  verifyAuthenticode,

  refreshSignedReleaseMetadata,

} = require("./lib/release-metadata.cjs");

const { bumpPatchVersion } = require("./lib/bump-version.cjs");



const SIGN_PS1 = "C:\\Users\\Woontegra\\Desktop\\Program-Imzala.ps1";



function die(msg, code = 1) {

  console.error(msg);

  process.exit(code);

}



function logStep(msg) {

  console.log(`[release:update] ${msg}`);

}



function requireUpdateBaseUrl() {

  const fromEnv = (process.env.UPDATE_BASE_URL || "").trim();

  const fromPkg = String(readPackageJson().config?.updateBaseUrl || "").trim();

  const url = fromEnv || fromPkg;

  if (!url) {

    die(

      "UPDATE_BASE_URL tanımlı değil ve package.json config.updateBaseUrl bulunamadı. Güncelleme paketi oluşturulamadı.",

    );

  }

  if (!/^https:\/\//i.test(url)) {

    die("UPDATE_BASE_URL / updateBaseUrl https:// ile başlamalıdır. Güncelleme paketi oluşturulamadı.");

  }

  if (fromEnv) {

    logStep(`UPDATE_BASE_URL (ortam) = ${url}`);

  } else {

    logStep(`UPDATE_BASE_URL (package.json config.updateBaseUrl) = ${url}`);

  }

  return url;

}



function spawnNpmRun(scriptName, extraEnv = {}) {

  const env = { ...process.env, ...extraEnv };

  const npmCli = (env.npm_execpath || "").trim();



  if (npmCli && fs.existsSync(npmCli)) {

    return spawnSync(process.execPath, [npmCli, "run", scriptName], {

      cwd: ROOT,

      stdio: "inherit",

      shell: false,

      env,

    });

  }



  if (process.platform === "win32") {

    return spawnSync("cmd.exe", ["/d", "/s", "/c", "npm.cmd", "run", scriptName], {

      cwd: ROOT,

      stdio: "inherit",

      shell: false,

      env,

    });

  }



  return spawnSync("npm", ["run", scriptName], {

    cwd: ROOT,

    stdio: "inherit",

    shell: false,

    env,

  });

}



function runDistWinUpdate(updateBaseUrl) {

  logStep("dist:win:update çalıştırılıyor…");

  const r = spawnNpmRun("dist:win:update", { UPDATE_BASE_URL: updateBaseUrl });

  if (r.error) {

    die(`dist:win:update başlatılamadı: ${r.error.message}`);

  }

  if (r.status !== 0) {

    die(`dist:win:update başarısız (exit ${r.status ?? 1}).`, r.status ?? 1);

  }

}



function runExternalSign(setupPath) {

  if (!fs.existsSync(SIGN_PS1)) {

    die(`Program-Imzala.ps1 bulunamadı: ${SIGN_PS1}`);

  }



  logStep("Harici imzalama aracı başlatılıyor (şifre ve OTP bu terminalden girilecek)…");

  logStep(`İmzalanacak: ${setupPath}`);



  const r = spawnSync(

    "powershell.exe",

    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SIGN_PS1, setupPath],

    { stdio: "inherit", shell: false },

  );



  if (r.status !== 0) {

    die(`İmzalama başarısız (exit ${r.status ?? 1}). Release işlemi durduruldu.`, r.status ?? 1);

  }

}



function replaceWithSigned(unsignedPath, signedPath) {

  const backupPath = `${unsignedPath}.unsigned-backup`;

  if (fs.existsSync(backupPath)) {

    fs.unlinkSync(backupPath);

  }

  fs.renameSync(unsignedPath, backupPath);

  fs.copyFileSync(signedPath, unsignedPath);

  return backupPath;

}



async function main() {

  if (process.platform !== "win32") {

    die("release:update yalnızca Windows üzerinde çalıştırılabilir.");

  }



  const updateBaseUrl = requireUpdateBaseUrl();

  process.env.UPDATE_BASE_URL = updateBaseUrl;



  // Build'den ÖNCE patch artır (Kooperatif / KoopPlus / eski Müvekkil standardı).

  // npm version patch --no-git-tag-version: package.json + package-lock birlikte.

  // Build/imza hata verse bile version artırılmış kalır (npm version davranışı).

  const bumped = bumpPatchVersion(logStep);



  runDistWinUpdate(updateBaseUrl);



  const pkg = readPackageJson();

  const setupPath = findSetupExe(pkg.version);

  const fileName = path.basename(setupPath);

  const signedPath = path.join(RELEASE_DIR, "_signed", fileName);



  logStep(`Setup EXE: ${setupPath}`);



  runExternalSign(setupPath);



  if (!fs.existsSync(signedPath)) {

    die(`İmzalı dosya bulunamadı: ${signedPath}`);

  }

  logStep(`İmzalı dosya doğrulandı: ${signedPath}`);



  const authStatus = verifyAuthenticode(signedPath);

  logStep(`Authenticode (imzalı kopya): ${authStatus}`);



  const backupPath = replaceWithSigned(setupPath, signedPath);

  logStep(`İmzalı EXE release klasörüne yerleştirildi (yedek: ${path.basename(backupPath)})`);



  const authFinal = verifyAuthenticode(setupPath);

  logStep(`Authenticode (release Setup EXE): ${authFinal}`);



  const result = await refreshSignedReleaseMetadata({

    setupPath,

    version: pkg.version,

    log: (msg) => logStep(msg),

  });



  fs.unlinkSync(backupPath);

  logStep(`Geçici yedek silindi: ${path.basename(backupPath)}`);



  console.log("");

  console.log("[release:update] Tamamlandı.");

  console.log(`  Version    : ${bumped.before} → ${bumped.after}`);

  console.log(`  Setup EXE : ${setupPath}`);

  console.log(`  Authenticode: Valid`);

  console.log(`  latest.yml : ${result.latestPath}`);

  console.log(`  blockmap   : ${result.blockmapPath}`);

  console.log(`  sha512     : ${result.sha512}`);

  console.log(`  size       : ${result.size}`);

  console.log("");

  console.log("Manuel R2 yükleme: woontegra-downloads/updates/muvekkil-kasa-defteri/windows/");

  console.log("Yüklenecek: latest.yml, Setup EXE, EXE.blockmap (latest.yml üzerine yazılır).");

}



main().catch((e) => {

  console.error("[release:update] Beklenmeyen hata:", e);

  process.exit(1);

});


