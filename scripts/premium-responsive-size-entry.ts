/**
 * Tek çözünürlük — izole Electron instance (MKD_RESPONSIVE_WIDTH × MKD_RESPONSIVE_HEIGHT).
 */
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
  getRouteDiagnostics,
  loadPremiumRoute,
  premiumLogin,
  resetDbConnection,
  seedLicenseActive,
  shutdownPremiumElectron,
  waitForCondition,
  navigatePremiumHash,
  waitForRoute,
  js,
  PROJECT_ROOT,
} from "./lib/premium-e2e-harness";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";

const outDir = join(PROJECT_ROOT, "test-results", "premium-responsive");

type Screen = { slug: string; route: string; selector: string };

const AUTHED_SCREENS: Screen[] = [
  { slug: "overview", route: "/", selector: ".pm-overview" },
  { slug: "muvekkiller", route: "/muvekkiller", selector: ".pm-mvk-control-bar" },
  { slug: "muvekkil-detail", route: "/muvekkil/__MID__", selector: ".pm-mvk-detail" },
  { slug: "dosya-detail", route: "/muvekkil/__MID__/dosya/__DID__", selector: ".pm-dosya-page" },
  { slug: "ofis-kasasi", route: "/ofis-kasasi", selector: ".pm-ofis-page" },
  { slug: "icra-tahsilat", route: "/icra-tahsilat", selector: ".pm-icra-page" },
  { slug: "ayarlar", route: "/ayarlar", selector: ".pm-settings-page" },
  { slug: "raporlar", route: "/raporlar", selector: ".pm-rapor-page" },
];

async function run(): Promise<void> {
  const w = Number(process.env.MKD_RESPONSIVE_WIDTH);
  const h = Number(process.env.MKD_RESPONSIVE_HEIGHT);
  assert(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0, `Geçersiz boyut: ${w}x${h}`);

  resetDbConnection();
  const env = initIsolatedElectronEnv(`responsive-${w}x${h}-${Date.now()}`);
  let win: BrowserWindow | null = null;

  try {
    await app.whenReady();
    win = createPremiumWindow(w, h);
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

    await loadPremiumRoute(win, "/login");
    await waitForRoute(win, "/login", ".pm-login-panel");
    const overflowLogin = await horizontalOverflowPx(win);
    assert(overflowLogin < 48, `login ${w}x${h} yatay taşma: ${overflowLogin}px`);
    await captureScreenshot(win, join(outDir, `login-${w}x${h}.png`));
    console.log(`[PASS] login ${w}x${h}`);

    await premiumLogin(win, "responsive_e2e", "responsive-e2e-123");
    for (const screen of AUTHED_SCREENS) {
      const route = screen.route.replace("__MID__", String(m.id)).replace("__DID__", String(d.id));

      if (screen.slug === "muvekkil-detail") {
        await navigatePremiumHash(win, "/muvekkiller", ".pm-mvk-control-bar");
        await waitForCondition(
          win.webContents,
          `document.querySelectorAll('.pm-mvk-data-row').length > 0`,
          20000,
        );
        const clicked = await js<boolean>(
          win.webContents,
          `(() => {
            const row = document.querySelector('.pm-mvk-data-row');
            if (!row) return false;
            row.click();
            return true;
          })()`,
        );
        assert(clicked, "Müvekkil satırı bulunamadı");
        const loaded = await waitForCondition(
          win.webContents,
          `location.hash.includes('/muvekkil/${m.id}') && !!document.querySelector('.pm-mvk-detail')`,
          45000,
        );
        if (!loaded) {
          const diag = await getRouteDiagnostics(win);
          assert(false, `muvekkil-detail yüklenmedi: hash=${diag.hash} error=${diag.visibleError || "—"} body=${diag.bodySnippet}`);
        }
      } else if (screen.slug === "dosya-detail") {
        await navigatePremiumHash(win, `/muvekkil/${m.id}`, ".pm-mvk-detail");
        const clicked = await js<boolean>(
          win.webContents,
          `(() => {
            const link = document.querySelector('a[href*="/dosya/${d.id}"]');
            if (link) { link.click(); return true; }
            const row = Array.from(document.querySelectorAll('.pm-mvk-data-row')).find((tr) => tr.textContent?.includes('Responsive Dosya'));
            if (row) { row.click(); return true; }
            return false;
          })()`,
        );
        assert(clicked, "Dosya detay linki bulunamadı");
        const loaded = await waitForCondition(
          win.webContents,
          `location.hash.includes('/dosya/${d.id}') && !!document.querySelector('.pm-dosya-page')`,
          45000,
        );
        if (!loaded) {
          const diag = await getRouteDiagnostics(win);
          assert(false, `dosya-detail yüklenmedi: hash=${diag.hash} error=${diag.visibleError || "—"} body=${diag.bodySnippet}`);
        }
      } else {
        try {
          await navigatePremiumHash(win, route, screen.selector);
        } catch (e) {
          const diag = await getRouteDiagnostics(win);
          const msg = e instanceof Error ? e.message : String(e);
          assert(false, `${screen.slug} yüklenmedi: ${msg} — hash=${diag.hash} error=${diag.visibleError || "—"} body=${diag.bodySnippet}`);
        }
      }
      const overflow = await horizontalOverflowPx(win);
      assert(overflow < 48, `${screen.slug} ${w}x${h} yatay taşma: ${overflow}px`);
      const sidebar = await win.webContents.executeJavaScript(`!!document.querySelector('.pm-sidebar')`, true);
      assert(sidebar, `${screen.slug}: sidebar yok`);
      await captureScreenshot(win, join(outDir, `${screen.slug}-${w}x${h}.png`));
      console.log(`[PASS] ${screen.slug} ${w}x${h}`);
    }
    console.log(`[DONE] responsive size ${w}x${h}`);
  } finally {
    await shutdownPremiumElectron(win, env.dbPath, true);
    cleanupIsolatedEnv(env);
  }
}

if (process.env.MKD_PREMIUM_RESPONSIVE_SIZE === "1") {
  app.on("window-all-closed", () => {});
  void run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[FAIL] Premium responsive size:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
