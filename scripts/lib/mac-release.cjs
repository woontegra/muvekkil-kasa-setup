"use strict";

/**
 * macOS yayın akışının yan etkisiz yardımcıları. Ağ, imzalama veya Apple çağrısı yapmaz;
 * scripts/release-mac.cjs ve scripts/test-mac-release.cjs tarafından kullanılır.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TEAM_ID = "XXXS72FB42";
const ARCH = "arm64";

/** Bunlardan biri tanımlıysa electron-builder anahtarlık profili yerine onları kullanır. */
const COMPETING_NOTARY_ENV = [
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_API_KEY",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER",
];

/** Test paketi veya geliştirme izolasyonu değişkenleri yayın derlemesine sızmamalı. */
const FORBIDDEN_RELEASE_ENV = ["MKD_TEST_DB", "LICENSE_API_BASE", "MKD_RENDERER"];
/** electron-vite bu önekli değişkenleri derlenen koda gömer. */
const FORBIDDEN_RELEASE_ENV_PREFIXES = ["MAIN_VITE_", "PRELOAD_VITE_", "RENDERER_VITE_", "VITE_"];

class ReleaseError extends Error {}

function fail(message) {
  throw new ReleaseError(message);
}

function checkReleaseEnv(env) {
  const profile = (env.APPLE_KEYCHAIN_PROFILE || "").trim();
  if (!profile) {
    fail(
      "APPLE_KEYCHAIN_PROFILE tanımlı değil. Noter onayı olmadan yayın paketi üretilmez.\n" +
        "Örnek: APPLE_KEYCHAIN_PROFILE=bilirkisi-notary npm run dist:mac",
    );
  }
  const competing = COMPETING_NOTARY_ENV.filter((k) => env[k]);
  if (competing.length) {
    fail(`Anahtarlık profiliyle çakışan noter değişkenleri tanımlı: ${competing.join(", ")}. Bunları kaldırın.`);
  }
  const forbidden = Object.keys(env).filter(
    (k) => FORBIDDEN_RELEASE_ENV.includes(k) || FORBIDDEN_RELEASE_ENV_PREFIXES.some((p) => k.startsWith(p)),
  );
  if (forbidden.length) {
    fail(`Test/geliştirme değişkenleri yayın derlemesinde tanımlı olamaz: ${forbidden.join(", ")}`);
  }
  if (env.CSC_IDENTITY_AUTO_DISCOVERY === "false") {
    fail("CSC_IDENTITY_AUTO_DISCOVERY=false iken imzalı yayın paketi üretilemez.");
  }
  if (env.CSC_LINK || env.CSC_NAME) {
    fail("CSC_LINK / CSC_NAME tanımlı. Yayın akışı yalnızca anahtarlıktaki Developer ID kimliğini kullanır; bunları kaldırın.");
  }
  return { profile };
}

/** `security find-identity -v -p codesigning` çıktısından ekibe ait tek Developer ID Application adını seçer. */
function pickSigningIdentity(findIdentityOutput, teamId = TEAM_ID) {
  const names = [];
  for (const line of findIdentityOutput.split("\n")) {
    const m = line.match(/^\s*\d+\)\s+[0-9A-F]{40}\s+"(Developer ID Application: .+ \(([A-Z0-9]{10})\))"\s*$/);
    if (m && m[2] === teamId) names.push(m[1]);
  }
  const unique = [...new Set(names)];
  if (unique.length === 0) fail(`Ekip ${teamId} için geçerli "Developer ID Application" imza kimliği bulunamadı.`);
  if (unique.length > 1) fail(`Ekip ${teamId} için birden fazla Developer ID Application kimliği var; hangisinin kullanılacağı belirsiz.`);
  return unique[0];
}

/** electron-builder `mac.identity` değerini sertifika türü öneki olmadan ister. */
function identityQualifier(identityName) {
  const prefix = "Developer ID Application: ";
  if (!identityName.startsWith(prefix)) fail(`Beklenmeyen imza kimliği biçimi: ${identityName}`);
  return identityName.slice(prefix.length);
}

function artifactNames(version, arch = ARCH) {
  const base = `Woontegra-Muvekkil-Kasa-Defteri-${version}-mac-${arch}`;
  return { zip: `${base}.zip`, dmg: `${base}.dmg` };
}

function releaseOutputDir(projectDir, version, arch = ARCH) {
  return path.join(projectDir, "release", `mac-${version}-${arch}`);
}

function checkOutputDirFree(dir) {
  if (fs.existsSync(dir)) {
    fail(`Çıktı klasörü zaten var, üzerine yazılmaz: ${dir}\nSürümü yükseltin veya klasörü bilinçli olarak taşıyın.`);
  }
}

async function fileDigest(filePath) {
  const sha512 = crypto.createHash("sha512");
  const sha256 = crypto.createHash("sha256");
  let size = 0;
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("data", (chunk) => {
        sha512.update(chunk);
        sha256.update(chunk);
        size += chunk.length;
      })
      .on("error", reject)
      .on("end", resolve);
  });
  return { sha512: sha512.digest("base64"), sha256: sha256.digest("hex"), size };
}

/** electron-builder'ın macOS için ürettiği latest-mac.yml biçimi; ZIP güncelleme dosyası, DMG ilk kurulum içindir. */
function buildLatestMacYml({ version, zip, dmg, releaseDate }) {
  return [
    `version: ${version}`,
    "files:",
    `  - url: ${zip.url}`,
    `    sha512: ${zip.sha512}`,
    `    size: ${zip.size}`,
    `  - url: ${dmg.url}`,
    `    sha512: ${dmg.sha512}`,
    `    size: ${dmg.size}`,
    `path: ${zip.url}`,
    `sha512: ${zip.sha512}`,
    `releaseDate: '${releaseDate}'`,
    "",
  ].join("\n");
}

/** latest-mac.yml içindeki her dosyanın hash ve boyutunu diskteki gerçek dosyayla karşılaştırır. */
async function verifyLatestMacYml(ymlText, dir, version) {
  const get = (re) => {
    const m = ymlText.match(re);
    return m ? m[1] : null;
  };
  if (get(/^version: (.+)$/m) !== version) fail(`latest-mac.yml sürümü ${version} değil.`);
  const entries = [...ymlText.matchAll(/- url: (.+)\n\s+sha512: (.+)\n\s+size: (\d+)/g)].map((m) => ({
    url: m[1],
    sha512: m[2],
    size: Number(m[3]),
  }));
  const names = artifactNames(version);
  const urls = entries.map((e) => e.url).sort();
  if (JSON.stringify(urls) !== JSON.stringify([names.dmg, names.zip].sort())) {
    fail(`latest-mac.yml beklenen ZIP ve DMG girdilerini içermiyor: ${urls.join(", ")}`);
  }
  for (const e of entries) {
    const actual = await fileDigest(path.join(dir, e.url));
    if (actual.sha512 !== e.sha512 || actual.size !== e.size) {
      fail(`latest-mac.yml ile dosya uyuşmuyor: ${e.url}`);
    }
  }
  const zipEntry = entries.find((e) => e.url === names.zip);
  if (get(/^path: (.+)$/m) !== names.zip || get(/^sha512: (.+)$/m) !== zipEntry.sha512) {
    fail("latest-mac.yml üst düzey path/sha512 ZIP dosyasını göstermiyor.");
  }
  return entries;
}

function isAsciiName(name) {
  return /^[\x20-\x7E]+$/.test(name);
}

module.exports = {
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
};
