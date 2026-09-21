import { ipcMain, app, shell } from "electron";
import { pathToFileURL } from "node:url";
import { IPC } from "@shared/ipc";
import {
  ensureReceiptNumberForTransaction,
  getReceiptDataByTransactionId,
  makbuzYazdirmaPaketiGetir,
} from "../services/makbuz.service";
import { getSystemPrinters, htmlToPdf, silentPrintDocument, silentPrintPdf } from "../services/makbuzPrint.service";
import { dosyaHesapOzetPaketiGetir } from "../services/hesapOzet.service";
import {
  ensureVekaletReceiptNumberForInstallment,
  ensureVekaletReceiptNumberForOdeme,
  getVekaletPrintPackageByOdemeId,
  getVekaletReceiptDataByInstallmentId,
} from "../services/vekaletMakbuz.service";
import {
  hesaplaAvansBakiye,
  kasaHareketEkle,
  kasaHareketGuncelle,
  kasaHareketList,
  kasaHareketOnayla,
  kasaHareketSil,
  masrafTurleriList,
} from "../services/kasa.service";
import {
  vekaletByDosya,
  vekaletGetOrCreate,
  vekaletGuncelle,
  vekaletKaydet,
  vekaletSmmBekleyenler,
  vekaletSmmKesildi,
  vekaletTaksitEkle,
  vekaletTaksitGuncelle,
  vekaletTaksitList,
  vekaletTaksitOdemeAl,
  vekaletTaksitOdemeGecmisi,
  vekaletTaksitSil,
} from "../services/vekalet.service";
import {
  dosyaEkle,
  dosyaGet,
  dosyaGuncelle,
  dosyaListByMuvekkil,
} from "../services/dosya.service";
import {
  muvekkilAra,
  muvekkilAraPaged,
  muvekkilEkle,
  muvekkilGet,
  muvekkilGuncelle,
} from "../services/muvekkil.service";
import {
  authGetSession,
  authGuvenlikBilgisi,
  authGuvenlikGuncelle,
  authSifreGuncelle,
  authLoginSuccess,
  authLogout,
  authRestoreRemembered,
  clearRememberedLogin,
  forgotPasswordGetQuestion,
  forgotPasswordSubmit,
  getRememberedLogin,
  login,
  needsSetup,
  saveRememberedLogin,
  setupFirst,
} from "../services/auth.service";
import {
  getOfisKasaRaporPaketi,
  ofisKasaAnaSayfaOzet,
  ofisKasaDuzeltmeEkle,
  ofisKasaHareketEkle,
  ofisKasaHareketGuncelle,
  ofisKasaHareketList,
  ofisKasaHareketOnayla,
  ofisKasaHareketSil,
  ofisKasaUstOzet,
} from "../services/ofisKasa.service";
import { backupDatabase, restoreDatabase } from "../services/backup.service";
import { officeLogoDataUrl, officePickLogo, officeSettingsGet, officeSettingsSave } from "../services/office.service";
import {
  clearTrialGrantedPendingSetup,
  licenseActivate,
  licenseGetStateForRenderer,
  licenseRequestRenewalLink,
  licenseStartTrial,
  licenseValidate,
  licenseValidateOnStartup,
} from "../services/license.service";
import { installIpcLicenseAuthorization } from "./licenseAuthorization";
import {
  checkForUpdates,
  dismissUpdatePrompt,
  downloadUpdate,
  getUpdateStatus,
  initUpdateService,
  installUpdate,
  scheduleAutoUpdateCheck,
} from "../services/update.service";

function oturumKullaniciEtiketi(): { id: number | null; ad: string | null } {
  const s = authGetSession();
  if (!s) return { id: null, ad: null };
  const ad = s.adSoyad.trim() || s.kullaniciAdi;
  return { id: s.id, ad };
}

export function registerIpcHandlers(): void {
  installIpcLicenseAuthorization();
  ipcMain.handle(IPC.auth.needsSetup, () => needsSetup());
  ipcMain.handle(IPC.auth.getSession, () => authGetSession());
  ipcMain.handle(IPC.auth.login, (_e, payload) => login(payload));
  ipcMain.handle(IPC.auth.setupFirst, (_e, input) => {
    try {
      const r = setupFirst(input);
      if (r.ok) clearTrialGrantedPendingSetup();
      return r;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Hesap oluşturulamadı." };
    }
  });
  ipcMain.handle(IPC.auth.forgotPasswordGetQuestion, (_e, kullaniciAdi: string) =>
    forgotPasswordGetQuestion(kullaniciAdi)
  );
  ipcMain.handle(IPC.auth.forgotPasswordSubmit, (_e, input) => forgotPasswordSubmit(input));
  ipcMain.handle(IPC.auth.logout, () => {
    authLogout();
    return { ok: true };
  });
  ipcMain.handle(IPC.auth.getRememberedLogin, () => getRememberedLogin());
  ipcMain.handle(IPC.auth.saveRememberedLogin, (_e, kullaniciAdi: string) => saveRememberedLogin(kullaniciAdi));
  ipcMain.handle(IPC.auth.clearRememberedLogin, () => {
    clearRememberedLogin();
    return { ok: true };
  });
  ipcMain.handle(IPC.auth.guvenlikBilgisi, () => {
    const s = authGetSession();
    if (!s) return { ok: false as const, error: "Oturum bulunamadı." };
    return authGuvenlikBilgisi(s.id);
  });
  ipcMain.handle(IPC.auth.guvenlikGuncelle, (_e, input) => {
    const s = authGetSession();
    if (!s) return { ok: false as const, error: "Oturum bulunamadı." };
    return authGuvenlikGuncelle(s.id, input);
  });
  ipcMain.handle(IPC.auth.sifreGuncelle, (_e, input) => {
    const s = authGetSession();
    if (!s) return { ok: false as const, error: "Oturum bulunamadı." };
    return authSifreGuncelle(s.id, input);
  });
  ipcMain.handle(IPC.app.quit, () => {
    app.quit();
    return { ok: true };
  });
  ipcMain.handle(IPC.app.getVersion, () => app.getVersion());

  ipcMain.handle(IPC.office.get, () => officeSettingsGet());
  ipcMain.handle(IPC.office.save, (_e, input) => officeSettingsSave(input));
  ipcMain.handle(IPC.office.pickLogo, () => officePickLogo());
  ipcMain.handle(IPC.office.logoDataUrl, (_e, filePath: string) => officeLogoDataUrl(filePath));
  ipcMain.handle(IPC.backup.al, () => backupDatabase());
  ipcMain.handle(IPC.backup.geriYukle, () => restoreDatabase());

  ipcMain.handle(IPC.ofisKasa.list, (_e, f) => ofisKasaHareketList(f));
  ipcMain.handle(IPC.ofisKasa.ustOzet, (_e, opts?: { referenceDate?: string }) => ofisKasaUstOzet(opts));
  ipcMain.handle(IPC.ofisKasa.anaSayfaOzet, (_e, opts?: { referenceDate?: string }) => ofisKasaAnaSayfaOzet(opts));
  ipcMain.handle(IPC.ofisKasa.ekle, (_e, input) => {
    const o = oturumKullaniciEtiketi();
    return ofisKasaHareketEkle(input, o.id, o.ad);
  });
  ipcMain.handle(IPC.ofisKasa.guncelle, (_e, id: number, patch) => ofisKasaHareketGuncelle(id, patch));
  ipcMain.handle(IPC.ofisKasa.sil, (_e, id: number) => ofisKasaHareketSil(id));
  ipcMain.handle(IPC.ofisKasa.onayla, (_e, id: number) => {
    const o = oturumKullaniciEtiketi();
    return ofisKasaHareketOnayla(id, o.id, o.ad);
  });
  ipcMain.handle(IPC.ofisKasa.duzeltmeEkle, (_e, input) => {
    const o = oturumKullaniciEtiketi();
    return ofisKasaDuzeltmeEkle(input, o.id, o.ad);
  });
  ipcMain.handle(IPC.ofisKasa.raporPaketi, (_e, input: { bas?: string; bit?: string } | string, bitArg?: string) => {
    if (typeof input === "object" && input !== null) {
      return getOfisKasaRaporPaketi(input.bas ?? "", input.bit ?? "");
    }
    return getOfisKasaRaporPaketi(String(input ?? ""), String(bitArg ?? ""));
  });

  ipcMain.handle(IPC.muvekkil.ara, (_e, q: string) => muvekkilAra(q ?? ""));
  ipcMain.handle(IPC.muvekkil.araPaged, (_e, q: string, page: number, pageSize: number) =>
    muvekkilAraPaged(q ?? "", page, pageSize)
  );
  ipcMain.handle(IPC.muvekkil.get, (_e, id: number) => muvekkilGet(id));
  ipcMain.handle(IPC.muvekkil.ekle, (_e, input) => {
    try {
      return muvekkilEkle(input);
    } catch (e) {
      console.error("[main] muvekkil:ekle", e);
      throw e;
    }
  });
  ipcMain.handle(IPC.muvekkil.guncelle, (_e, id: number, input) => muvekkilGuncelle(id, input));

  ipcMain.handle(IPC.dosya.list, (_e, muvekkilId: number) => dosyaListByMuvekkil(muvekkilId));
  ipcMain.handle(IPC.dosya.get, (_e, id: number) => dosyaGet(id));
  ipcMain.handle(IPC.dosya.ekle, (_e, input) => dosyaEkle(input));
  ipcMain.handle(IPC.dosya.guncelle, (_e, id: number, input) => dosyaGuncelle(id, input));
  ipcMain.handle(IPC.dosya.hesapOzetPaketi, (_e, dosyaId: number) => dosyaHesapOzetPaketiGetir(dosyaId));

  ipcMain.handle(IPC.kasa.list, (_e, dosyaId: number) => kasaHareketList(dosyaId));
  ipcMain.handle(IPC.kasa.ozet, (_e, dosyaId: number) => hesaplaAvansBakiye(dosyaId));
  ipcMain.handle(IPC.kasa.ekle, (_e, input) => kasaHareketEkle(input));
  ipcMain.handle(IPC.kasa.guncelle, (_e, id: number, patch) => kasaHareketGuncelle(id, patch));
  ipcMain.handle(IPC.kasa.sil, (_e, id: number) => kasaHareketSil(id));
  ipcMain.handle(IPC.kasa.onayla, (_e, id: number) => kasaHareketOnayla(id));
  ipcMain.handle(IPC.masrafTurleri, () => masrafTurleriList());

  ipcMain.handle(IPC.vekalet.getOrCreate, (_e, dosyaId: number, muvekkilId: number) =>
    vekaletGetOrCreate(dosyaId, muvekkilId)
  );
  ipcMain.handle(IPC.vekalet.byDosya, (_e, dosyaId: number) => vekaletByDosya(dosyaId));
  ipcMain.handle(IPC.vekalet.kaydet, (_e, dosyaId: number, muvekkilId: number, input) =>
    vekaletKaydet(dosyaId, muvekkilId, input)
  );
  ipcMain.handle(IPC.vekalet.guncelle, (_e, id: number, input) => {
    const row = vekaletGuncelle(id, input);
    return row ? { ok: true, row } : { ok: false, error: "Vekalet kaydı bulunamadı" };
  });
  ipcMain.handle(IPC.vekalet.taksitList, (_e, vekaletId: number) => vekaletTaksitList(vekaletId));
  ipcMain.handle(IPC.vekalet.taksitEkle, (_e, vekaletId: number, input) => vekaletTaksitEkle(vekaletId, input));
  ipcMain.handle(IPC.vekalet.taksitGuncelle, (_e, id: number, patch) => vekaletTaksitGuncelle(id, patch));
  ipcMain.handle(IPC.vekalet.taksitSil, (_e, id: number) => vekaletTaksitSil(id));
  ipcMain.handle(IPC.vekalet.taksitOdemeAl, (_e, taksitId: number, input) => vekaletTaksitOdemeAl(taksitId, input));
  ipcMain.handle(IPC.vekalet.taksitOdemeGecmisi, (_e, taksitId: number) => vekaletTaksitOdemeGecmisi(taksitId));
  ipcMain.handle(IPC.vekalet.smmBekleyenler, (_e, dosyaId?: number) => vekaletSmmBekleyenler(dosyaId));
  ipcMain.handle(IPC.vekalet.smmKesildi, (_e, odemeId: number) => vekaletSmmKesildi(odemeId));

  ipcMain.handle(IPC.makbuz.ensureReceiptNumber, (_e, hareketId: number) =>
    ensureReceiptNumberForTransaction(hareketId)
  );
  ipcMain.handle(IPC.makbuz.getReceiptData, (_e, hareketId: number) =>
    getReceiptDataByTransactionId(hareketId)
  );
  ipcMain.handle(IPC.makbuz.yazdirmaPaketi, (_e, hareketId: number) =>
    makbuzYazdirmaPaketiGetir(hareketId)
  );

  ipcMain.handle(IPC.print.getPrinters, () => getSystemPrinters());
  ipcMain.handle(IPC.print.document, (_e, req: import("@shared/types/print").PrintDocumentRequest) =>
    silentPrintDocument(req)
  );
  ipcMain.handle(IPC.print.htmlToPdf, (_e, req: import("@shared/types/print").HtmlToPdfRequest) => htmlToPdf(req));
  ipcMain.handle(IPC.print.pdf, (_e, req: import("@shared/types/print").PrintPdfRequest) => silentPrintPdf(req));

  ipcMain.handle(IPC.vekaletMakbuz.ensureReceiptNumber, (_e, id: number, tip?: string) => {
    if (tip === "odeme") return ensureVekaletReceiptNumberForOdeme(id);
    return ensureVekaletReceiptNumberForInstallment(id);
  });
  ipcMain.handle(IPC.vekaletMakbuz.getPrintPackage, (_e, taksitId: number) =>
    getVekaletReceiptDataByInstallmentId(taksitId)
  );
  ipcMain.handle(IPC.vekaletMakbuz.getPrintPackageByOdemeId, (_e, odemeId: number) =>
    getVekaletPrintPackageByOdemeId(odemeId)
  );

  ipcMain.handle(IPC.util.pathToFileUrl, (_e, filePath: string) => {
    try {
      if (!filePath?.trim()) return null;
      return pathToFileURL(filePath).href;
    } catch {
      return null;
    }
  });
  ipcMain.handle(IPC.util.openContactLink, async (_e, url: string) => {
    const u = (url ?? "").trim();
    if (!/^mailto:/i.test(u) && !/^tel:/i.test(u)) {
      return { ok: false as const, error: "İzin verilmeyen bağlantı." };
    }
    await shell.openExternal(u);
    return { ok: true as const };
  });

  ipcMain.handle(IPC.license.getState, () => licenseGetStateForRenderer());
  ipcMain.handle(IPC.license.activate, (_e, input: import("@shared/types/license").LicenseActivateInput) =>
    licenseActivate(input),
  );
  ipcMain.handle(IPC.license.startTrial, (_e, input: import("@shared/types/license").LicenseStartTrialInput) =>
    licenseStartTrial(input),
  );
  ipcMain.handle(
    IPC.license.validate,
    (_e, options?: import("@shared/types/license").LicenseValidateOptions) => licenseValidate(options),
  );
  ipcMain.handle(IPC.license.openRenewalUrl, async () => {
    const result = await licenseRequestRenewalLink();
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    await shell.openExternal(result.purchaseUrl);
    return { ok: true as const };
  });

  ipcMain.handle(IPC.update.getStatus, () => getUpdateStatus());
  ipcMain.handle(IPC.update.check, (_e, source?: "auto" | "manual") =>
    checkForUpdates(source === "auto" ? "auto" : "manual"),
  );
  ipcMain.handle(IPC.update.download, () => downloadUpdate());
  ipcMain.handle(IPC.update.install, () => installUpdate());
  ipcMain.handle(IPC.update.dismiss, () => {
    dismissUpdatePrompt();
    return { ok: true as const };
  });
}

export function initLicenseOnReady(): void {
  void licenseValidateOnStartup().catch((e) => {
    console.error("[license] startup validate", e);
  });
}

export function initAuthOnReady(): void {
  authRestoreRemembered();
}

export function initUpdateOnReady(): void {
  initUpdateService();
}

export { scheduleAutoUpdateCheck };
