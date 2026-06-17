import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { getDb, nowIso } from "./db/connection";
import { runMigrations } from "./db/migrate";
import { allMigrations } from "./migrations";
import { registerIpcHandlers, initAuthOnReady } from "./ipc/handlers";
import { approveAllPendingOfisKasaOnExit } from "./services/ofisKasa.service";
import { createMainWindow } from "./window";

if (process.platform === "win32") {
  app.setAppUserModelId("com.woontegra.muvekkilkasadefteri");
}

let mainWindow: BrowserWindow | null = null;

function initDatabase(): void {
  const db = getDb();
  runMigrations(db, allMigrations, nowIso);
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  initAuthOnReady();
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
