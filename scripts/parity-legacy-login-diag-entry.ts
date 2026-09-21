import { join } from "node:path";
import { readFileSync } from "node:fs";
import { app, type BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { seedLicenseActive } from "./lib/premium-e2e-harness";
import { cleanupIsolatedEnv, initIsolatedElectronEnv } from "./lib/premium-e2e-isolation";
import { PARITY_OUT } from "./lib/parity/constants";
import {
  captureLegacyFailure,
  createVisibleLegacyWindow,
  loadLegacyBoot,
  logLegacyProbe,
  probeLegacyScreen,
} from "./lib/parity/legacy-screen";

async function runDiag(): Promise<void> {
  const started = Date.now();
  const manifestPath = join(PARITY_OUT, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { legacyDb: string };
  const dbPath = join(process.cwd(), manifest.legacyDb);
  const env = initIsolatedElectronEnv(`legacy-login-diag-${Date.now()}`, dbPath);
  const consoleErrors: string[] = [];
  const ipcErrors: string[] = [];
  let win: BrowserWindow | null = null;

  try {
    await app.whenReady();
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    win = createVisibleLegacyWindow();
    win.webContents.on("console-message", (_e, level, msg) => {
      const m = String(msg);
      if (level >= 2) consoleErrors.push(m);
      if (/ipc|sqlite|error/i.test(m)) ipcErrors.push(m);
    });
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
      ipcErrors.push(`did-fail-load ${code} ${desc} ${url}`);
    });

    console.log("[DIAG] Legacy pencere görünür açılıyor…");
    await loadLegacyBoot(win, "/login");

    let foundLogin = false;
    for (let tick = 0; tick <= 60; tick += 5) {
      const p = await probeLegacyScreen(win.webContents);
      logLegacyProbe(tick, p);
      if (p.screen === "login" || p.selectors.login) {
        foundLogin = true;
        console.log(`[PASS] Login ekranı t=${tick}s screen=${p.screen}`);
        break;
      }
      if (p.screen === "home") {
        console.log(`[INFO] Zaten ana sayfa (oturum?) t=${tick}s`);
        foundLogin = true;
        break;
      }
      if (p.screen === "setup") {
        console.log(`[INFO] Setup ekranı açık — test akışı setup gerektiriyor`);
        break;
      }
      if (p.screen === "license-activate" || p.screen === "license-locked") {
        console.log(`[INFO] Lisans ekranı: ${p.screen}`);
        break;
      }
      if (tick >= 60) break;
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (!foundLogin) {
      const p = await probeLegacyScreen(win.webContents);
      console.error("[FAIL] Login selector bulunamadı (60s)");
      console.error("[FAIL] active=", p.activeTag, p.activeId);
      console.error("[FAIL] inputs=", p.inputs.join(" | "));
      console.error("[FAIL] buttons=", p.buttons.join(" | "));
      if (consoleErrors.length) console.error("[FAIL] console=", consoleErrors.slice(0, 20));
      if (ipcErrors.length) console.error("[FAIL] ipc=", ipcErrors.slice(0, 20));
      await captureLegacyFailure(win, "login-diag", consoleErrors, ipcErrors);
      process.exit(1);
    }

    console.log(`[DONE] Teşhis tamam (${Math.round((Date.now() - started) / 1000)}s)`);
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    closeDb();
    delete process.env.MKD_TEST_DB;
    cleanupIsolatedEnv(env);
    app.quit();
  }
}

if (process.env.MKD_PARITY_LEGACY_LOGIN_DIAG === "1") {
  app.on("window-all-closed", () => {});
  void runDiag()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
