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
  getAccountingPeriodMode: () => ipcRenderer.invoke(IPC.appSettings.getAccountingPeriodMode),
  setAccountingPeriodMode: (mode: "MONTHLY" | "YEARLY") =>
    ipcRenderer.invoke(IPC.appSettings.setAccountingPeriodMode, mode),
  backupAl: () => ipcRenderer.invoke(IPC.backup.al),
  backupGeriYukle: () => ipcRenderer.invoke(IPC.backup.geriYukle),
  ofisKasaList: (f: unknown) => ipcRenderer.invoke(IPC.ofisKasa.list, f),
  ofisKasaUstOzet: (opts?: { referenceDate?: string }) => ipcRenderer.invoke(IPC.ofisKasa.ustOzet, opts),
  ofisKasaAnaSayfaOzet: (opts?: { referenceDate?: string }) =>
    ipcRenderer.invoke(IPC.ofisKasa.anaSayfaOzet, opts),
  ofisKasaEkle: (input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.ekle, input),
  ofisKasaGuncelle: (id: number, patch: unknown) => ipcRenderer.invoke(IPC.ofisKasa.guncelle, id, patch),
  ofisKasaSil: (id: number) => ipcRenderer.invoke(IPC.ofisKasa.sil, id),
  ofisKasaGuvenliSil: (id: number, input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.guvenliSil, id, input),
  ofisKasaOnayla: (id: number) => ipcRenderer.invoke(IPC.ofisKasa.onayla, id),
  ofisKasaDuzeltmeEkle: (input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.duzeltmeEkle, input),
  ofisKasaRaporPaketi: (input: { bas: string; bit: string }) =>
    ipcRenderer.invoke(IPC.ofisKasa.raporPaketi, input),
  ofisKasaDovizDonusum: (input: unknown) => ipcRenderer.invoke(IPC.ofisKasa.dovizDonusum, input),
  ofisKasaDovizDonusumSil: (dovizDonusumId: string) =>
    ipcRenderer.invoke(IPC.ofisKasa.dovizDonusumSil, dovizDonusumId),
  kurlarTcmb: (opts?: { date?: string; forceRefresh?: boolean }) =>
    ipcRenderer.invoke(IPC.kurlar.tcmb, opts),
  kurlarTcmbCapraz: (input: { baz: string; karsi: string; date?: string }) =>
    ipcRenderer.invoke(IPC.kurlar.tcmbCapraz, input),
  kurlarYaklasikTry: (
    items: { tutar: number; paraBirimi: string; id?: string }[],
    date?: string,
  ) => ipcRenderer.invoke(IPC.kurlar.yaklasikTry, items, date),
  muvekkilAra: (q: string) => ipcRenderer.invoke(IPC.muvekkil.ara, q),
  muvekkilAraPaged: (q: string, page: number, pageSize: number) =>
    ipcRenderer.invoke(IPC.muvekkil.araPaged, q, page, pageSize),
  muvekkilGet: (id: number) => ipcRenderer.invoke(IPC.muvekkil.get, id),
  muvekkilEkle: (input: unknown) => ipcRenderer.invoke(IPC.muvekkil.ekle, input),
  muvekkilGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.muvekkil.guncelle, id, input),
  muvekkilKarlilik: (id: number) => ipcRenderer.invoke(IPC.muvekkil.karlilik, id),
  muvekkilOfisGelirleri: (id: number, opts?: { page?: number; limit?: number }) =>
    ipcRenderer.invoke(IPC.muvekkil.ofisGelirleri, id, opts),
  maliKontrolUyarilar: () => ipcRenderer.invoke(IPC.maliKontrol.uyarilar),
  dosyaList: (muvekkilId: number) => ipcRenderer.invoke(IPC.dosya.list, muvekkilId),
  dosyaListAll: (params?: import("@shared/types/dosyaListe").DosyaListeParams) =>
    ipcRenderer.invoke(IPC.dosya.listAll, params),
  dosyaGet: (id: number) => ipcRenderer.invoke(IPC.dosya.get, id),
  dosyaEkle: (input: unknown) => ipcRenderer.invoke(IPC.dosya.ekle, input),
  dosyaGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.dosya.guncelle, id, input),
  dosyaHesapOzetPaketi: (dosyaId: number) => ipcRenderer.invoke(IPC.dosya.hesapOzetPaketi, dosyaId),
  dosyaMaliOzet: (dosyaId: number) => ipcRenderer.invoke(IPC.dosya.maliOzet, dosyaId),
  dosyaMuvekkilEkstre: (
    dosyaId: number,
    opts?: { itibariyleTarih?: string | null; belgeRef?: string | null },
  ) => ipcRenderer.invoke(IPC.dosya.muvekkilEkstre, dosyaId, opts),
  kasaList: (dosyaId: number) => ipcRenderer.invoke(IPC.kasa.list, dosyaId),
  kasaOzet: (dosyaId: number) => ipcRenderer.invoke(IPC.kasa.ozet, dosyaId),
  kasaEkle: (input: unknown) => ipcRenderer.invoke(IPC.kasa.ekle, input),
  kasaGuncelle: (id: number, patch: unknown) => ipcRenderer.invoke(IPC.kasa.guncelle, id, patch),
  kasaSil: (id: number) => ipcRenderer.invoke(IPC.kasa.sil, id),
  kasaGuvenliSil: (id: number, input: unknown) => ipcRenderer.invoke(IPC.kasa.guvenliSil, id, input),
  kasaOnayla: (id: number) => ipcRenderer.invoke(IPC.kasa.onayla, id),
  masrafTurleri: () => ipcRenderer.invoke(IPC.masrafTurleri),
  finansKalemiList: (opts?: {
    tur?: "GELIR" | "GIDER";
    aktif?: "true" | "false" | "all";
    includeSistem?: boolean;
    forForm?: boolean;
  }) => ipcRenderer.invoke(IPC.finansKalemi.list, opts),
  finansKalemiCreate: (tur: "GELIR" | "GIDER", ad: string) =>
    ipcRenderer.invoke(IPC.finansKalemi.create, tur, ad),
  finansKalemiUpdate: (id: number, ad: string) => ipcRenderer.invoke(IPC.finansKalemi.update, id, ad),
  finansKalemiArchive: (id: number) => ipcRenderer.invoke(IPC.finansKalemi.archive, id),
  finansKalemiActivate: (id: number) => ipcRenderer.invoke(IPC.finansKalemi.activate, id),
  finansKalemiReorder: (tur: "GELIR" | "GIDER", orderedIds: number[]) =>
    ipcRenderer.invoke(IPC.finansKalemi.reorder, tur, orderedIds),
  auditList: (opts?: { limit?: number; offset?: number }) => ipcRenderer.invoke(IPC.audit.list, opts),
  kullaniciYonetimList: () => ipcRenderer.invoke(IPC.kullaniciYonetim.list),
  kullaniciYonetimCreate: (input: unknown) => ipcRenderer.invoke(IPC.kullaniciYonetim.create, input),
  kullaniciYonetimSetAktif: (id: number, aktif: boolean) =>
    ipcRenderer.invoke(IPC.kullaniciYonetim.setAktif, id, aktif),
  kullaniciYonetimResetSifre: (id: number, yeniSifre: string) =>
    ipcRenderer.invoke(IPC.kullaniciYonetim.resetSifre, id, yeniSifre),
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
  vekaletTaksitleriTopluSil: (vekaletId: number) => ipcRenderer.invoke(IPC.vekalet.taksitleriTopluSil, vekaletId),
  vekaletTaksitOdemeAl: (taksitId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.taksitOdemeAl, taksitId, input),
  vekaletTaksitOdemeGuncelle: (odemeId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.taksitOdemeGuncelle, odemeId, input),
  vekaletTaksitOdemeGecmisi: (taksitId: number) => ipcRenderer.invoke(IPC.vekalet.taksitOdemeGecmisi, taksitId),
  vekaletSmmBekleyenler: (dosyaId?: number) => ipcRenderer.invoke(IPC.vekalet.smmBekleyenler, dosyaId),
  vekaletTaksitUyariOzet: () => ipcRenderer.invoke(IPC.vekalet.taksitUyariOzet),
  vekaletSmmKesildi: (odemeId: number) => ipcRenderer.invoke(IPC.vekalet.smmKesildi, odemeId),
  vekaletGuvenliSilTaksit: (id: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.guvenliSilTaksit, id, input),
  vekaletGuvenliSilTahsilat: (id: number, input: unknown) =>
    ipcRenderer.invoke(IPC.vekalet.guvenliSilTahsilat, id, input),
  tahsilatMerkeziOzet: () => ipcRenderer.invoke(IPC.tahsilatMerkezi.ozet),
  tahsilatMerkeziList: (params: unknown) => ipcRenderer.invoke(IPC.tahsilatMerkezi.list, params),
  icraTahsilatUstOzet: () => ipcRenderer.invoke(IPC.icraTahsilat.ustOzet),
  icraTahsilatList: (filtre: unknown) => ipcRenderer.invoke(IPC.icraTahsilat.list, filtre),
  icraTahsilatAlacakOlustur: (input: unknown) => ipcRenderer.invoke(IPC.icraTahsilat.alacakOlustur, input),
  icraTahsilatTaksitList: (alacakId: number) => ipcRenderer.invoke(IPC.icraTahsilat.taksitList, alacakId),
  icraTahsilatTaksitOdemeAl: (taksitId: number, input: unknown) =>
    ipcRenderer.invoke(IPC.icraTahsilat.taksitOdemeAl, taksitId, input),
  icraTahsilatTaksitOdemeGecmisi: (taksitId: number) =>
    ipcRenderer.invoke(IPC.icraTahsilat.taksitOdemeGecmisi, taksitId),
  icraTahsilatTaksitSil: (taksitId: number) => ipcRenderer.invoke(IPC.icraTahsilat.taksitSil, taksitId),
  icraTahsilatTaksitGuncelle: (taksitId: number, patch: unknown) =>
    ipcRenderer.invoke(IPC.icraTahsilat.taksitGuncelle, taksitId, patch),
  icraTahsilatSmmKesildi: (odemeId: number) => ipcRenderer.invoke(IPC.icraTahsilat.smmKesildi, odemeId),
  icraTahsilatAlacakIptal: (alacakId: number) => ipcRenderer.invoke(IPC.icraTahsilat.alacakIptal, alacakId),
  randevuList: (filtre: unknown) => ipcRenderer.invoke(IPC.randevu.list, filtre),
  randevuGet: (id: number) => ipcRenderer.invoke(IPC.randevu.get, id),
  randevuOlustur: (input: unknown) => ipcRenderer.invoke(IPC.randevu.olustur, input),
  randevuGuncelle: (id: number, input: unknown) => ipcRenderer.invoke(IPC.randevu.guncelle, id, input),
  randevuSil: (id: number) => ipcRenderer.invoke(IPC.randevu.sil, id),
  randevuKullanicilar: () => ipcRenderer.invoke(IPC.randevu.kullanicilar),
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
  openContactLink: (url: string) => ipcRenderer.invoke(IPC.util.openContactLink, url),
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
