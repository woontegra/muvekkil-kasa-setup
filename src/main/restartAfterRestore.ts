import { app, dialog, type BrowserWindow, type MessageBoxOptions } from "electron";
import { requestRelaunchAfterQuit } from "./shutdown";

export type RestartAfterRestoreChoice = "restarting" | "later" | "manual";

function showBox(win: BrowserWindow | null, options: MessageBoxOptions) {
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
}

/** Oturum geri yükleme sırasında zaten kapatılmıştır; bu yalnızca yeniden başlatma tercihini sorar. */
export async function offerRestartAfterRestore(
  win: BrowserWindow | null,
  autoBackupPath: string,
): Promise<RestartAfterRestoreChoice> {
  const { response } = await showBox(win, {
    type: "info",
    title: "Geri yükleme tamamlandı",
    message: "Yedek başarıyla geri yüklendi. Güvenlik için oturumunuz kapatıldı.",
    detail:
      `Önceki veritabanının yedeği: ${autoBackupPath}\n\n` +
      "Değişikliklerin tam yansıması için programı yeniden başlatmanız önerilir. " +
      "Daha Sonra'yı seçerseniz giriş ekranına yönlendirilirsiniz.",
    buttons: ["Şimdi Yeniden Başlat", "Daha Sonra"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (response !== 0) return "later";

  if (!app.isPackaged) {
    await showBox(win, {
      type: "info",
      title: "Yeniden başlatma",
      message: "Geliştirme ortamında otomatik yeniden başlatma yapılmaz.",
      detail: "Programı kapatıp elle yeniden başlatın. Şimdilik giriş ekranına yönlendirileceksiniz.",
      buttons: ["Tamam"],
      noLink: true,
    });
    return "manual";
  }

  requestRelaunchAfterQuit();
  setImmediate(() => app.quit());
  return "restarting";
}
