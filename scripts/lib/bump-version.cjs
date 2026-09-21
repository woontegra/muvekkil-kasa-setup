/**
 * Patch sürüm artırma (major/minor yok).
 * npm version patch --no-git-tag-version:
 * - package.json günceller
 * - package-lock.json günceller
 * - git commit/tag oluşturmaz
 * Build hata verse bile sürüm artırılmış kalır (npm version davranışı).
 */
const { spawnSync } = require("child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, readPackageJson } = require("./release-metadata.cjs");

const BRANDING_PATH = path.join(ROOT, "src", "shared", "branding.ts");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function syncBrandingVersion(version) {
  if (!fs.existsSync(BRANDING_PATH)) {
    return;
  }
  const before = fs.readFileSync(BRANDING_PATH, "utf8");
  if (!/export const APP_VERSION = '[^']*'/.test(before)) {
    return;
  }
  const after = before.replace(
    /export const APP_VERSION = '[^']*'/,
    `export const APP_VERSION = '${version}'`,
  );
  if (after !== before) {
    fs.writeFileSync(BRANDING_PATH, after, "utf8");
  }
}

/**
 * @param {(msg: string) => void} [log]
 * @returns {{ before: string, after: string }}
 */
function bumpPatchVersion(log = console.log) {
  const before = String(readPackageJson().version || "").trim();
  if (!/^\d+\.\d+\.\d+/.test(before)) {
    die(`Geçersiz package.json version: ${before}`);
  }

  log(`Mevcut sürüm: ${before}`);
  log("Patch sürüm artırılıyor (npm version patch --no-git-tag-version)…");

  const r = spawnSync("npm.cmd", ["version", "patch", "--no-git-tag-version"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (r.status !== 0) {
    die(`Sürüm artırılamadı (exit ${r.status ?? 1}).`, r.status ?? 1);
  }

  const after = String(readPackageJson().version || "").trim();
  if (!after || after === before) {
    die(`Sürüm artışı doğrulanamadı (önce: ${before}, sonra: ${after}).`);
  }

  syncBrandingVersion(after);
  log(`Sürüm artırıldı: ${before} → ${after}`);
  log("package.json + package-lock.json güncellendi; git commit/tag yok.");

  return { before, after };
}

module.exports = {
  bumpPatchVersion,
  syncBrandingVersion,
};
