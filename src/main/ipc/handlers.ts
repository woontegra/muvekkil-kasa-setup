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
import { getDosyaMaliOzet } from "../services/dosyaMaliOzet.service";
import { buildMuvekkilEkstreForDosya } from "../services/muvekkilEkstre.service";
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
import { guvenliKasaHareketSil } from "../services/kasaGuvenliSil.service";
import { guvenliOfisHareketSil } from "../services/ofisGuvenliSil.service";
import { getTahsilatMerkeziOzet, listTahsilatMerkezi } from "../services/tahsilatMerkezi.service";
import {
  icraTahsilatAlacakIptal,
  icraTahsilatAlacakOlustur,
  icraTahsilatList,
  icraTahsilatSmmKesildi,
  icraTahsilatTaksitList,
  icraTahsilatTaksitOdemeAl,
  icraTahsilatTaksitOdemeGecmisi,
  icraTahsilatTaksitSil,
  icraTahsilatTaksitGuncelle,
  icraTahsilatUstOzet,
} from "../services/icraTahsilat.service";
import {
  randevuGet,
  randevuGuncelle,
  randevuKullanicilar,
  randevuList,
  randevuOlustur,
  randevuSil,
} from "../services/randevu.service";
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
  vekaletTaksitOdemeGuncelle,
  vekaletTaksitSil,
  vekaletTaksitleriTopluSil,
  vekaletTaksitUyariOzet,
} from "../services/vekalet.service";
import { guvenliSilVekaletTaksiti, guvenliSilVekaletTahsilat } from "../services/vekaletGuvenliIptal.service";
import {
  dosyaEkle,
  dosyaGet,
  dosyaGuncelle,
  dosyaListAll,
  dosyaListByMuvekkil,
} from "../services/dosya.service";
import type { DosyaListeParams } from "@shared/types/dosyaListe";
import {
  muvekkilAra,
  muvekkilAraPaged,
  muvekkilEkle,
  muvekkilGet,
  muvekkilGuncelle,
} from "../services/muvekkil.service";
import { getMuvekkilKarlilik, listMuvekkilOfisGelirleri } from "../services/muvekkilKarlilik.service";
import { getMaliKontrolUyarilariGuarded } from "../services/maliKontrol.service";
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
  ofisKasaDovizDonusum,
  ofisKasaDovizDonusumSil,
  ofisKasaDuzeltmeEkle,
  ofisKasaHareketEkle,
  ofisKasaHareketGuncelle,
  ofisKasaHareketList,
  ofisKasaHareketOnayla,
  ofisKasaHareketSil,
  ofisKasaUstOzet,
} from "../services/ofisKasa.service";
import {
  getTcmbPairRate,
  getTcmbRates,
  yaklasikTryTutar,
} from "../services/tcmbKur.service";
import type { ParaBirimi } from "@shared/lib/paraBirimi";
import { tryResolveParaBirimi } from "@shared/lib/paraBirimi";
import { backupDatabase, restoreDatabase } from "../services/backup.service";
import { officeLogoDataUrl, officePickLogo, officeSettingsGet, officeSettingsSave } from "../services/office.service";
import { getAccountingPeriodMode, setAccountingPeriodMode } from "../services/appSettings.service";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
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
import { installIpcModuleAuthorization } from "./moduleAuthorization";
import {
  checkForUpdates,
  dismissUpdatePrompt,
  downloadUpdate,
  getUpdateStatus,
  initUpdateService,
  installUpdate,
  scheduleAutoUpdateCheck,
} from "../services/update.service";
import {
  activateFinansKalemi,
  archiveFinansKalemi,
  createFinansKalemi,
  listAktifManuelKalemler,
  listFinansKalemleri,
  reorderFinansKalemleri,
  updateFinansKalemi,
} from "../services/finansKalemi.service";
import { listAuditLog } from "../services/auditLog.service";
import {
  createKullanici,
  listKullanicilar,
  resetKullaniciSifre,
  setKullaniciAktif,
  type KullaniciRolu,
} from "../services/kullaniciYonetim.service";
import type { FinansKalemTuru } from "../services/finansKalemi.defaults";

function oturumKullaniciEtiketi(): { id: number | null; ad: string | null } {
  const s = authGetSession();
  if (!s) return { id: null, ad: null };
  const ad = s.adSoyad.trim() || s.kullaniciAdi;
  return { id: s.id, ad };
}

export function registerIpcHandlers(): void {
  // Sıra önemli: lisans kapısı önce kurulur, rol kapısı onun üstüne binerek sonra çalışır.
  installIpcLicenseAuthorization();
  installIpcModuleAuthorization();
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
  ipcMain.handle(IPC.appSettings.getAccountingPeriodMode, () => getAccountingPeriodMode());
  ipcMain.handle(IPC.appSettings.setAccountingPeriodMode, (_e, mode: AccountingPeriodMode) =>
    setAccountingPeriodMode(mode),
  );
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
  ipcMain.handle(IPC.ofisKasa.guvenliSil, (_e, id: number, input) => guvenliOfisHareketSil(id, input));
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
  ipcMain.handle(IPC.ofisKasa.dovizDonusum, async (_e, input) => {
    const o = oturumKullaniciEtiketi();
    return ofisKasaDovizDonusum(input, o.id, o.ad);
  });
  ipcMain.handle(IPC.ofisKasa.dovizDonusumSil, (_e, dovizDonusumId: string) =>
    ofisKasaDovizDonusumSil(dovizDonusumId),
  );

  ipcMain.handle(IPC.kurlar.tcmb, async (_e, opts?: { date?: string; forceRefresh?: boolean }) => {
    const snap = await getTcmbRates({
      date: opts?.date,
      forceRefresh: opts?.forceRefresh,
    });
    if (!snap) {
      return {
        ok: true as const,
        available: false as const,
        message: "Kur bilgisi alınamadı",
        rates: null,
      };
    }
    // SaaS `/api/v1/kurlar/tcmb` DTO paritesi
    return {
      ok: true as const,
      available: true as const,
      istenilenTarih: snap.istenilenTarih,
      bulunanTcmbKurTarihi: snap.bulunanTcmbKurTarihi,
      effectiveDate: snap.effectiveDate,
      fetchedAt: snap.fetchedAt,
      lastCheckedAt: snap.lastCheckedAt,
      fromCache: snap.fromCache,
      source: snap.source,
      sourceLabel: "Türkiye Cumhuriyet Merkez Bankası",
      stale: snap.stale,
      fallbackKullanildi: snap.fallbackKullanildi,
      cacheNote: snap.stale
        ? "TCMB’ye şu anda ulaşılamadı; son yayımlanan kur gösteriliyor."
        : snap.fallbackKullanildi
          ? "TCMB’nin son yayımladığı kur gösteriliyor (istenilen günde bülten yok)."
          : null,
      usdDovizAlis: snap.usd.buyingRate,
      usdDovizSatis: snap.usd.sellingRate,
      eurDovizAlis: snap.eur.buyingRate,
      eurDovizSatis: snap.eur.sellingRate,
      usdEurCapraz: snap.usdEurCapraz,
      eurUsdCapraz: snap.eurUsdCapraz,
      rates: [
        {
          currency: "USD" as const,
          buyingRate: snap.usd.buyingRate,
          sellingRate: snap.usd.sellingRate,
          effectiveDate: snap.effectiveDate,
          fetchedAt: snap.fetchedAt,
          source: "TCMB" as const,
          stale: snap.stale,
        },
        {
          currency: "EUR" as const,
          buyingRate: snap.eur.buyingRate,
          sellingRate: snap.eur.sellingRate,
          effectiveDate: snap.effectiveDate,
          fetchedAt: snap.fetchedAt,
          source: "TCMB" as const,
          stale: snap.stale,
        },
      ],
    };
  });
  ipcMain.handle(
    IPC.kurlar.tcmbCapraz,
    async (_e, input: { baz: ParaBirimi; karsi: ParaBirimi; date?: string }) => {
      const quote = await getTcmbPairRate(input.baz, input.karsi, { date: input.date });
      return quote
        ? { ok: true as const, ...quote }
        : { ok: false as const, available: false as const, error: "Çapraz kur alınamadı." };
    },
  );
  ipcMain.handle(
    IPC.kurlar.yaklasikTry,
    async (
      _e,
      items: { tutar: number; paraBirimi: ParaBirimi; id?: string }[],
      date?: string,
    ) => {
      const snap = await getTcmbRates({ date });
      return (items ?? []).map((it) => {
        const pb = tryResolveParaBirimi(it.paraBirimi);
        const y = yaklasikTryTutar(Number(it.tutar), pb, snap);
        return {
          id: it.id ?? null,
          paraBirimi: pb,
          tutar: Number(it.tutar),
          tryTutar: y.tryTutar,
          kurTarihi: y.kurTarihi,
          aciklama: y.aciklama,
          available: y.tryTutar != null || pb === "TRY",
        };
      });
    },
  );

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
  ipcMain.handle(IPC.muvekkil.karlilik, (_e, id: number) => getMuvekkilKarlilik(id));
  ipcMain.handle(IPC.muvekkil.ofisGelirleri, (_e, id: number, opts?: { page?: number; limit?: number }) =>
    listMuvekkilOfisGelirleri(id, opts),
  );
  ipcMain.handle(IPC.maliKontrol.uyarilar, () => {
    const s = authGetSession();
    return getMaliKontrolUyarilariGuarded(s?.rol ?? null);
  });

  ipcMain.handle(IPC.dosya.list, (_e, muvekkilId: number) => dosyaListByMuvekkil(muvekkilId));
  ipcMain.handle(IPC.dosya.listAll, (_e, params?: DosyaListeParams) => dosyaListAll(params ?? {}));
  ipcMain.handle(IPC.dosya.get, (_e, id: number) => dosyaGet(id));
  ipcMain.handle(IPC.dosya.ekle, (_e, input) => dosyaEkle(input));
  ipcMain.handle(IPC.dosya.guncelle, (_e, id: number, input) => dosyaGuncelle(id, input));
  ipcMain.handle(IPC.dosya.hesapOzetPaketi, (_e, dosyaId: number) => dosyaHesapOzetPaketiGetir(dosyaId));
  ipcMain.handle(IPC.dosya.maliOzet, (_e, dosyaId: number) => getDosyaMaliOzet(dosyaId));
  ipcMain.handle(
    IPC.dosya.muvekkilEkstre,
    (_e, dosyaId: number, opts?: { itibariyleTarih?: string | null; belgeRef?: string | null }) =>
      buildMuvekkilEkstreForDosya(dosyaId, opts),
  );

  ipcMain.handle(IPC.kasa.list, (_e, dosyaId: number) => kasaHareketList(dosyaId));
  ipcMain.handle(IPC.kasa.ozet, (_e, dosyaId: number) => hesaplaAvansBakiye(dosyaId));
  ipcMain.handle(IPC.kasa.ekle, (_e, input) => kasaHareketEkle(input));
  ipcMain.handle(IPC.kasa.guncelle, (_e, id: number, patch) => kasaHareketGuncelle(id, patch));
  ipcMain.handle(IPC.kasa.sil, (_e, id: number) => kasaHareketSil(id));
  ipcMain.handle(IPC.kasa.guvenliSil, (_e, id: number, input) => guvenliKasaHareketSil(id, input));
  ipcMain.handle(IPC.kasa.onayla, (_e, id: number) => kasaHareketOnayla(id));
  ipcMain.handle(IPC.masrafTurleri, () => masrafTurleriList());

  ipcMain.handle(IPC.tahsilatMerkezi.ozet, () => getTahsilatMerkeziOzet());
  ipcMain.handle(IPC.tahsilatMerkezi.list, (_e, params) => listTahsilatMerkezi(params ?? {}));

  ipcMain.handle(IPC.icraTahsilat.ustOzet, () => icraTahsilatUstOzet());
  ipcMain.handle(IPC.icraTahsilat.list, (_e, filtre) => icraTahsilatList(filtre ?? {}));
  ipcMain.handle(IPC.icraTahsilat.alacakOlustur, (_e, input) => icraTahsilatAlacakOlustur(input));
  ipcMain.handle(IPC.icraTahsilat.taksitList, (_e, alacakId: number) => icraTahsilatTaksitList(alacakId));
  ipcMain.handle(IPC.icraTahsilat.taksitOdemeAl, (_e, taksitId: number, input) =>
    icraTahsilatTaksitOdemeAl(taksitId, input),
  );
  ipcMain.handle(IPC.icraTahsilat.taksitOdemeGecmisi, (_e, taksitId: number) =>
    icraTahsilatTaksitOdemeGecmisi(taksitId),
  );
  ipcMain.handle(IPC.icraTahsilat.taksitSil, (_e, taksitId: number) => icraTahsilatTaksitSil(taksitId));
  ipcMain.handle(IPC.icraTahsilat.taksitGuncelle, (_e, taksitId: number, patch) =>
    icraTahsilatTaksitGuncelle(taksitId, patch),
  );
  ipcMain.handle(IPC.icraTahsilat.smmKesildi, (_e, odemeId: number) => icraTahsilatSmmKesildi(odemeId));
  ipcMain.handle(IPC.icraTahsilat.alacakIptal, (_e, alacakId: number) => icraTahsilatAlacakIptal(alacakId));

  ipcMain.handle(IPC.randevu.list, (_e, filtre) => randevuList(filtre ?? {}));
  ipcMain.handle(IPC.randevu.get, (_e, id: number) => randevuGet(id));
  ipcMain.handle(IPC.randevu.olustur, (_e, input) => randevuOlustur(input));
  ipcMain.handle(IPC.randevu.guncelle, (_e, id: number, input) => randevuGuncelle(id, input));
  ipcMain.handle(IPC.randevu.sil, (_e, id: number) => randevuSil(id));
  ipcMain.handle(IPC.randevu.kullanicilar, () => randevuKullanicilar());

  ipcMain.handle(IPC.vekalet.getOrCreate, (_e, dosyaId: number, muvekkilId: number) =>
    vekaletGetOrCreate(dosyaId, muvekkilId)
  );
  ipcMain.handle(IPC.vekalet.byDosya, (_e, dosyaId: number) => vekaletByDosya(dosyaId));
  ipcMain.handle(IPC.vekalet.kaydet, (_e, dosyaId: number, muvekkilId: number, input) =>
    vekaletKaydet(dosyaId, muvekkilId, input)
  );
  ipcMain.handle(IPC.vekalet.guncelle, (_e, id: number, input) => {
    try {
      const row = vekaletGuncelle(id, input);
      return row ? { ok: true, row } : { ok: false, error: "Vekalet kaydı bulunamadı" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Vekalet kaydı güncellenemedi" };
    }
  });
  ipcMain.handle(IPC.vekalet.taksitList, (_e, vekaletId: number) => vekaletTaksitList(vekaletId));
  ipcMain.handle(IPC.vekalet.taksitEkle, (_e, vekaletId: number, input) => vekaletTaksitEkle(vekaletId, input));
  ipcMain.handle(IPC.vekalet.taksitGuncelle, (_e, id: number, patch) => vekaletTaksitGuncelle(id, patch));
  ipcMain.handle(IPC.vekalet.taksitSil, (_e, id: number) => vekaletTaksitSil(id));
  ipcMain.handle(IPC.vekalet.taksitleriTopluSil, (_e, vekaletId: number) => vekaletTaksitleriTopluSil(vekaletId));
  ipcMain.handle(IPC.vekalet.taksitOdemeAl, (_e, taksitId: number, input) => vekaletTaksitOdemeAl(taksitId, input));
  ipcMain.handle(IPC.vekalet.taksitOdemeGuncelle, (_e, odemeId: number, input) =>
    vekaletTaksitOdemeGuncelle(odemeId, input),
  );
  ipcMain.handle(IPC.vekalet.taksitOdemeGecmisi, (_e, taksitId: number) => vekaletTaksitOdemeGecmisi(taksitId));
  ipcMain.handle(IPC.vekalet.smmBekleyenler, (_e, dosyaId?: number) => vekaletSmmBekleyenler(dosyaId));
  ipcMain.handle(IPC.vekalet.smmKesildi, (_e, odemeId: number) => vekaletSmmKesildi(odemeId));
  ipcMain.handle(IPC.vekalet.taksitUyariOzet, () => vekaletTaksitUyariOzet());
  ipcMain.handle(IPC.vekalet.guvenliSilTaksit, (_e, id: number, input) => guvenliSilVekaletTaksiti(id, input));
  ipcMain.handle(IPC.vekalet.guvenliSilTahsilat, (_e, id: number, input) => guvenliSilVekaletTahsilat(id, input));

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

  ipcMain.handle(
    IPC.finansKalemi.list,
    (
      _e,
      opts?: { tur?: FinansKalemTuru; aktif?: "true" | "false" | "all"; includeSistem?: boolean; forForm?: boolean },
    ) => {
      if (opts?.forForm && opts.tur) return listAktifManuelKalemler(opts.tur);
      return listFinansKalemleri(opts ?? {});
    },
  );
  ipcMain.handle(IPC.finansKalemi.create, (_e, tur: FinansKalemTuru, ad: string) => {
    const u = oturumKullaniciEtiketi();
    return createFinansKalemi(tur, ad, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });
  ipcMain.handle(IPC.finansKalemi.update, (_e, id: number, ad: string) => {
    const u = oturumKullaniciEtiketi();
    return updateFinansKalemi(id, ad, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });
  ipcMain.handle(IPC.finansKalemi.archive, (_e, id: number) => {
    const u = oturumKullaniciEtiketi();
    return archiveFinansKalemi(id, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });
  ipcMain.handle(IPC.finansKalemi.activate, (_e, id: number) => {
    const u = oturumKullaniciEtiketi();
    return activateFinansKalemi(id, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });
  ipcMain.handle(IPC.finansKalemi.reorder, (_e, tur: FinansKalemTuru, orderedIds: number[]) => {
    const u = oturumKullaniciEtiketi();
    return reorderFinansKalemleri(tur, orderedIds, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });

  ipcMain.handle(IPC.audit.list, (_e, opts?: { limit?: number; offset?: number }) => listAuditLog(opts));

  ipcMain.handle(IPC.kullaniciYonetim.list, () => listKullanicilar());
  ipcMain.handle(
    IPC.kullaniciYonetim.create,
    (
      _e,
      input: {
        adSoyad: string;
        kullaniciAdi: string;
        eposta?: string | null;
        telefon?: string | null;
        sifre: string;
        rol: KullaniciRolu;
      },
    ) => {
      const u = oturumKullaniciEtiketi();
      return createKullanici(input, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
    },
  );
  ipcMain.handle(IPC.kullaniciYonetim.setAktif, (_e, id: number, aktif: boolean) => {
    const u = oturumKullaniciEtiketi();
    return setKullaniciAktif(id, aktif, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
  });
  ipcMain.handle(IPC.kullaniciYonetim.resetSifre, (_e, id: number, yeniSifre: string) => {
    const u = oturumKullaniciEtiketi();
    return resetKullaniciSifre(id, yeniSifre, u.id != null ? { id: u.id, adSoyad: u.ad ?? "" } : null);
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
