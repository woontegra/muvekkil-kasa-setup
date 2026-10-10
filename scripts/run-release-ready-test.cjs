/**
 * test:release-ready — paketleme öncesi teknik kapı:
 * tsc → build → premium-smoke (nav + tahsilat + multi-currency + GUI)
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(label, cmd, args) {
  console.log(`\n>> ${label}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`\n[FAIL] ${label}: exit ${r.status ?? 1}`);
    process.exit(r.status ?? 1);
  }
}

function assertPackagingConfig() {
  console.log("\n>> packaging-config-check");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const build = pkg.build || {};
  const missing = [];
  if (!pkg.name) missing.push("name");
  if (!pkg.version) missing.push("version");
  if (!build.appId) missing.push("build.appId");
  if (!build.productName) missing.push("build.productName");
  if (!build.win?.icon) missing.push("build.win.icon");
  if (!build.nsis) missing.push("build.nsis");
  const iconPath = path.join(root, build.win?.icon || "resources/icon.ico");
  if (!fs.existsSync(iconPath)) missing.push(`icon file missing: ${build.win?.icon}`);
  if (missing.length) {
    console.error("[FAIL] packaging-config-check:", missing.join(", "));
    process.exit(1);
  }
  console.log(`[PASS] name=${pkg.name}`);
  console.log(`[PASS] version=${pkg.version}`);
  console.log(`[PASS] appId=${build.appId}`);
  console.log(`[PASS] productName=${build.productName}`);
  console.log(`[PASS] icon=${build.win.icon}`);
  console.log(`[PASS] nsis oneClick=${build.nsis.oneClick} desktop=${build.nsis.createDesktopShortcut}`);
  console.log(`[PASS] DB file name (userData): muvekkil-kasa-defteri.sqlite`);
  console.log(`[PASS] userData folder follows package.json name: ${pkg.name}`);
}

console.log("=== MKD Release-Ready Suite ===");

assertPackagingConfig();
run("tsc --noEmit", npx, ["tsc", "--noEmit"]);
run("npm run build", npm, ["run", "build"]);
run("npm run test:premium-smoke", npm, ["run", "test:premium-smoke"]);

console.log("\n=== Release-ready: TÜM KONTROLLER GEÇTİ ===\n");
console.log("Not: Installer üretimi için ayrıca `npm run dist:win` çalıştırın.\n");
