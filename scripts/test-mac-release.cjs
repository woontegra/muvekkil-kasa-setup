#!/usr/bin/env node
"use strict";

/**
 * macOS yayın akışının ağsız doğrulaması: ön koşul reddi, imza kimliği seçimi, blockmap ve
 * latest-mac.yml'nin gerçek dosya hash/boyutlarıyla üretimi, package.json yapılandırması.
 * İmzalama, Apple'a başvuru veya paketleme yapmaz.
 */
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { appBuilderPath } = require("app-builder-bin");
const lib = require("./lib/mac-release.cjs");
const afterPack = require("./mac-ascii-bundle-names.cjs");

const projectDir = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL ${name}`);
  }
}

function throwsRelease(name, fn, pattern) {
  try {
    fn();
    check(`${name} (hata bekleniyordu)`, false);
  } catch (e) {
    check(name, e instanceof lib.ReleaseError && (!pattern || pattern.test(e.message)));
  }
}

async function rejectsRelease(name, promise, pattern) {
  try {
    await promise;
    check(`${name} (hata bekleniyordu)`, false);
  } catch (e) {
    check(name, e instanceof lib.ReleaseError && (!pattern || pattern.test(e.message)));
  }
}

const BASE_ENV = { PATH: "/usr/bin:/bin", HOME: "/tmp" };

function envChecks() {
  throwsRelease("profil yoksa durur", () => lib.checkReleaseEnv(BASE_ENV), /APPLE_KEYCHAIN_PROFILE/);
  throwsRelease("boş profil durur", () => lib.checkReleaseEnv({ ...BASE_ENV, APPLE_KEYCHAIN_PROFILE: "  " }), /APPLE_KEYCHAIN_PROFILE/);
  const ok = { ...BASE_ENV, APPLE_KEYCHAIN_PROFILE: "bilirkisi-notary" };
  check("geçerli profil kabul", lib.checkReleaseEnv(ok).profile === "bilirkisi-notary");
  for (const k of ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) {
    throwsRelease(`${k} çakışması durur`, () => lib.checkReleaseEnv({ ...ok, [k]: "x" }), new RegExp(k));
  }
  for (const k of ["MAIN_VITE_MKD_TEST_PACKAGE", "VITE_X", "RENDERER_VITE_X", "PRELOAD_VITE_X", "MKD_TEST_DB", "LICENSE_API_BASE", "MKD_RENDERER"]) {
    throwsRelease(`${k} test değişkeni durur`, () => lib.checkReleaseEnv({ ...ok, [k]: "1" }), new RegExp(k));
  }
  throwsRelease("imza keşfi kapalıysa durur", () => lib.checkReleaseEnv({ ...ok, CSC_IDENTITY_AUTO_DISCOVERY: "false" }));
  throwsRelease("CSC_LINK durur", () => lib.checkReleaseEnv({ ...ok, CSC_LINK: "/x.p12" }));
  throwsRelease("CSC_NAME durur", () => lib.checkReleaseEnv({ ...ok, CSC_NAME: "x" }));
  check("ELECTRON_RUN_AS_NODE engel değil", lib.checkReleaseEnv({ ...ok, ELECTRON_RUN_AS_NODE: "1" }).profile === "bilirkisi-notary");
}

function identityChecks() {
  const h = (c) => c.repeat(40);
  const own = `Developer ID Application: WOONTEGRA TEST (${lib.TEAM_ID})`;
  const line = (hash, name) => `  1) ${hash} "${name}"`;
  const footer = "     1 valid identities found";
  check("tek kimlik seçilir", lib.pickSigningIdentity([line(h("A"), own), footer].join("\n")) === own);
  check(
    "aynı kimlik iki kez listelenirse tek sayılır",
    lib.pickSigningIdentity([line(h("A"), own), line(h("A"), own), footer].join("\n")) === own,
  );
  check("electron-builder için önek kaldırılır", lib.identityQualifier(own) === `WOONTEGRA TEST (${lib.TEAM_ID})`);
  throwsRelease("öneksiz kimlik beklenmez", () => lib.identityQualifier("Apple Development: X"), /biçimi/);
  throwsRelease("kimlik yoksa durur", () => lib.pickSigningIdentity("     0 valid identities found"), /bulunamadı/);
  throwsRelease(
    "başka ekip seçilmez",
    () => lib.pickSigningIdentity(line(h("B"), "Developer ID Application: Baska (ABCDE12345)")),
    /bulunamadı/,
  );
  throwsRelease(
    "Apple Development kabul edilmez",
    () => lib.pickSigningIdentity(line(h("C"), `Apple Development: Kisi (${lib.TEAM_ID})`)),
    /bulunamadı/,
  );
  throwsRelease(
    "iki farklı kimlik belirsizdir",
    () => lib.pickSigningIdentity([line(h("A"), own), line(h("D"), `Developer ID Application: Diger (${lib.TEAM_ID})`)].join("\n")),
    /birden fazla/,
  );
}

function configChecks() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(projectDir, "package-lock.json"), "utf8"));
  check("package.json sürümü 0.1.15", pkg.version === "0.1.15");
  check("package-lock sürümü eşit", lock.version === pkg.version && lock.packages[""].version === pkg.version);
  check("dist:mac yayın betiğini çalıştırır", pkg.scripts["dist:mac"] === "node scripts/release-mac.cjs");
  check("dist:mac doğrudan electron-builder çağırmaz", !/electron-builder/.test(pkg.scripts["dist:mac"]));
  check("dmg.sign açık", pkg.build.dmg && pkg.build.dmg.sign === true);
  check("afterPack ASCII betiği", pkg.build.afterPack === "scripts/mac-ascii-bundle-names.cjs");
  check("hardenedRuntime açık", pkg.build.mac.hardenedRuntime === true);
  check("notarize kapatılmamış", pkg.build.mac.notarize !== false);
  check("identity null değil", pkg.build.mac.identity !== null);
  check("forceCodeSigning genelde zorlanmaz (Windows etkilenmez)", pkg.build.forceCodeSigning === undefined);
  const pub = pkg.build.mac.publish;
  check(
    "mac yayın adresi macos klasörü",
    Array.isArray(pub) && pub.length === 1 && pub[0].provider === "generic" &&
      pub[0].url === "https://updates.woontegra.com/updates/muvekkil-kasa-defteri/macos",
  );
  const names = lib.artifactNames(pkg.version);
  const expected = pkg.build.mac.artifactName.replace("${version}", pkg.version).replace("${arch}", "arm64");
  check("ZIP adı artifactName ile aynı", names.zip === expected.replace("${ext}", "zip"));
  check("DMG adı artifactName ile aynı", names.dmg === expected.replace("${ext}", "dmg"));
  check(
    "çıktı klasörü sürüme özel",
    lib.releaseOutputDir(projectDir, pkg.version) === path.join(projectDir, "release", "mac-0.1.15-arm64"),
  );
}

function afterPackChecks() {
  const diff = spawnSync("git", ["diff", "--quiet", "HEAD", "--", "scripts/mac-ascii-bundle-names.cjs"], { cwd: projectDir });
  check("ASCII adlandırma betiği değişmemiş", diff.status === 0);
  const product = "Woontegra Müvekkil Kasa Defteri";
  check("ana çalıştırılabilir ASCII", afterPack.toAsciiMacExecutableName(product) === "Woontegra Muvekkil Kasa Defteri");
  check(
    "NFD ü dönüşür",
    afterPack.toAsciiMacExecutableName(product.normalize("NFD")) === "Woontegra Muvekkil Kasa Defteri",
  );
  for (const suffix of ["", " (GPU)", " (Plugin)", " (Renderer)"]) {
    check(
      `helper${suffix || " ana"} Electron Helper olur`,
      afterPack.electronHelperName(`${product} Helper${suffix}.app`, product) === `Electron Helper${suffix}`,
    );
  }
  check("isAsciiName Türkçe reddeder", !lib.isAsciiName("Müvekkil") && lib.isAsciiName("Electron Helper (GPU)"));
}

async function artifactChecks() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mkd-mac-release-test-"));
  try {
    const version = "0.1.15";
    const names = lib.artifactNames(version);
    const zipPath = path.join(tmp, names.zip);
    const dmgPath = path.join(tmp, names.dmg);
    fs.writeFileSync(zipPath, crypto.randomBytes(1_500_000));
    fs.writeFileSync(dmgPath, crypto.randomBytes(2_100_000));

    const d = await lib.fileDigest(dmgPath);
    const buf = fs.readFileSync(dmgPath);
    check("fileDigest sha512", d.sha512 === crypto.createHash("sha512").update(buf).digest("base64"));
    check("fileDigest sha256", d.sha256 === crypto.createHash("sha256").update(buf).digest("hex"));
    check("fileDigest boyut", d.size === buf.length);

    const bm = spawnSync(appBuilderPath, ["blockmap", "--input", dmgPath, "--output", `${dmgPath}.blockmap`], { encoding: "utf8" });
    check("blockmap aracı çalışır", bm.status === 0);
    const reported = JSON.parse(bm.stdout);
    check("blockmap aracı aynı hash/boyutu ölçer", reported.sha512 === d.sha512 && reported.size === d.size);
    const map = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${dmgPath}.blockmap`)).toString("utf8"));
    const blockTotal = map.files[0].sizes.reduce((a, b) => a + b, 0);
    check("blockmap blokları dosya boyutunu kapsar", blockTotal === d.size);

    const zip = { url: names.zip, ...(await lib.fileDigest(zipPath)) };
    const dmgBefore = { url: names.dmg, ...d };
    const releaseDate = "2026-10-11T12:00:00.000Z";
    const ymlBefore = lib.buildLatestMacYml({ version, zip, dmg: dmgBefore, releaseDate });
    await lib.verifyLatestMacYml(ymlBefore, tmp, version);
    check("üretilen yml doğrulanır", true);

    const { parseUpdateInfo } = require("electron-updater/out/providers/Provider");
    const info = parseUpdateInfo(ymlBefore, "latest-mac.yml", new URL("https://example.invalid/"));
    check("electron-updater yml'yi okur", info.version === version && info.files.length === 2);
    check("electron-updater ZIP'i path olarak görür", info.path === names.zip && info.sha512 === zip.sha512);
    check("releaseDate korunur", info.releaseDate === releaseDate);
    check("ZIP girdisi", info.files.some((f) => f.url === names.zip && f.sha512 === zip.sha512 && f.size === zip.size));

    fs.appendFileSync(dmgPath, crypto.randomBytes(9000));
    await rejectsRelease("staple sonrası eski yml reddedilir", lib.verifyLatestMacYml(ymlBefore, tmp, version), /uyuşmuyor/);
    const dmgAfter = { url: names.dmg, ...(await lib.fileDigest(dmgPath)) };
    const ymlAfter = lib.buildLatestMacYml({ version, zip, dmg: dmgAfter, releaseDate });
    await lib.verifyLatestMacYml(ymlAfter, tmp, version);
    check("yeniden üretilen yml doğrulanır", ymlAfter.includes(`size: ${dmgAfter.size}`));
    check("ZIP girdisi değişmez", ymlAfter.includes(`sha512: ${zip.sha512}\n    size: ${zip.size}`));

    await rejectsRelease("yanlış sürüm reddedilir", lib.verifyLatestMacYml(ymlAfter, tmp, "0.1.14"), /sürümü/);
    const noDmg = ymlAfter.replace(/  - url: .+\.dmg\n.+\n.+\n/, "");
    await rejectsRelease("DMG girdisi eksikse reddedilir", lib.verifyLatestMacYml(noDmg, tmp, version), /ZIP ve DMG/);
    const wrongPath = ymlAfter.replace(`path: ${names.zip}`, `path: ${names.dmg}`);
    await rejectsRelease("path DMG gösterirse reddedilir", lib.verifyLatestMacYml(wrongPath, tmp, version), /path/);

    const existing = path.join(tmp, "var");
    fs.mkdirSync(existing);
    throwsRelease("var olan çıktı klasörü reddedilir", () => lib.checkOutputDirFree(existing), /üzerine yazılmaz/);
    lib.checkOutputDirFree(path.join(tmp, "yok"));
    check("olmayan çıktı klasörü kabul", true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cliChecks() {
  const script = path.join(projectDir, "scripts", "release-mac.cjs");
  const runCli = (env) => spawnSync(process.execPath, [script, "--preflight"], { cwd: projectDir, env, encoding: "utf8" });
  const base = { PATH: process.env.PATH, HOME: process.env.HOME };

  const noProfile = runCli(base);
  check("betik profilsiz hata koduyla durur", noProfile.status === 1 && /DURDURULDU: APPLE_KEYCHAIN_PROFILE/.test(noProfile.stderr));

  const testPkg = runCli({ ...base, APPLE_KEYCHAIN_PROFILE: "bilirkisi-notary", MAIN_VITE_MKD_TEST_PACKAGE: "1" });
  check("betik test paketi bayrağıyla durur", testPkg.status === 1 && /MAIN_VITE_MKD_TEST_PACKAGE/.test(testPkg.stderr));

  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: projectDir, encoding: "utf8" }).stdout.trim() !== "";
  if (dirty) {
    const r = runCli({ ...base, APPLE_KEYCHAIN_PROFILE: "bilirkisi-notary" });
    check("betik commit edilmemiş kodla durur", r.status === 1 && /temiz değil/.test(r.stderr));
  }
}

(async () => {
  envChecks();
  identityChecks();
  configChecks();
  afterPackChecks();
  await artifactChecks();
  cliChecks();
  console.log(`test-mac-release: ${passed} geçti, ${failed} başarısız`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
