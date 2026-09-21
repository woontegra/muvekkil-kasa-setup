import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { getDb, nowIso } from "./db/connection";
import { runMigrations } from "./db/migrate";
import { allMigrations } from "./migrations";
import { registerIpcHandlers, initAuthOnReady, initLicenseOnReady, initUpdateOnReady, scheduleAutoUpdateCheck } from "./ipc/handlers";
import { installGracefulShutdown, runStartupPendingApprovalRecovery } from "./shutdown";
import { createMainWindow } from "./window";
import { runVekaletOfisSmoke } from "./e2e/vekaletOfisSmoke";
import { runGuiLiveSmoke } from "./e2e/guiLiveSmoke";
import { runVekaletScrollSmoke } from "./e2e/vekaletScrollSmoke";
import { runVekaletTaksitUyariSmoke } from "./e2e/vekaletTaksitUyariSmoke";
import { runVekaletTaksitLimitSmoke } from "./e2e/vekaletTaksitLimitSmoke";
import { runIcraTahsilatSmoke } from "./e2e/icraTahsilatSmoke";
import { runVekaletTaksitSilInputSmoke } from "./e2e/vekaletTaksitSilInputSmoke";
import { runPendingApprovalSmoke } from "./e2e/pendingApprovalSmoke";
import { runMasrafInputSmoke } from "./e2e/masrafInputSmoke";
import { runAccountingPeriodSmoke } from "./e2e/accountingPeriodSmoke";
import { runMultiCurrencySmoke } from "./e2e/multiCurrencySmoke";
import { runFinansKalemParitySmoke } from "./e2e/finansKalemParitySmoke";
import { runRandevuSmoke } from "./e2e/randevuSmoke";
import { runTahsilatMerkeziSmoke } from "./e2e/tahsilatMerkeziSmoke";
import { runGuvenliSilSmoke } from "./e2e/guvenliSilSmoke";
import { runVekaletGuvenliIptalSmoke } from "./e2e/vekaletGuvenliIptalSmoke";
import { runMaliEkstreSmoke } from "./e2e/maliEkstreSmoke";
import { runFinalParitySmoke } from "./e2e/finalParitySmoke";

if (process.env.MKD_FINAL_PARITY_TEST === "1") {
  void runFinalParitySmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_MALI_EKSTRE_TEST === "1") {
  void runMaliEkstreSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_VEKALET_GUVENLI_SIL_TEST === "1") {
  void runVekaletGuvenliIptalSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_GUVENLI_SIL_TEST === "1") {
  void runGuvenliSilSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_TAHSILAT_MERKEZI_TEST === "1") {
  void runTahsilatMerkeziSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_RANDEVU_TEST === "1") {
  void runRandevuSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_FINANS_KALEM_TEST === "1") {
  void runFinansKalemParitySmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_MULTI_CURRENCY_TEST === "1") {
  void runMultiCurrencySmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_ACCOUNTING_PERIOD_TEST === "1") {
  void runAccountingPeriodSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_PENDING_APPROVAL_TEST === "1") {
  void runPendingApprovalSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_MASRAF_INPUT_TEST === "1") {
  void runMasrafInputSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_ICRA_TAHSILAT_TEST === "1") {
  void runIcraTahsilatSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_VEKALET_SIL_INPUT_TEST === "1") {
  void runVekaletTaksitSilInputSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_E2E_VEKALET_OFIS === "1") {
  void runVekaletOfisSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_VEKALET_UYARI_TEST === "1") {
  void runVekaletTaksitUyariSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_VEKALET_LIMIT_TEST === "1") {
  void runVekaletTaksitLimitSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_VEKALET_SCROLL_TEST === "1") {
  void runVekaletScrollSmoke()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (process.env.MKD_GUI_LIVE_TEST === "1") {
  void runGuiLiveSmoke()
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

if (
  process.env.MKD_E2E_VEKALET_OFIS !== "1" &&
  process.env.MKD_GUI_LIVE_TEST !== "1" &&
  process.env.MKD_VEKALET_SCROLL_TEST !== "1" &&
  process.env.MKD_VEKALET_UYARI_TEST !== "1" &&
  process.env.MKD_VEKALET_LIMIT_TEST !== "1" &&
  process.env.MKD_ICRA_TAHSILAT_TEST !== "1" &&
  process.env.MKD_VEKALET_SIL_INPUT_TEST !== "1" &&
  process.env.MKD_PENDING_APPROVAL_TEST !== "1" &&
  process.env.MKD_MASRAF_INPUT_TEST !== "1" &&
  process.env.MKD_ACCOUNTING_PERIOD_TEST !== "1" &&
  process.env.MKD_MULTI_CURRENCY_TEST !== "1" &&
  process.env.MKD_FINANS_KALEM_TEST !== "1" &&
  process.env.MKD_RANDEVU_TEST !== "1" &&
  process.env.MKD_TAHSILAT_MERKEZI_TEST !== "1" &&
  process.env.MKD_GUVENLI_SIL_TEST !== "1" &&
  process.env.MKD_VEKALET_GUVENLI_SIL_TEST !== "1" &&
  process.env.MKD_MALI_EKSTRE_TEST !== "1" &&
  process.env.MKD_FINAL_PARITY_TEST !== "1"
) {
  app.whenReady().then(() => {
    initDatabase();
    runStartupPendingApprovalRecovery();
    registerIpcHandlers();
    initAuthOnReady();
    initLicenseOnReady();
    initUpdateOnReady();
    installGracefulShutdown();
    mainWindow = createMainWindow();
    mainWindow.webContents.once("did-finish-load", () => {
      scheduleAutoUpdateCheck(5000);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        mainWindow.webContents.once("did-finish-load", () => {
          scheduleAutoUpdateCheck(5000);
        });
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
