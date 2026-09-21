import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "@shared/ipc";

const api = {
  authNeedsSetup: () => ipcRenderer.invoke(IPC.auth.needsSetup),
  authGetSession: () => ipcRenderer.invoke(IPC.auth.getSession),
  authLogin: (input: unknown) => ipcRenderer.invoke(IPC.auth.login, input),
  authSetupFirst: (input: unknown) => ipcRenderer.invoke(IPC.auth.setupFirst, input),
  authLogout: () => ipcRenderer.invoke(IPC.auth.logout),
  authForgotPasswordGetQuestion: (kullaniciAdi: string) =>
    ipcRenderer.invoke(IPC.auth.forgotPasswordGetQuestion, kullaniciAdi),
  authForgotPasswordSubmit: (input: unknown) => ipcRenderer.invoke(IPC.auth.forgotPasswordSubmit, input),
  getRememberedLogin: () => ipcRenderer.invoke(IPC.auth.getRememberedLogin),
  saveRememberedLogin: (kullaniciAdi: string) => ipcRenderer.invoke(IPC.auth.saveRememberedLogin, kullaniciAdi),
  clearRememberedLogin: () => ipcRenderer.invoke(IPC.auth.clearRememberedLogin),
  authGuvenlikBilgisi: () => ipcRenderer.invoke(IPC.auth.guvenlikBilgisi),
  authGuvenlikGuncelle: (input: unknown) => ipcRenderer.invoke(IPC.auth.guvenlikGuncelle, input),
  authSifreGuncelle: (input: unknown) => ipcRenderer.invoke(IPC.auth.sifreGuncelle, input),
  getAppVersion: () => ipcRenderer.invoke(IPC.app.getVersion),
  officeGet: () => ipcRenderer.invoke(IPC.office.get),
  officeSave: (input: unknown) => ipcRenderer.invoke(IPC.office.save, input),
  officePickLogo: () => ipcRenderer.invoke(IPC.office.pickLogo),
  officeLogoDataUrl: (filePath: string) => ipcRenderer.invoke(IPC.office.logoDataUrl, filePath),
  backupAl: () => ipcRenderer.invoke(IPC.backup.al),
  backupGeriYukle: () => ipcRenderer.invoke(IPC.backup.geriYukle),
  ofisKasaList: (f: unknown) => ipcRenderer.invoke(IPC.ofisKasa.list, f),
  ofisKasaUstOzet: () => ipcRenderer.invoke(IPC.ofisKasa.ustOzet),
  ofisKasaAnaSayfaOzet: () => ipcRenderer.invoke(IPC.ofisKasa.anaSayfaOzet),
  ofisKasaEkle: (input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.ekle, input),
  ofisKasaGuncelle: (id: number, patch: unknown) => ipcRenderer.invoke(IPC.ofisKasa.guncelle, id, patch),
  ofisKasaSil: (id: number) => ipcRenderer.invoke(IPC.ofisKasa.sil, id),
  ofisKasaOnayla: (id: number) => ipcRenderer.invoke(IPC.ofisKasa.onayla, id),
  ofisKasaDuzeltmeEkle: (input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.duzeltmeEkle, input),
  ofisKasaRaporPaketi: (input: { bas: string; bit: string }) =>
    ipcRenderer.invoke(IPC.ofisKasa.raporPaketi, input),
  muvekkilAra: (q: string) => ipcRenderer.invoke(IPC.muvekkil.ara, q),
  muvekkilAraPaged: (q: string, page: number, pageSize: number) =>
    ipcRenderer.invoke(IPC.muvekkil.araPaged, q, page, pageSize),
  muvekkilGet: (id: number) => ipcRenderer.invoke(IPC.muvekkil.get, id),
  muvekkilEkle: (input: unknown) => ipcRenderer.invoke(IPC.muvekkil.ekle, input),
  muvekkilGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.muvekkil.guncelle, id, input),
  dosyaList: (muvekkilId: number) => ipcRenderer.invoke(IPC.dosya.list, muvekkilId),
  dosyaGet: (id: number) => ipcRenderer.invoke(IPC.dosya.get, id),
  dosyaEkle: (input: unknown) => ipcRenderer.invoke(IPC.dosya.ekle, input),
  dosyaGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.dosya.guncelle, id, input),
  dosyaHesapOzetPaketi: (dosyaId: number) => ipcRenderer.invoke(IPC.dosya.hesapOzetPaketi, dosyaId),
  kasaList: (dosyaId: number) => ipcRenderer.invoke(IPC.kasa.list, dosyaId),
  kasaOzet: (dosyaId: number) => ipcRenderer.invoke(IPC.kasa.ozet, dosyaId),
  kasaEkle: (input: unknown) => ipcRenderer.invoke(IPC.kasa.ekle, input),
  kasaGuncelle: (id: number, patch: unknown) => ipcRenderer.invoke(IPC.kasa.guncelle, id, patch),
  kasaSil: (id: number) => ipcRenderer.invoke(IPC.kasa.sil, id),
  kasaOnayla: (id: number) => ipcRenderer.invoke(IPC.kasa.onayla, id),
  masrafTurleri: () => ipcRenderer.invoke(IPC.masrafTurleri),
  vekaletGetOrCreate: (dosyaId: number, muvekkilId: number) =>
    ipcRenderer.invoke(IPC.vekalet.getOrCreate, dosyaId, muvekkilId),
  vekaletByDosya: (dosyaId: number) => ipcRenderer.invoke(IPC.vekalet.byDosya, dosyaId),
  vekaletKaydet: (dosyaId: number, muvekkilId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.kaydet, dosyaId, muvekkilId, input),
  vekaletGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.vekalet.guncelle, id, input),
  vekaletTaksitList: (vekaletId: number) => ipcRenderer.invoke(IPC.vekalet.taksitList, vekaletId),
  vekaletTaksitEkle: (vekaletId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.taksitEkle, vekaletId, input),
  vekaletTaksitGuncelle: (id: number, patch: unknown) => ipcRenderer.invoke(IPC.vekalet.taksitGuncelle, id, patch),
  vekaletTaksitSil: (id: number) => ipcRenderer.invoke(IPC.vekalet.taksitSil, id),
  vekaletTaksitOdemeAl: (taksitId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.taksitOdemeAl, taksitId, input),
  vekaletTaksitOdemeGecmisi: (taksitId: number) => ipcRenderer.invoke(IPC.vekalet.taksitOdemeGecmisi, taksitId),
  vekaletSmmBekleyenler: (dosyaId?: number) => ipcRenderer.invoke(IPC.vekalet.smmBekleyenler, dosyaId),
  vekaletSmmKesildi: (odemeId: number) => ipcRenderer.invoke(IPC.vekalet.smmKesildi, odemeId),
  makbuzYazdirmaPaketi: (hareketId: number) => ipcRenderer.invoke(IPC.makbuz.yazdirmaPaketi, hareketId),
  printGetPrinters: () => ipcRenderer.invoke(IPC.print.getPrinters),
  printDocument: (req: import("@shared/types/print").PrintDocumentRequest) =>
    ipcRenderer.invoke(IPC.print.document, req),
  printHtmlToPdf: (req: import("@shared/types/print").HtmlToPdfRequest) =>
    ipcRenderer.invoke(IPC.print.htmlToPdf, req),
  printPdf: (req: import("@shared/types/print").PrintPdfRequest) => ipcRenderer.invoke(IPC.print.pdf, req),
  ensureReceiptNumberForTransaction: (hareketId: number) =>
    ipcRenderer.invoke(IPC.makbuz.ensureReceiptNumber, hareketId),
  getReceiptDataByTransactionId: (hareketId: number) =>
    ipcRenderer.invoke(IPC.makbuz.getReceiptData, hareketId),
  ensureVekaletReceiptNumberForInstallment: (taksitId: number) =>
    ipcRenderer.invoke(IPC.vekaletMakbuz.ensureReceiptNumber, taksitId, "taksit"),
  ensureVekaletReceiptNumberForOdeme: (odemeId: number) =>
    ipcRenderer.invoke(IPC.vekaletMakbuz.ensureReceiptNumber, odemeId, "odeme"),
  getVekaletReceiptDataByInstallmentId: (taksitId: number) =>
    ipcRenderer.invoke(IPC.vekaletMakbuz.getPrintPackage, taksitId),
  getVekaletPrintPackageByOdemeId: (odemeId: number) =>
    ipcRenderer.invoke(IPC.vekaletMakbuz.getPrintPackageByOdemeId, odemeId),
  pathToFileUrl: (filePath: string) => ipcRenderer.invoke(IPC.util.pathToFileUrl, filePath),
  licenseGetState: () => ipcRenderer.invoke(IPC.license.getState),
  licenseActivate: (input: import("@shared/types/license").LicenseActivateInput) =>
    ipcRenderer.invoke(IPC.license.activate, input),
  licenseStartTrial: (input: import("@shared/types/license").LicenseStartTrialInput) =>
    ipcRenderer.invoke(IPC.license.startTrial, input),
  licenseValidate: (options?: import("@shared/types/license").LicenseValidateOptions) =>
    ipcRenderer.invoke(IPC.license.validate, options),
  licenseOpenRenewalUrl: () => ipcRenderer.invoke(IPC.license.openRenewalUrl),
  appQuit: () => ipcRenderer.invoke(IPC.app.quit),
  updateGetStatus: () => ipcRenderer.invoke(IPC.update.getStatus),
  updateCheck: (source?: "auto" | "manual") => ipcRenderer.invoke(IPC.update.check, source ?? "manual"),
  updateDownload: () => ipcRenderer.invoke(IPC.update.download),
  updateInstall: () => ipcRenderer.invoke(IPC.update.install),
  updateDismiss: () => ipcRenderer.invoke(IPC.update.dismiss),
  onUpdateStatusChanged: (cb: (status: import("@shared/types/update").UpdateStatusSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: import("@shared/types/update").UpdateStatusSnapshot) =>
      cb(status);
    ipcRenderer.on(IPC.update.statusChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC.update.statusChanged, listener);
    };
  },
};

contextBridge.exposeInMainWorld("api", api);

export type Api = typeof api;
