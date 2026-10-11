#!/usr/bin/env node
"use strict";

/**
 * macOS arm64 yayın paketi: derleme → APP imzası + noter onayı (electron-builder) → DMG imzası →
 * DMG noter onayı + staple → blockmap ve latest-mac.yml'nin son dosyalardan yeniden üretimi.
 * Herhangi bir ön koşul veya doğrulama başarısız olursa paket "hazır" sayılmaz ve süreç hata koduyla durur.
 * Hiçbir sunucuya yükleme yapmaz.
 *
 *   APPLE_KEYCHAIN_PROFILE=bilirkisi-notary npm run dist:mac
 *   APPLE_KEYCHAIN_PROFILE=bilirkisi-notary npm run release:mac:preflight   (yalnızca ön koşullar)
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { appBuilderPath } = require("app-builder-bin");
const {
  ARCH,
  TEAM_ID,
  ReleaseError,
  artifactNames,
  buildLatestMacYml,
  checkOutputDirFree,
  checkReleaseEnv,
  fileDigest,
  identityQualifier,
  isAsciiName,
  pickSigningIdentity,
  releaseOutputDir,
  verifyLatestMacYml,
} = require("./lib/mac-release.cjs");

const projectDir = path.resolve(__dirname, "..");
const preflightOnly = process.argv.includes("--preflight");

function step(msg) {
  console.log(`\n[release:mac] ${msg}`);
}

function fail(msg) {
  throw new ReleaseError(msg);
}

function run(cmd, args, { capture = false, env = process.env, cwd = projectDir } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) fail(`${cmd} başlatılamadı: ${r.error.message}`);
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function mustRun(cmd, args, opts) {
  const r = run(cmd, args, opts);
  if (r.status !== 0) {
    if (opts && opts.capture) process.stderr.write(r.stderr);
    fail(`${path.basename(cmd)} ${args[0] || ""} başarısız (çıkış ${r.status}).`);
  }
  return r;
}

function plistValue(plistPath, key) {
  return mustRun("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plistPath], { capture: true }).stdout.trim();
}

function preflight() {
  if (process.platform !== "darwin") fail("macOS yayın paketi yalnızca macOS üzerinde üretilebilir.");
  const { profile } = checkReleaseEnv(process.env);

  const status = mustRun("git", ["status", "--porcelain"], { capture: true }).stdout.trim();
  if (status) fail("Git çalışma alanı temiz değil; yayın paketi yalnızca commit edilmiş koddan üretilir.");
  const commit = mustRun("git", ["rev-parse", "--short", "HEAD"], { capture: true }).stdout.trim();

  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
  const outDir = releaseOutputDir(projectDir, pkg.version);
  checkOutputDirFree(outDir);

  const identities = mustRun("/usr/bin/security", ["find-identity", "-v", "-p", "codesigning"], { capture: true });
  const identity = pickSigningIdentity(identities.stdout);

  const notary = run("xcrun", ["notarytool", "history", "--keychain-profile", profile, "--output-format", "json"], {
    capture: true,
  });
  if (notary.status !== 0) {
    fail(`Noter profili "${profile}" kullanılamıyor (notarytool history çıkış ${notary.status}).`);
  }

  console.log(`[release:mac] commit ${commit}, sürüm ${pkg.version}, ekip ${TEAM_ID}`);
  console.log(`[release:mac] imza kimliği bulundu, noter profili "${profile}" erişilebilir`);
  console.log(`[release:mac] çıktı: ${path.relative(projectDir, outDir)}`);
  return { profile, commit, version: pkg.version, productName: pkg.build.productName, outDir, identity };
}

function buildEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_RENDERER_URL;
  return env;
}

function verifySignature(target, { kind }) {
  mustRun("codesign", ["--verify", "--deep", "--strict", target], { capture: true });
  const info = mustRun("codesign", ["-dv", "--verbose=4", target], { capture: true }).stderr;
  if (!info.includes(`TeamIdentifier=${TEAM_ID}`)) fail(`${kind} ${TEAM_ID} ekibiyle imzalı değil.`);
  if (!/^Authority=Developer ID Application: /m.test(info)) fail(`${kind} Developer ID Application ile imzalı değil.`);
  if (kind === "APP" && !/flags=0x[0-9a-f]+\([^)]*runtime[^)]*\)/.test(info)) fail("APP hardened runtime ile imzalı değil.");
}

function verifyGatekeeper(target, type) {
  const args = type === "exec" ? ["-a", "-t", "exec", "-vv", target] : ["-a", "-t", "open", "--context", "context:primary-signature", "-vv", target];
  const r = mustRun("spctl", args, { capture: true });
  if (!/source=Notarized Developer ID/.test(r.stderr)) fail(`Gatekeeper ${path.basename(target)} için noter onayı görmüyor.`);
}

function verifyAppBundle(appPath, version) {
  verifySignature(appPath, { kind: "APP" });
  mustRun("xcrun", ["stapler", "validate", appPath], { capture: true });
  verifyGatekeeper(appPath, "exec");

  const plist = path.join(appPath, "Contents", "Info.plist");
  if (plistValue(plist, "CFBundleShortVersionString") !== version) fail(`APP sürümü ${version} değil.`);
  const executable = plistValue(plist, "CFBundleExecutable");
  if (!isAsciiName(executable)) fail(`Ana çalıştırılabilir ad ASCII değil: ${executable}`);
  const frameworks = path.join(appPath, "Contents", "Frameworks");
  const helpers = fs.readdirSync(frameworks).filter((n) => n.endsWith(".app"));
  if (helpers.length === 0) fail("Yardımcı işlem paketleri bulunamadı.");
  for (const h of helpers) {
    const exe = plistValue(path.join(frameworks, h, "Contents", "Info.plist"), "CFBundleExecutable");
    if (!h.startsWith("Electron Helper") || !isAsciiName(h) || !isAsciiName(exe)) fail(`Yardımcı işlem adı uygun değil: ${h}`);
  }
}

function findSingleApp(dir) {
  const apps = fs.readdirSync(dir).filter((n) => n.endsWith(".app"));
  if (apps.length !== 1) fail(`${dir} içinde tek .app bekleniyordu (${apps.length}).`);
  return path.join(dir, apps[0]);
}

function verifyZip(zipPath, version) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mkd-release-zip-"));
  try {
    mustRun("ditto", ["-x", "-k", zipPath, tmp], { capture: true });
    verifyAppBundle(findSingleApp(tmp), version);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function notarizeDmg(dmgPath, profile) {
  const r = run(
    "xcrun",
    ["notarytool", "submit", dmgPath, "--keychain-profile", profile, "--wait", "--output-format", "json"],
    { capture: true },
  );
  let result = null;
  try {
    result = JSON.parse(r.stdout);
  } catch {
    /* aşağıda hata verilir */
  }
  if (!result || !result.id) fail(`DMG noter başvurusu yanıtı okunamadı (çıkış ${r.status}).`);
  if (result.status !== "Accepted") {
    run("xcrun", ["notarytool", "log", result.id, "--keychain-profile", profile]);
    fail(`DMG noter onayı reddedildi: ${result.status} (${result.id})`);
  }
  console.log(`[release:mac] DMG noter onayı: Accepted (${result.id})`);
}

async function writeBlockmap(filePath) {
  const out = mustRun(appBuilderPath, ["blockmap", "--input", filePath, "--output", `${filePath}.blockmap`], {
    capture: true,
  }).stdout;
  const reported = JSON.parse(out);
  const actual = await fileDigest(filePath);
  if (reported.sha512 !== actual.sha512 || reported.size !== actual.size) {
    fail(`Blockmap ${path.basename(filePath)} için yanlış dosyayı ölçtü.`);
  }
}

function readReleaseDate(ymlPath) {
  if (!fs.existsSync(ymlPath)) return new Date().toISOString();
  const m = fs.readFileSync(ymlPath, "utf8").match(/^releaseDate: '(.+)'$/m);
  return m ? m[1] : new Date().toISOString();
}

async function main() {
  step("ön koşullar");
  const ctx = preflight();
  if (preflightOnly) {
    console.log("\n[release:mac] ön koşullar tamam (--preflight: derleme yapılmadı).");
    return;
  }
  const env = buildEnv();

  step("derleme");
  mustRun("npm", ["run", "build"], { env });
  const leak = run("grep", ["-rlq", "-e", "TEST-PAKETI", "-e", "127.0.0.1:9/", path.join(projectDir, "out")], {
    capture: true,
  });
  if (leak.status === 0) fail("Derleme çıktısında test paketi izleri var; yayın durduruldu.");

  step("APP imzası, noter onayı, DMG ve ZIP (electron-builder)");
  mustRun(
    path.join(projectDir, "node_modules", ".bin", "electron-builder"),
    [
      "--mac",
      "dmg",
      "zip",
      `--${ARCH}`,
      "--publish",
      "never",
      `-c.directories.output=${ctx.outDir}`,
      "-c.forceCodeSigning=true",
      `-c.mac.identity=${identityQualifier(ctx.identity)}`,
      "-c.dmg.sign=true",
    ],
    { env },
  );

  const names = artifactNames(ctx.version);
  const zipPath = path.join(ctx.outDir, names.zip);
  const dmgPath = path.join(ctx.outDir, names.dmg);
  for (const p of [zipPath, dmgPath]) if (!fs.existsSync(p)) fail(`Beklenen çıktı yok: ${p}`);

  step("APP doğrulaması (imza, hardened runtime, staple, Gatekeeper, ASCII adlar)");
  verifyAppBundle(findSingleApp(path.join(ctx.outDir, `mac-${ARCH}`)), ctx.version);

  step("ZIP içindeki APP doğrulaması");
  verifyZip(zipPath, ctx.version);

  step("DMG imzası, noter onayı ve staple");
  verifySignature(dmgPath, { kind: "DMG" });
  notarizeDmg(dmgPath, ctx.profile);
  mustRun("xcrun", ["stapler", "staple", dmgPath], { capture: true });
  mustRun("xcrun", ["stapler", "validate", dmgPath], { capture: true });
  verifySignature(dmgPath, { kind: "DMG" });
  verifyGatekeeper(dmgPath, "open");

  step("blockmap ve latest-mac.yml son dosyalardan");
  await writeBlockmap(zipPath);
  await writeBlockmap(dmgPath);
  const ymlPath = path.join(ctx.outDir, "latest-mac.yml");
  const zip = { url: names.zip, ...(await fileDigest(zipPath)) };
  const dmg = { url: names.dmg, ...(await fileDigest(dmgPath)) };
  const yml = buildLatestMacYml({ version: ctx.version, zip, dmg, releaseDate: readReleaseDate(ymlPath) });
  fs.writeFileSync(ymlPath, yml);
  await verifyLatestMacYml(fs.readFileSync(ymlPath, "utf8"), ctx.outDir, ctx.version);

  step("tamam — hiçbir sunucuya yükleme yapılmadı");
  console.log(`commit ${ctx.commit}, sürüm ${ctx.version}`);
  for (const f of [zip, dmg]) console.log(`${f.url}  ${f.size} bayt  sha256 ${f.sha256}`);
  console.log(`klasör: ${ctx.outDir}`);
}

main().catch((err) => {
  if (err instanceof ReleaseError) {
    console.error(`\n[release:mac] DURDURULDU: ${err.message}`);
  } else {
    console.error("\n[release:mac] beklenmeyen hata:", err);
  }
  process.exit(1);
});
