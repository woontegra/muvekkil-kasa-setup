import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app, BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { setupFirst } from "../src/main/services/auth.service";
import {
  createPremiumWindow,
  loadPremiumRoute,
  PREMIUM_HTML,
  seedLicenseActive,
  waitForSelector,
} from "./lib/premium-e2e-harness";
import { PARITY } from "./lib/parity/constants";

function initProdUserData(): string {
  const dir = join(tmpdir(), `mkd-parity-prod-${Date.now()}`, "user-data");
  mkdirSync(dir, { recursive: true });
  delete process.env.MKD_TEST_DB;
  app.setPath("userData", dir);
  app.commandLine.appendSwitch("disable-gpu");
  return dir;
}

async function runProdVerify(): Promise<void> {
  const userData = initProdUserData();
  let win: BrowserWindow | null = null;
  try {
    await app.whenReady();
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    seedLicenseActive(db);
    setupFirst({
      adSoyad: PARITY.ad,
      kullaniciAdi: PARITY.user,
      sifre: PARITY.pass,
      guvenlikSorusuKodu: "G1",
      guvenlikCevabi: "test",
    });
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();

    win = createPremiumWindow(1280, 800);
    await win.loadFile(PREMIUM_HTML, { hash: "/login" });
    const loginOk = await waitForSelector(win.webContents, ".pm-login-panel", 30000);
    if (!loginOk) throw new Error("Production premium login yüklenmedi");
    console.log(`[PASS] Production premium login (userData=${userData})`);
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    closeDb();
    app.quit();
  }
}

if (process.env.MKD_PARITY_PROD === "1") {
  app.on("window-all-closed", () => {});
  void runProdVerify()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
