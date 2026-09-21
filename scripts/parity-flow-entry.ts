import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { closeDb, getDb, nowIso } from "../src/main/db/connection";
import { runMigrations } from "../src/main/db/migrate";
import { allMigrations } from "../src/main/migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "../src/main/ipc/handlers";
import { createPremiumWindow, seedLicenseActive } from "./lib/premium-e2e-harness";
import { PARITY_OUT } from "./lib/parity/constants";
import { runLegacyParityFlow } from "./lib/parity/flow";

type LegacyPaths = {
  baseDir: string;
  userDataDir: string;
  cacheDir: string;
  runDbPath: string | null;
};

let legacyPaths: LegacyPaths | null = null;

function setupLegacyParityPaths(): LegacyPaths {
  const baseDir = join(tmpdir(), `mkd-parity-legacy-${Date.now()}`);
  const userDataDir = join(baseDir, "user-data");
  const cacheDir = join(baseDir, "cache");
  mkdirSync(userDataDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  app.setPath("userData", userDataDir);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu");
  legacyPaths = { baseDir, userDataDir, cacheDir, runDbPath: null };
  return legacyPaths;
}

async function waitAppReady(timeoutMs: number): Promise<void> {
  console.log("[BOOT] app.whenReady bekleniyor");
  await Promise.race([
    app.whenReady(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`app.whenReady zaman aşımı (${timeoutMs}ms)`)), timeoutMs),
    ),
  ]);
  console.log("[BOOT] app.whenReady tamamlandı");
}

function cleanupLegacyPaths(): void {
  if (!legacyPaths) return;
  try {
    if (legacyPaths.runDbPath) rmSync(legacyPaths.runDbPath, { force: true });
    rmSync(legacyPaths.baseDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  legacyPaths = null;
}

function closeAllBrowserWindows(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.destroy();
  }
}

async function shutdownLegacyApp(): Promise<void> {
  closeAllBrowserWindows();
  closeDb();
  delete process.env.MKD_TEST_DB;
  cleanupLegacyPaths();
  if (!app.isReady()) return;
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    app.once("quit", finish);
    app.quit();
    setTimeout(finish, 3000);
  });
}

function prepareRunDb(sourceDb: string): string {
  const runDbPath = join(tmpdir(), `mkd-parity-legacy-run-${Date.now()}.sqlite`);
  copyFileSync(sourceDb, runDbPath);
  if (legacyPaths) legacyPaths.runDbPath = runDbPath;
  return runDbPath;
}

async function runLegacyOnly(): Promise<void> {
  const started = Date.now();
  const manifest = JSON.parse(readFileSync(join(PARITY_OUT, "manifest.json"), "utf8")) as {
    legacyDb: string;
  };
  const dbPath = join(process.cwd(), manifest.legacyDb);
  const runDbPath = prepareRunDb(dbPath);
  process.env.MKD_TEST_DB = runDbPath;
  console.log("[BOOT] MKD_TEST_DB ayarlandı:", runDbPath);

  let win: BrowserWindow | null = null;
  try {
    await waitAppReady(10_000);

    console.log("[BOOT] db açılıyor");
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    console.log("[BOOT] migration tamam");
    seedLicenseActive(db);
    console.log("[BOOT] lisans seed tamam");
    registerIpcHandlers();
    console.log("[BOOT] ipc handlers kayıtlı");
    initAuthOnReady();
    initLicenseOnReady();
    console.log("[BOOT] auth/license init tamam");

    console.log("[BOOT] pencere oluşturuluyor");
    win = createPremiumWindow(1366, 900);
    console.log("[BOOT] flow başlıyor");
    await runLegacyParityFlow(win);

    if (process.env.MKD_PARITY_LEGACY_STARTUP_PROBE === "1") {
      console.log("[BOOT] startup probe tamamlandı");
      return;
    }
    console.log(`[DONE] Legacy akış tamam (${Math.round((Date.now() - started) / 1000)}s)`);
  } finally {
    await shutdownLegacyApp();
  }
}

if (process.env.MKD_PARITY_LEGACY_FLOW === "1") {
  console.log("[BOOT] entry başladı");
  const paths = setupLegacyParityPaths();
  console.log("[BOOT] userData ayarlandı:", paths.userDataDir);
  app.on("window-all-closed", () => {});
  void runLegacyOnly()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
