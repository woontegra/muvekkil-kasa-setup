/**
 * Premium responsive screenshot + layout kontrolleri.
 */
import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { app, type BrowserWindow } from "electron";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { authLogout, setupFirst } from "../src/main/services/auth.service";
import { dosyaEkle } from "../src/main/services/dosya.service";
import { muvekkilEkle } from "../src/main/services/muvekkil.service";
import { getDb, nowIso } from "../src/main/db/connection";
import {
  assert,
  attachConsoleCollector,
  captureScreenshot,
  createPremiumWindow,
  horizontalOverflowPx,
  loadPremiumRoute,
  newTestDbPath,
  premiumLogin,
  seedLicenseActive,
  shutdownPremiumElectron,
  sleep,
  waitForSelector,
  PROJECT_ROOT,
} from "./lib/premium-e2e-harness";

const SIZES: [number, number][] = [
  [1100, 720],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];

const outDir = join(PROJECT_ROOT, "test-results", "premium-responsive");

type Screen = { slug: string; route: string; selector: string };

const AUTHED_SCREENS: Screen[] = [
  { slug: "overview", route: "/", selector: ".pm-overview" },
  { slug: "muvekkiller", route: "/muvekkiller", selector: ".pm-mvk-control-bar" },
  { slug: "muvekkil-detail", route: "/muvekkil/__MID__", selector: ".pm-mvk-detail-head" },
  { slug: "dosya-detail", route: "/muvekkil/__MID__/dosya/__DID__", selector: ".pm-dosya-page" },
  { slug: "ofis-kasasi", route: "/ofis-kasasi", selector: ".pm-ofis-page" },
  { slug: "icra-tahsilat", route: "/icra-tahsilat", selector: ".pm-icra-page" },
  { slug: "ayarlar", route: "/ayarlar", selector: ".pm-settings-page" },
  { slug: "raporlar", route: "/raporlar", selector: ".pm-rapor-page" },
];

async function ensureLoggedOut(win: BrowserWindow): Promise<void> {
  authLogout();
  await sleep(400);
  for (let attempt = 0; attempt < 3; attempt++) {
    await loadPremiumRoute(win, "/login");
    const ok = await waitForSelector(
      win.webContents,
      ".pm-login-panel, .pm-login-form, .pm-auth-card",
      20000,
    );
    if (ok) return;
    await sleep(600);
  }
  assert(false, "Login paneli açılamadı (logout sonrası)");
}

async function run(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir).filter((n) => n.endsWith(".png"))) {
    unlinkSync(join(outDir, f));
  }
  const dbPath = newTestDbPath("mkd-premium-responsive");
  let win: BrowserWindow | null = null;

  try {
    process.env.MKD_TEST_DB = dbPath;
    await app.whenReady();
    app.commandLine.appendSwitch("disable-gpu");
    win = createPremiumWindow(1920, 1080);
    attachConsoleCollector(win);

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    const setup = setupFirst({
      adSoyad: "Responsive Test",
      kullaniciAdi: "responsive_e2e",
      sifre: "responsive-e2e-123",
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    assert(setup.ok, setup.error ?? "setup failed");
    const m = muvekkilEkle({ muvekkilTuru: "GERCEK_KISI", adSoyad: "Responsive Müvekkil", telefon: "555" });
    const d = dosyaEkle({
      muvekkilId: m.id,
      konuBasligi: "Responsive Dosya",
      mahkemeAdi: "Test",
      dosyaNumarasi: "1",
    });
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    authLogout();

    for (const [w, h] of SIZES) {
      win!.setContentSize(w, h);
      await ensureLoggedOut(win!);
      const overflowLogin = await horizontalOverflowPx(win!);
      assert(overflowLogin < 48, `login ${w}x${h} yatay taşma: ${overflowLogin}px`);
      await captureScreenshot(win!, join(outDir, `login-${w}x${h}.png`));
      console.log(`[PASS] login ${w}x${h}`);

      await premiumLogin(win!, "responsive_e2e", "responsive-e2e-123");
      for (const screen of AUTHED_SCREENS) {
        const route = screen.route.replace("__MID__", String(m.id)).replace("__DID__", String(d.id));
        await loadPremiumRoute(win!, route, screen.selector);
        const overflow = await horizontalOverflowPx(win!);
        assert(overflow < 48, `${screen.slug} ${w}x${h} yatay taşma: ${overflow}px`);
        const sidebar = await win!.webContents.executeJavaScript(`!!document.querySelector('.pm-sidebar')`, true);
        assert(sidebar, `${screen.slug}: sidebar yok`);
        const file = join(outDir, `${screen.slug}-${w}x${h}.png`);
        await captureScreenshot(win!, file);
        console.log(`[PASS] ${screen.slug} ${w}x${h}`);
      }
    }
    console.log("\n=== Premium responsive: TÜM TESTLER GEÇTİ ===\n");
  } finally {
    await shutdownPremiumElectron(win, dbPath, true);
  }
}

if (process.env.MKD_PREMIUM_RESPONSIVE_TEST === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Premium responsive:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
