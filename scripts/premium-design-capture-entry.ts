/**
 * Premium Login & Müvekkiller tasarım screenshot'ları.
 */
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import { muvekkilEkle } from "../src/main/services/muvekkil.service";
import {
  assert,
  attachConsoleCollector,
  captureScreenshot,
  createPremiumWindow,
  loadPremiumRoute,
  newTestDbPath,
  premiumLogin,
  seedLicenseActive,
  shutdownPremiumElectron,
  waitForCondition,
  waitForCondition,
  waitForSelector,
  PROJECT_ROOT,
} from "./lib/premium-e2e-harness";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";

const TEST_USER = "design_capture";
const TEST_PASS = "design-capture-123";
const outDir = join(PROJECT_ROOT, "test-results", "premium-design-review");

const REQUIRED = [
  "login-1920x1080.png",
  "login-1366x768.png",
  "muvekkiller-1920x1080.png",
  "muvekkiller-1366x768.png",
];

async function run(): Promise<void> {
  const dbPath = newTestDbPath("mkd-design-capture");
  let win: BrowserWindow | null = null;

  try {
    process.env.MKD_TEST_DB = dbPath;
    await app.whenReady();
    app.commandLine.appendSwitch("disable-gpu");
    win = createPremiumWindow(1920, 1080);

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: "Tasarım Test",
      kullaniciAdi: TEST_USER,
      sifre: TEST_PASS,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");

    muvekkilEkle({
      muvekkilTuru: "GERCEK_KISI",
      adSoyad: "Ahmet Yılmaz",
      telefon: "0532 111 22 33",
      eposta: "ahmet@ornek.com",
      not: "Premium liste tasarım testi",
    });
    muvekkilEkle({
      muvekkilTuru: "TUZEL_KISI",
      sirketUnvani: "Woontegra Hukuk A.Ş.",
      yetkiliAdSoyad: "Mehmet Demir",
      yetkiliTelefon: "0212 444 55 66",
      eposta: "info@woontegra.com",
      not: "Kurumsal müvekkil örneği",
    });

    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    attachConsoleCollector(win);

    // Login 1920
    await loadPremiumRoute(win, "/login", ".pm-login-panel");
    assert(await waitForSelector(win.webContents, ".pm-auth-hero-program-logo", 10000), "Program logosu yok");
    assert(await waitForSelector(win.webContents, ".pm-auth-hero-woontegra-logo", 10000), "Woontegra logosu yok");
    assert(await waitForSelector(win.webContents, ".pm-auth-hero-features", 10000), "Hero özellikleri yok");
    await waitForCondition(
      win.webContents,
      `(() => { const img = document.querySelector('.pm-auth-hero-program-logo'); return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0; })()`,
      15000,
    );
    win.setContentSize(1920, 1080);
    await waitForCondition(win.webContents, `document.querySelector('.pm-login-panel')?.offsetHeight > 0`);
    await captureScreenshot(win, join(outDir, "login-1920x1080.png"));

    // Login 1366
    win.setContentSize(1366, 768);
    await waitForCondition(win.webContents, `window.innerWidth >= 1300`);
    await captureScreenshot(win, join(outDir, "login-1366x768.png"));

    await premiumLogin(win, TEST_USER, TEST_PASS);

    await loadPremiumRoute(win, "/muvekkiller", ".pm-mvk-control-bar");
    assert(await waitForSelector(win.webContents, ".pm-mvk-data-table tbody tr", 15000), "Müvekkil tablosu boş");
    win.setContentSize(1920, 1080);
    await captureScreenshot(win, join(outDir, "muvekkiller-1920x1080.png"));

    win.setContentSize(1366, 768);
    await captureScreenshot(win, join(outDir, "muvekkiller-1366x768.png"));

    for (const f of REQUIRED) {
      console.log(`[CAPTURE] ${join(outDir, f)}`);
    }
    console.log("[DONE] Premium design screenshots saved.");
  } finally {
    await shutdownPremiumElectron(win, dbPath, true);
  }
}

if (process.env.MKD_PREMIUM_DESIGN_CAPTURE === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Design capture:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
