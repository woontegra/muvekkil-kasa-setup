/**
 * Güncelleme paketi üretimi (Windows NSIS + latest.yml).
 * R2'ye yükleme yapmaz.
 * Öncelik: UPDATE_BASE_URL ortam değişkeni → package.json config.updateBaseUrl
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function resolveUpdateBaseUrl() {
  const fromEnv = (process.env.UPDATE_BASE_URL || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return String(pkg.config?.updateBaseUrl || "").trim();
  } catch {
    return "";
  }
}

const updateBaseUrl = resolveUpdateBaseUrl();

if (!updateBaseUrl) {
  console.error(
    "UPDATE_BASE_URL tanımlı değil ve package.json config.updateBaseUrl bulunamadı. Güncelleme paketi oluşturulamadı.",
  );
  process.exit(1);
}

if (!/^https:\/\//i.test(updateBaseUrl)) {
  console.error("UPDATE_BASE_URL / updateBaseUrl https:// ile başlamalıdır. Güncelleme paketi oluşturulamadı.");
  process.exit(1);
}

console.log("[dist:win:update] UPDATE_BASE_URL =", updateBaseUrl);
console.log("[dist:win:update] build…");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const build = spawnSync(npmCmd, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

console.log("[dist:win:update] electron-builder (NSIS, --publish never)…");

const builderArgs = [
  "electron-builder",
  "--win",
  "nsis",
  "--publish",
  "never",
  `-c.publish.provider=generic`,
  `-c.publish.url=${updateBaseUrl}`,
];

const pack = spawnSync(npxCmd, builderArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    UPDATE_BASE_URL: updateBaseUrl,
  },
});

if (pack.status !== 0) {
  process.exit(pack.status ?? 1);
}

console.log("");
console.log("[dist:win:update] Tamamlandı. R2'ye otomatik yükleme yapılmadı.");
console.log("Manuel yükleme hedefi: woontegra-downloads/updates/muvekkil-kasa-defteri/windows/");
console.log("Yüklenecek dosyalar (release/): latest.yml, Setup EXE, EXE.blockmap");
console.log("Not: latest.yml her yeni sürümde üzerine yazılır; eski Setup EXE dosyaları silinmez.");
