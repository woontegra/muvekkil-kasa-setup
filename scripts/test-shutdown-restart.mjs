/**
 * Kapanış ve geri yükleme sonrası oturum/yeniden başlatma testi.
 * A) shutdown.ts + restartAfterRestore.ts: sahte Electron ile kapanış, iptal, hata ve relaunch kuralları.
 * B) backup.service.ts: başarılı geri yüklemede oturum ve bekleyen belirteçler düşer, eski rol reddedilir;
 *    başarısız geri yüklemede oturum ve veritabanı değişmez. Yalnızca os.tmpdir() altındaki SQLite dosyaları.
 * C) Gerçek Electron (geçici userData, gizli pencere): macOS'ta kapanış tamamlanır, relaunch yalnızca
 *    kesinleşen kapanışta olur, iptalde süreç açık kalır ve yeniden açılmaz.
 * Gerçek kullanıcı verisine, userData klasörüne ve ağa dokunmaz.
 * Çalıştırma: node scripts/test-shutdown-restart.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const electronExe = join(
  root,
  "node_modules/electron/dist",
  readFileSync(join(root, "node_modules/electron/path.txt"), "utf8").trim(),
);

if (!process.versions.electron) {
  const r = spawnSync(electronExe, [fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  process.exit(r.status ?? 1);
}

const require = createRequire(join(root, "package.json"));
const Database = require("better-sqlite3");
const { build } = require("esbuild");

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

const tmp = mkdtempSync(join(os.tmpdir(), "mkd-shutdown-test-"));
const tick = () => new Promise((r) => setImmediate(r));
const ticks = async (n = 3) => {
  for (let i = 0; i < n; i++) await tick();
};
const src = (p) => JSON.stringify(join(root, p));
const betterSqlitePath = require.resolve("better-sqlite3");

function stubPlugin(extra = {}, { realElectron = false } = {}) {
  return {
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /^electron$/ }, () =>
        realElectron ? { path: "electron", external: true } : { path: "electron", namespace: "stub" },
      );
      b.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: betterSqlitePath, external: true }));
      for (const [name, filter] of Object.entries(extra)) {
        b.onResolve({ filter }, () => ({ path: name, namespace: "stub" }));
      }
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
        contents:
          a.path === "electron"
            ? "module.exports = globalThis.__mkdElectron;"
            : `module.exports = globalThis.__mkdStubs[${JSON.stringify(a.path)}];`,
        loader: "js",
      }));
    },
  };
}

async function bundle(name, contents, plugin) {
  const entry = join(tmp, `${name}.ts`);
  writeFileSync(entry, contents);
  const outfile = join(tmp, `${name}.cjs`);
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "error",
    alias: { "@shared": join(root, "src/shared") },
    plugins: [plugin],
  });
  return outfile;
}

let loadCount = 0;
function freshLoad(bundlePath) {
  const copy = bundlePath.replace(/\.cjs$/, `.${++loadCount}.cjs`);
  copyFileSync(bundlePath, copy);
  return require(copy);
}

// ---------------------------------------------------------------- A: kapanış mantığı (sahte Electron)

function fakeElectron({ packaged = true, syncChoices = [], asyncResponses = [] } = {}) {
  const listeners = {};
  const events = [];
  let inBeforeQuit = 0;
  let exited = false;
  const boxes = [];
  const app = {
    isPackaged: packaged,
    on(ev, fn) {
      (listeners[ev] ||= []).push(fn);
    },
    quit() {
      events.push("quit");
      if (inBeforeQuit > 0) events.push("NESTED_QUIT");
      if (exited) return;
      let prevented = false;
      inBeforeQuit++;
      try {
        for (const fn of listeners["before-quit"] ?? []) fn({ preventDefault: () => (prevented = true) });
      } finally {
        inBeforeQuit--;
      }
      if (!prevented) {
        exited = true;
        events.push("EXIT");
      }
    },
    relaunch() {
      events.push("relaunch");
    },
    getPath() {
      throw new Error("test: userData kullanılmamalı");
    },
  };
  const dialog = {
    showMessageBoxSync(opts) {
      boxes.push({ sync: true, opts });
      return syncChoices.length ? syncChoices.shift() : 2;
    },
    async showMessageBox(a, b) {
      const opts = b ?? a;
      boxes.push({ sync: false, opts, hasWindow: b !== undefined });
      return { response: asyncResponses.length ? asyncResponses.shift() : 1 };
    },
  };
  return { app, dialog, events, boxes, BrowserWindow: {}, ipcMain: {} };
}

function setupShutdown(bundlePath, opts = {}) {
  const el = fakeElectron(opts);
  const calls = { finalize: 0, closeDb: 0 };
  const finalizeResults = [...(opts.finalizeResults ?? [])];
  globalThis.__mkdElectron = el;
  globalThis.__mkdStubs = {
    connection: {
      closeDb: () => {
        calls.closeDb++;
        el.events.push("closeDb");
      },
      getDb: () => {
        throw new Error("test: db kullanılmamalı");
      },
    },
    pendingApproval: {
      finalizePendingApprovals: () => {
        calls.finalize++;
        el.events.push("finalize");
        const next = finalizeResults.length ? finalizeResults.shift() : { errors: [] };
        if (next === "throw") throw new Error("test finalize hatası");
        return next;
      },
      logPendingApprovalResult: () => {},
    },
  };
  const mod = freshLoad(bundlePath);
  mod.installGracefulShutdown();
  return { el, calls, mod };
}

const withErrors = { errors: [{ id: 7, kind: "avans", message: "test" }] };
const exitIndex = (ev) => ev.indexOf("EXIT");

async function partA() {
  console.log("\nA) Kapanış ve yeniden başlatma mantığı");
  const bundleA = await bundle(
    "shutdown-entry",
    `export * from ${src("src/main/shutdown.ts")};
export * from ${src("src/main/restartAfterRestore.ts")};`,
    stubPlugin({ connection: /\/db\/connection$/, pendingApproval: /pendingApproval\.service$/ }),
  );

  {
    const { el, calls } = setupShutdown(bundleA);
    el.app.quit();
    assert(!el.events.includes("EXIT"), "normal: ilk before-quit kapanışı durdurur (preventDefault)");
    assert(calls.finalize === 1 && calls.closeDb === 1, "normal: bekleyen onaylar kesinleşir, veritabanı kapanır");
    assert(!el.events.includes("NESTED_QUIT"), "normal: before-quit içinde iç içe app.quit() yok");
    await ticks();
    assert(exitIndex(el.events) > el.events.indexOf("closeDb"), "normal: çıkış sonraki döngüde tamamlanır");
    assert(!el.events.includes("relaunch"), "normal: istenmeden relaunch yok");
    assert(calls.finalize === 1, "normal: ikinci before-quit kesinleştirmeyi tekrarlamaz");
  }
  {
    const { el, calls } = setupShutdown(bundleA, { finalizeResults: [withErrors], syncChoices: [2] });
    el.app.quit();
    await ticks();
    assert(el.boxes.length === 1 && el.boxes[0].opts.title === "Bekleyen işlemler", "hata: 'Bekleyen işlemler' uyarısı gösterilir");
    assert(!el.events.includes("EXIT") && calls.closeDb === 0, "hata + İptal: uygulama açık kalır, veritabanı kapanmaz");
    el.app.quit();
    await ticks();
    assert(calls.finalize === 2 && el.events.includes("EXIT"), "İptal sonrası yeni çıkış isteği yeniden kesinleştirip kapanır");
  }
  {
    const { el, calls } = setupShutdown(bundleA, { finalizeResults: [withErrors, { errors: [] }], syncChoices: [0] });
    el.app.quit();
    assert(!el.events.includes("NESTED_QUIT"), "hata + Yeniden dene: iç içe app.quit() yok");
    await ticks();
    assert(calls.finalize === 2 && calls.closeDb === 1 && el.events.includes("EXIT"), "hata + Yeniden dene: ikinci denemede kapanır");
  }
  {
    const { el, calls } = setupShutdown(bundleA, { finalizeResults: [withErrors], syncChoices: [1] });
    el.app.quit();
    await ticks();
    assert(calls.closeDb === 1 && el.events.includes("EXIT"), "hata + Yine de çık: veritabanı kapanır ve çıkılır");
  }
  {
    const { el, calls } = setupShutdown(bundleA, { finalizeResults: ["throw"], syncChoices: [1] });
    el.app.quit();
    await ticks();
    assert(el.boxes[0]?.opts.title === "Kapanış hatası", "istisna: 'Kapanış hatası' uyarısı gösterilir");
    assert(calls.closeDb === 1 && el.events.includes("EXIT"), "istisna + Yine de çık: kapanır");
  }
  {
    const { el, calls } = setupShutdown(bundleA, { finalizeResults: ["throw"], syncChoices: [2] });
    el.app.quit();
    await ticks();
    assert(!el.events.includes("EXIT") && calls.closeDb === 0, "istisna + İptal: uygulama açık kalır");
  }
  {
    const { el, mod } = setupShutdown(bundleA);
    mod.requestRelaunchAfterQuit();
    el.app.quit();
    await ticks();
    const r = el.events.indexOf("relaunch");
    assert(r > el.events.indexOf("closeDb") && r < exitIndex(el.events), "relaunch: kesinleşen kapanışta, çıkıştan önce kaydedilir");
    assert(el.events.filter((e) => e === "relaunch").length === 1, "relaunch: tek kez");
  }
  {
    const { el, mod } = setupShutdown(bundleA, { finalizeResults: [withErrors], syncChoices: [2] });
    mod.requestRelaunchAfterQuit();
    el.app.quit();
    await ticks();
    assert(!el.events.includes("relaunch") && !el.events.includes("EXIT"), "relaunch + İptal: yeniden başlatma yok, uygulama açık");
    el.app.quit();
    await ticks();
    assert(el.events.includes("EXIT") && !el.events.includes("relaunch"), "İptal sonrası normal çıkışta beklenmedik yeniden açılma yok");
  }
  {
    const { el, mod } = setupShutdown(bundleA, { finalizeResults: ["throw"], syncChoices: [1] });
    mod.requestRelaunchAfterQuit();
    el.app.quit();
    await ticks();
    assert(el.events.includes("relaunch") && el.events.includes("EXIT"), "relaunch + istisna + Yine de çık: kapanış kesinleştiği için yeniden başlar");
  }

  {
    const { el, mod } = setupShutdown(bundleA, { packaged: true, asyncResponses: [0] });
    const win = { id: 1 };
    const choice = await mod.offerRestartAfterRestore(win, "/tmp/oncesi.sqlite");
    const box = el.boxes[0];
    assert(choice === "restarting", "paketli + Şimdi Yeniden Başlat: 'restarting'");
    assert(
      JSON.stringify(box.opts.buttons) === JSON.stringify(["Şimdi Yeniden Başlat", "Daha Sonra"]) && box.opts.cancelId === 1,
      "onay penceresi: Şimdi Yeniden Başlat / Daha Sonra, Esc = Daha Sonra",
    );
    assert(box.hasWindow && /oturumunuz kapatıldı/.test(box.opts.message), "onay penceresi ana pencereye bağlı ve oturumun kapandığını söyler");
    assert(box.opts.detail.includes("/tmp/oncesi.sqlite"), "onay penceresi önceki veritabanı yedeğinin yolunu gösterir");
    assert(!el.events.includes("quit"), "paketli + Şimdi: çıkış IPC yanıtından sonra (ertelenmiş) başlar");
    await ticks(4);
    assert(
      el.events.indexOf("finalize") < el.events.indexOf("relaunch") && el.events.indexOf("relaunch") < exitIndex(el.events),
      "paketli + Şimdi: kesinleştirme → relaunch → çıkış sırası",
    );
  }
  {
    const { el, mod } = setupShutdown(bundleA, { packaged: true, asyncResponses: [1] });
    const choice = await mod.offerRestartAfterRestore(null, "/tmp/x.sqlite");
    await ticks(4);
    assert(choice === "later" && el.events.length === 0, "paketli + Daha Sonra: çıkış ve relaunch yok");
  }
  {
    const { el, mod } = setupShutdown(bundleA, { packaged: false, asyncResponses: [0, 0] });
    const choice = await mod.offerRestartAfterRestore(null, "/tmp/x.sqlite");
    await ticks(4);
    assert(choice === "manual", "geliştirme + Şimdi: 'manual'");
    assert(el.events.length === 0, "geliştirme: otomatik çıkış/relaunch yok");
    assert(/Geliştirme ortamında otomatik yeniden başlatma yapılmaz/.test(el.boxes[1]?.opts.message ?? ""), "geliştirme: elle yeniden başlatma uyarısı gösterilir");
  }
  {
    const { el, calls, mod } = setupShutdown(bundleA, {
      packaged: true,
      asyncResponses: [0],
      finalizeResults: [withErrors],
      syncChoices: [2],
    });
    const choice = await mod.offerRestartAfterRestore(null, "/tmp/x.sqlite");
    await ticks(4);
    assert(choice === "restarting" && !el.events.includes("EXIT") && !el.events.includes("relaunch"), "Şimdi + kapanış İptal: açık kalır, relaunch yok");
    el.app.quit();
    await ticks();
    assert(calls.finalize === 2 && el.events.includes("EXIT") && !el.events.includes("relaunch"), "daha sonraki normal çıkışta yeniden açılma yok");
  }
}

// ---------------------------------------------------------------- B: geri yükleme sonrası oturum

async function partB() {
  console.log("\nB) Geri yükleme sonrası oturum ve yetki");
  const ud = join(tmp, "userData");
  const files = join(tmp, "files");
  mkdirSync(ud, { recursive: true });
  mkdirSync(files, { recursive: true });
  const livePath = join(ud, "muvekkil-kasa-defteri.sqlite");
  process.env.MKD_TEST_DB = livePath;

  const openQueue = [];
  globalThis.__mkdElectron = {
    app: {
      isPackaged: false,
      getPath: (k) => {
        if (k === "userData") return ud;
        throw new Error(`test: ${k} kullanılmamalı`);
      },
      getVersion: () => "0.1.14",
      on() {},
    },
    dialog: {
      showOpenDialog: async () => {
        const p = openQueue.shift();
        return p ? { canceled: false, filePaths: [p] } : { canceled: true, filePaths: [] };
      },
      showSaveDialog: async () => ({ canceled: true }),
    },
    ipcMain: { handle() {} },
    BrowserWindow: {},
  };
  globalThis.__mkdStubs = {};

  const bundleB = await bundle(
    "restore-entry",
    `export { restoreDatabase } from ${src("src/main/services/backup.service.ts")};
export { setupFirst, login, authGetSession } from ${src("src/main/services/auth.service.ts")};
export { getDb, closeDb } from ${src("src/main/db/connection.ts")};
export { runMigrations } from ${src("src/main/db/migrate.ts")};
export { allMigrations } from ${src("src/main/migrations/index.ts")};
export { assertIpcModuleAuthorized } from ${src("src/main/ipc/moduleAuthorization.ts")};
export { decideLicenseIpcAccess } from ${src("src/main/ipc/licenseAuthorization.policy.ts")};
export { IPC } from ${src("src/shared/ipc.ts")};`,
    stubPlugin(),
  );
  const m = freshLoad(bundleB);
  const db = m.getDb();
  m.runMigrations(db, m.allMigrations, () => new Date().toISOString());
  const setup = m.setupFirst({
    adSoyad: "Test Sahibi",
    eposta: "sahip@test.local",
    sifre: "Sahip-Parola-1",
    guvenlikSorusuKodu: "G1",
    guvenlikCevabi: "test",
  });
  assert(setup.ok && m.authGetSession()?.rol === "BURO_SAHIBI", "hazırlık: büro sahibi oturumu açık");

  const backupPlain = join(files, "katip-yedek.sqlite");
  await db.backup(backupPlain);
  const bdb = new Database(backupPlain);
  bdb.prepare(`UPDATE uygulama_kullanici SET rol = 'KATIP_PERSONEL', ad_soyad = 'Katip Kopya' WHERE id = 1`).run();
  bdb.close();
  const enc = join(files, "katip-yedek.mkyedek");
  const { writeLegacyEncryptedBackup } = await import(pathToFileURL(join(root, "scripts/lib/legacy-mkyedek-fixture.mjs")).href);
  writeLegacyEncryptedBackup(backupPlain, enc, "Dogru-Parola-2026!", {
    passwordScrypt: { N: 2 ** 14, r: 8, p: 1 },
    recoveryScrypt: { N: 2 ** 14, r: 8, p: 1 },
  });
  const corrupt = join(files, "bozuk.sqlite");
  writeFileSync(corrupt, Buffer.alloc(8192, 7));

  const ch = m.IPC;
  const allowed = (channel) => {
    try {
      m.assertIpcModuleAuthorized(channel);
      return true;
    } catch {
      return false;
    }
  };
  const licenseAllowed = (channel) =>
    m.decideLicenseIpcAccess(channel, { businessAuthorized: true, setupAuthorized: true, hasSession: Boolean(m.authGetSession()) }) === "ALLOW";
  const liveRol = () => m.getDb().prepare(`SELECT rol FROM uygulama_kullanici WHERE id = 1`).get().rol;

  assert(allowed(ch.backup.geriYukle), "geri yükleme öncesi: büro sahibi yetkili");

  openQueue.push(corrupt);
  const rBad = await m.restoreDatabase();
  assert(!rBad.ok, "bozuk dosya: geri yükleme reddedilir");
  assert(m.authGetSession()?.rol === "BURO_SAHIBI" && liveRol() === "BURO_SAHIBI", "bozuk dosya: oturum ve veritabanı değişmez");

  openQueue.push(enc);
  const rSel = await m.restoreDatabase();
  assert(!rSel.ok && rSel.needsSecret && rSel.token, "şifreli seçim: belirteç döner");
  const rWrong = await m.restoreDatabase({ token: rSel.token, password: "Yanlis-Parola-2026!" });
  assert(!rWrong.ok && rWrong.needsSecret, "yanlış parola: reddedilir, yeniden denenebilir");
  assert(m.authGetSession()?.rol === "BURO_SAHIBI" && liveRol() === "BURO_SAHIBI", "yanlış parola: oturum ve veritabanı değişmez");

  openQueue.push(enc);
  const rOther = await m.restoreDatabase();
  assert(rOther.token && rOther.token !== rSel.token, "ikinci bekleyen belirteç oluşturuldu");

  const rOk = await m.restoreDatabase({ token: rSel.token, password: "Dogru-Parola-2026!" });
  assert(rOk.ok, "doğru parola: geri yükleme tamamlanır");
  assert(m.authGetSession() === null, "başarılı geri yükleme: oturum derhal kapatılır");
  assert(liveRol() === "KATIP_PERSONEL", "yeni veritabanı etkin");

  const rStale = await m.restoreDatabase({ token: rOther.token, password: "Dogru-Parola-2026!" });
  assert(!rStale.ok && /zaman aşımı/.test(rStale.error), "başarılı geri yükleme: diğer bekleyen belirteçler geçersiz");
  const rReuse = await m.restoreDatabase({ token: rSel.token, password: "Dogru-Parola-2026!" });
  assert(!rReuse.ok && /zaman aşımı/.test(rReuse.error), "kullanılan belirteç tekrar kullanılamaz");

  assert(!allowed(ch.backup.geriYukle) && !allowed(ch.backup.al), "eski oturum: büro sahibi kanalları reddedilir");
  assert(ch.backup.kurtarmaAnahtariKaydet === undefined, "kurtarma anahtarı kaydetme kanalı kaldırıldı");
  assert(!licenseAllowed(ch.backup.geriYukle) && !licenseAllowed(ch.office.save), "eski oturum: lisanslı iş kanalları oturumsuz reddedilir");
  assert(allowed(ch.auth.login) && allowed(ch.auth.getSession), "giriş kanalları açık kalır");

  const relog = m.login({ kullaniciAdi: "sahip@test.local", password: "Sahip-Parola-1" });
  assert(relog.ok && relog.user.rol === "KATIP_PERSONEL" && relog.user.adSoyad === "Katip Kopya", "yeniden giriş: rol yeni veritabanından okunur");
  assert(!allowed(ch.backup.geriYukle), "yeniden giriş sonrası eski büro sahibi yetkisi geri gelmez");

  openQueue.push(backupPlain);
  const rPlain = await m.restoreDatabase();
  assert(rPlain.ok && m.authGetSession() === null, "şifresiz eski yedek: başarılı geri yüklemede de oturum kapanır");

  m.closeDb();
  delete process.env.MKD_TEST_DB;
}

// ---------------------------------------------------------------- C: gerçek Electron (macOS kapanışı)

const PROBE = `
const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const dir = process.env.PROBE_DIR;
const scenario = process.env.PROBE_SCENARIO;
const logFile = path.join(dir, "events.log");
const log = (m) => fs.appendFileSync(logFile, m + "\\n");
app.setPath("userData", path.join(dir, "userData"));
const startedFile = path.join(dir, "started");
if (fs.existsSync(startedFile)) {
  app.whenReady().then(() => { log("relaunched pid=" + process.pid); app.exit(0); });
} else {
  fs.writeFileSync(startedFile, String(process.pid));
  let finalizeErrors = scenario === "cancel";
  globalThis.__mkdStubs = {
    connection: { closeDb: () => log("closeDb"), getDb: () => { throw new Error("db yok"); } },
    pendingApproval: {
      finalizePendingApprovals: () => { log("finalize"); return { errors: finalizeErrors ? [{ id: 1, kind: "t", message: "t" }] : [] }; },
      logPendingApprovalResult: () => {},
    },
  };
  dialog.showMessageBoxSync = () => { log("dialog-iptal"); return 2; };
  const mod = require(process.env.PROBE_BUNDLE);
  mod.installGracefulShutdown();
  app.on("window-all-closed", () => {
    log("window-all-closed");
    if (scenario === "window-close" || process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", () => log("will-quit"));
  app.on("quit", () => log("quit"));
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false });
    await win.loadURL("about:blank");
    if (scenario === "window-close") { win.close(); return; }
    if (scenario !== "normal") mod.requestRelaunchAfterQuit();
    app.quit();
    if (scenario === "cancel") {
      setTimeout(() => {
        log("alive windows=" + BrowserWindow.getAllWindows().length);
        finalizeErrors = false;
        app.quit();
      }, 1500);
    }
  });
}
`;

function runProbe(scenario, bundlePath) {
  const dir = mkdtempSync(join(tmp, `probe-${scenario}-`));
  const main = join(dir, "main.cjs");
  writeFileSync(main, PROBE);
  const env = { ...process.env, PROBE_DIR: dir, PROBE_SCENARIO: scenario, PROBE_BUNDLE: bundlePath };
  delete env.ELECTRON_RUN_AS_NODE;
  return new Promise((resolve) => {
    const child = spawn(electronExe, [main], { env, stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ dir, code: "TIMEOUT" });
    }, 15000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ dir, code });
    });
  });
}

async function waitForLog(dir, pattern, ms) {
  const f = join(dir, "events.log");
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (existsSync(f) && pattern.test(readFileSync(f, "utf8"))) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function partC() {
  console.log(`\nC) Gerçek Electron ${process.versions.electron} (${process.platform}) kapanış davranışı`);
  globalThis.__mkdStubs = {};
  const bundleC = await bundle(
    "probe-shutdown",
    `export * from ${src("src/main/shutdown.ts")};`,
    stubPlugin({ connection: /\/db\/connection$/, pendingApproval: /pendingApproval\.service$/ }, { realElectron: true }),
  );
  const events = (dir) => (existsSync(join(dir, "events.log")) ? readFileSync(join(dir, "events.log"), "utf8").trim().split("\n") : []);

  {
    const r = await runProbe("normal", bundleC);
    const ev = events(r.dir);
    assert(r.code === 0, `normal: süreç kendiliğinden kapanır (çıkış kodu ${r.code})`);
    assert(ev.join(",") === "finalize,closeDb,will-quit,quit", `normal: olay sırası doğru (${ev.join(",")})`);
    assert(!(await waitForLog(r.dir, /relaunched/, 2500)), "normal: yeniden açılma yok");
  }
  {
    const r = await runProbe("window-close", bundleC);
    const ev = events(r.dir);
    assert(r.code === 0 && ev.includes("quit"), "pencere kapanınca çıkış (Windows yolu): kapanış tamamlanır");
  }
  {
    const r = await runProbe("relaunch", bundleC);
    assert(r.code === 0, "relaunch: ilk süreç kapanır");
    const relaunched = await waitForLog(r.dir, /relaunched pid=\d+/, 10000);
    assert(relaunched, "relaunch: kesinleşen kapanıştan sonra uygulama yeniden açılır");
    const ev = events(r.dir);
    assert(ev.indexOf("closeDb") < ev.indexOf("quit") && ev.indexOf("quit") < ev.findIndex((l) => l.startsWith("relaunched")), "relaunch: önce kesinleştirme ve çıkış, sonra yeni süreç");
  }
  {
    const r = await runProbe("cancel", bundleC);
    const ev = events(r.dir);
    assert(ev.includes("dialog-iptal") && ev.includes("alive windows=1"), "relaunch + İptal: süreç ve pencere açık kalır");
    assert(r.code === 0 && ev.includes("quit"), "İptal sonrası normal çıkış tamamlanır");
    assert(!(await waitForLog(r.dir, /relaunched/, 4000)), "İptal edilen yeniden başlatma sonradan tetiklenmez");
  }
}

try {
  await partA();
  await partB();
  if (process.platform === "darwin" || process.env.MKD_TEST_REAL_ELECTRON === "1") await partC();
  else console.log("\nC) atlandı (yalnızca macOS'ta otomatik çalışır)");
} catch (e) {
  failed++;
  console.log("  ✗ beklenmeyen hata:", e?.stack ?? e);
}

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız`);
console.log(`Geçici klasör: ${tmp}`);
process.exit(failed ? 1 : 0);
