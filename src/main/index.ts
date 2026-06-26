import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { getDb, nowIso } from "./db/connection";
import { runMigrations } from "./db/migrate";
import { allMigrations } from "./migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady } from "./ipc/handlers";
import { approveAllPendingOfisKasaOnExit } from "./services/ofisKasa.service";
import { createMainWindow } from "./window";
import { runVekaletOfisSmoke } from "./e2e/vekaletOfisSmoke";

if (process.env.MKD_E2E_VEKALET_OFIS === "1") {
  void runVekaletOfisSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.platform === "win32") {
  app.setAppUserModelId("com.woontegra.muvekkilkasadefteri");
}

let mainWindow: BrowserWindow | null = null;

function initDatabase(): void {
  const db = getDb();
  runMigrations(db, allMigrations, nowIso);
}

if (process.env.MKD_E2E_VEKALET_OFIS !== "1") {
  app.whenReady().then(() => {
    initDatabase();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    mainWindow = createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    try {
      approveAllPendingOfisKasaOnExit();
    } catch (e) {
      console.error("[main] approveAllPendingOfisKasaOnExit", e);
    }
  });
}
