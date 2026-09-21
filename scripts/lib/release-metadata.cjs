/**
 * Ortak release metadata yardımcıları (SHA-512, blockmap, latest.yml).
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("child_process");
const { serializeToYaml } = require("builder-util");

const ROOT = path.join(__dirname, "..", "..");
const RELEASE_DIR = path.join(ROOT, "release");
const APP_BUILDER = path.join(ROOT, "node_modules", "app-builder-bin", "win", "x64", "app-builder.exe");

function calculateSha512Base64(filePath) {
  const hash = crypto.createHash("sha512");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("base64");
}

function calculateSha512Base64Async(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function expectedSetupName(version) {
  return `Woontegra-Muvekkil-Kasa-Defteri-Setup-${version}.exe`;
}

function findSetupExe(version) {
  const expected = expectedSetupName(version);
  const direct = path.join(RELEASE_DIR, expected);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const candidates = fs
    .readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        /^Woontegra-Muvekkil-Kasa-Defteri-Setup-.*\.exe$/i.test(e.name) &&
        !e.name.endsWith(".unsigned-backup"),
    )
    .map((e) => path.join(RELEASE_DIR, e.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`Setup EXE bulunamadı. Beklenen: release/${expected}`);
  }

  return candidates[0];
}

function verifyAuthenticode(filePath) {
  const escaped = filePath.replace(/'/g, "''");
  const cmd = [
    `$s = Get-AuthenticodeSignature -LiteralPath '${escaped}'`,
    `if ($s.Status -ne 'Valid') { Write-Error "Authenticode Status: $($s.Status)"; exit 1 }`,
    `Write-Output $s.Status`,
  ].join("; ");

  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
    encoding: "utf8",
    shell: false,
  });

  const status = (r.stdout || "").trim();
  if (r.status !== 0 || status !== "Valid") {
    const err = (r.stderr || r.stdout || status || "Status Valid değil").trim();
    throw new Error(`Authenticode doğrulaması başarısız: ${err}`);
  }
  return status;
}

function createBlockmap(exePath, log = console.log) {
  const blockmapPath = `${exePath}.blockmap`;
  if (fs.existsSync(blockmapPath)) {
    fs.unlinkSync(blockmapPath);
  }

  log(`Blockmap üretiliyor: ${path.basename(blockmapPath)}`);
  const r = spawnSync(
    APP_BUILDER,
    ["blockmap", "--input", exePath, "--output", blockmapPath, "--compression", "deflate"],
    { encoding: "utf8", shell: false },
  );

  if (r.status !== 0) {
    throw new Error(`Blockmap üretimi başarısız: ${(r.stderr || r.stdout || "").trim()}`);
  }

  if (!fs.existsSync(blockmapPath)) {
    throw new Error(`Blockmap dosyası oluşmadı: ${blockmapPath}`);
  }

  return blockmapPath;
}

function writeLatestYml(fileName, version, sha512, size) {
  const latestPath = path.join(RELEASE_DIR, "latest.yml");
  const info = {
    version,
    files: [{ url: fileName, sha512, size }],
    path: fileName,
    sha512,
    releaseDate: new Date().toISOString(),
  };
  fs.writeFileSync(latestPath, serializeToYaml(info, false, true));
  return latestPath;
}

function parseLatestYml(content) {
  const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim();
  const pathVal = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  const topSha512 = content.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
  const fileUrl = content.match(/^\s+-\s*url:\s*(.+)$/m)?.[1]?.trim();
  const fileSha512 = content.match(/^\s+sha512:\s*(.+)$/m)?.[1]?.trim();
  const fileSize = Number(content.match(/^\s+size:\s*(\d+)$/m)?.[1]);
  const releaseDate = content.match(/^releaseDate:\s*'?([^'\n]+)'?$/m)?.[1]?.trim();
  return { version, path: pathVal, sha512: topSha512, fileUrl, fileSha512, fileSize, releaseDate };
}

function verifyLatestYmlAgainstExe(setupPath, latestPath) {
  const exeSha512 = calculateSha512Base64(setupPath);
  const exeSize = fs.statSync(setupPath).size;
  const blockmapPath = `${setupPath}.blockmap`;
  const yml = parseLatestYml(fs.readFileSync(latestPath, "utf8"));

  const errors = [];
  if (exeSha512 !== yml.sha512) {
    errors.push(`EXE sha512 !== latest.yml sha512\n  EXE: ${exeSha512}\n  yml: ${yml.sha512}`);
  }
  if (exeSha512 !== yml.fileSha512) {
    errors.push(`EXE sha512 !== latest.yml files[0].sha512\n  EXE: ${exeSha512}\n  yml: ${yml.fileSha512}`);
  }
  if (exeSize !== yml.fileSize) {
    errors.push(`EXE size !== latest.yml files[0].size\n  EXE: ${exeSize}\n  yml: ${yml.fileSize}`);
  }
  if (!fs.existsSync(blockmapPath)) {
    errors.push(`Blockmap dosyası eksik: ${blockmapPath}`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return { exeSha512, exeSize, blockmapPath, yml };
}

async function refreshSignedReleaseMetadata({ setupPath, version, log = (msg) => console.log(msg) }) {
  const fileName = path.basename(setupPath);
  const latestPath = path.join(RELEASE_DIR, "latest.yml");
  const blockmapPath = `${setupPath}.blockmap`;

  if (fs.existsSync(blockmapPath)) {
    fs.unlinkSync(blockmapPath);
  }
  if (fs.existsSync(latestPath)) {
    fs.unlinkSync(latestPath);
  }

  createBlockmap(setupPath, log);

  const sha512 = await calculateSha512Base64Async(setupPath);
  const size = fs.statSync(setupPath).size;
  const writtenLatest = writeLatestYml(fileName, version, sha512, size);
  const verified = verifyLatestYmlAgainstExe(setupPath, writtenLatest);

  return {
    sha512: verified.exeSha512,
    size: verified.exeSize,
    blockmapPath: verified.blockmapPath,
    latestPath: writtenLatest,
    yml: verified.yml,
  };
}

module.exports = {
  ROOT,
  RELEASE_DIR,
  APP_BUILDER,
  calculateSha512Base64,
  calculateSha512Base64Async,
  readPackageJson,
  expectedSetupName,
  findSetupExe,
  verifyAuthenticode,
  createBlockmap,
  writeLatestYml,
  parseLatestYml,
  verifyLatestYmlAgainstExe,
  refreshSignedReleaseMetadata,
};
