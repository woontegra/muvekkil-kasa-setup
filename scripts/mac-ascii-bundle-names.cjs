"use strict";

/**
 * macOS 26 + Electron abort at launch (EXC_BREAKPOINT / brk 0 in ContentMain)
 * when the packaged executable and helper names contain non-ASCII letters
 * ("ü" in "Müvekkil"). The main executable gets an ASCII name and helpers use
 * Electron's default "Electron Helper*" names, which Electron resolves before
 * CFBundleName. CFBundleName, CFBundleDisplayName and the .app folder keep the
 * Turkish product name. Windows packaging is untouched.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ELECTRON_HELPER_PREFIX = "Electron";

const TURKISH_ASCII = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

function toAsciiMacExecutableName(name) {
  const ascii = name.normalize("NFC").replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH_ASCII[ch]);
  if (!/^[\x20-\x7E]+$/.test(ascii)) {
    throw new Error(`ASCII olmayan karakter kaldı: ${ascii}`);
  }
  return ascii;
}

function readPlist(plistPath) {
  const json = execFileSync("plutil", ["-convert", "json", "-o", "-", plistPath], {
    encoding: "utf8",
  });
  return JSON.parse(json);
}

function setPlistString(plistPath, key, value) {
  execFileSync("plutil", ["-replace", key, "-string", value, plistPath], { stdio: "pipe" });
}

function findChild(dir, expectedName) {
  const want = expectedName.normalize("NFC");
  const found = fs.readdirSync(dir).find((name) => name.normalize("NFC") === want);
  if (!found) {
    throw new Error(`Paket içinde bulunamadı: ${path.join(dir, expectedName)}`);
  }
  return path.join(dir, found);
}

function renameBundleExecutable(bundlePath, newName) {
  const plistPath = path.join(bundlePath, "Contents", "Info.plist");
  const executableName = readPlist(plistPath).CFBundleExecutable;
  if (typeof executableName !== "string" || !executableName) {
    throw new Error(`CFBundleExecutable yok: ${plistPath}`);
  }
  const executablePath = findChild(path.join(bundlePath, "Contents", "MacOS"), executableName);
  if (path.basename(executablePath) !== newName) {
    fs.renameSync(executablePath, path.join(path.dirname(executablePath), newName));
  }
  if (executableName !== newName) {
    setPlistString(plistPath, "CFBundleExecutable", newName);
  }
}

function listAppBundles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".app"))
    .map((name) => path.join(dir, name));
}

function electronHelperName(helperDirName, productName) {
  const base = helperDirName.normalize("NFC").replace(/\.app$/, "");
  const prefix = productName.normalize("NFC");
  if (base.startsWith(`${prefix} Helper`)) {
    return ELECTRON_HELPER_PREFIX + base.slice(prefix.length);
  }
  if (base.startsWith(`${ELECTRON_HELPER_PREFIX} Helper`)) return base;
  throw new Error(`Beklenmeyen helper adı: ${helperDirName}`);
}

async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const bundles = listAppBundles(context.appOutDir);
  if (bundles.length !== 1) {
    throw new Error(`macOS paket klasöründe tek .app bekleniyor: ${context.appOutDir}`);
  }

  const appPath = bundles[0];
  const productName = context.packager.appInfo.productName;
  const executableName = toAsciiMacExecutableName(productName);
  renameBundleExecutable(appPath, executableName);

  const frameworksPath = path.join(appPath, "Contents", "Frameworks");
  for (const helperPath of listAppBundles(frameworksPath)) {
    const helperName = electronHelperName(path.basename(helperPath), productName);
    renameBundleExecutable(helperPath, helperName);
    const dest = path.join(frameworksPath, `${helperName}.app`);
    if (helperPath !== dest) fs.renameSync(helperPath, dest);
  }

  console.log(`[mac-bundle] executable=${executableName}, helpers=${ELECTRON_HELPER_PREFIX} Helper*`);
}

module.exports = afterPack;
module.exports.toAsciiMacExecutableName = toAsciiMacExecutableName;
module.exports.electronHelperName = electronHelperName;
