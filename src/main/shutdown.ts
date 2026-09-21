import { app, dialog } from "electron";
import { closeDb } from "./db/connection";
import {
  finalizePendingApprovals,
  logPendingApprovalResult,
  type PendingApprovalFinalizeResult,
} from "./services/pendingApproval.service";

let finalizeStarted = false;
let finalizeCompleted = false;

function runFinalize(): PendingApprovalFinalizeResult {
  const result = finalizePendingApprovals();
  logPendingApprovalResult("kapanis", result);
  return result;
}

export function runStartupPendingApprovalRecovery(): void {
  try {
    const result = finalizePendingApprovals();
    logPendingApprovalResult("acilis", result);
  } catch (e) {
    console.error("[acilis] bekleyen onay kurtarma hatası", e);
  }
}

export function installGracefulShutdown(): void {
  app.on("before-quit", (event) => {
    if (finalizeCompleted) return;

    event.preventDefault();

    if (finalizeStarted) return;
    finalizeStarted = true;

    try {
      const result = runFinalize();
      if (result.errors.length > 0) {
        const detail = result.errors
          .slice(0, 5)
          .map((e) => `#${e.id} (${e.kind}): ${e.message}`)
          .join("\n");
        const choice = dialog.showMessageBoxSync({
          type: "warning",
          title: "Bekleyen işlemler",
          message:
            "Bazı bekleyen işlemler kesinleştirilemedi. Verileriniz korunuyor. Lütfen programı yeniden açıp işlemleri kontrol edin.",
          detail: detail || undefined,
          buttons: ["Yeniden dene", "Yine de çık", "İptal"],
          defaultId: 0,
          cancelId: 2,
        });
        if (choice === 0) {
          finalizeStarted = false;
          void app.quit();
          return;
        }
        if (choice === 2) {
          finalizeStarted = false;
          return;
        }
      }
      closeDb();
      finalizeCompleted = true;
      void app.quit();
    } catch (e) {
      console.error("[kapanis] finalize hatası", e);
      const choice = dialog.showMessageBoxSync({
        type: "error",
        title: "Kapanış hatası",
        message:
          "Bekleyen işlemler kesinleştirilemedi. Verileriniz korunuyor. Lütfen programı yeniden açıp işlemleri kontrol edin.",
        buttons: ["Yeniden dene", "Yine de çık", "İptal"],
        defaultId: 0,
        cancelId: 2,
      });
      if (choice === 0) {
        finalizeStarted = false;
        void app.quit();
        return;
      }
      if (choice === 1) {
        try {
          closeDb();
        } catch {
          /* ignore */
        }
        finalizeCompleted = true;
        void app.quit();
        return;
      }
      finalizeStarted = false;
    }
  });
}
