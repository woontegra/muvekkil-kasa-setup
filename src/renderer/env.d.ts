import type {
  HtmlToPdfRequest,
  HtmlToPdfResult,
  PrintDocumentRequest,
  PrintDocumentResult,
  PrintPdfRequest,
  YaziciInfo,
} from "@shared/types/print";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import type { DosyaMaliOzetSonuc } from "@shared/types/dosyaMaliOzet";
import type { MuvekkilEkstreSonuc } from "@shared/types/muvekkilEkstre";
import type { AuthUser, RememberedLogin } from "@shared/types/auth";
import type { Dosya, DosyaInput, DosyaUpdateInput } from "@shared/types/dosya";
import type {
  KasaEkleInput,
  KasaGuncellePatch,
  KasaHareket,
  KasaIslemSonuc,
  KasaOzet,
} from "@shared/types/kasa";
import type { KasaMakbuzPaketi, MakbuzEnsureSonuc, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import type { Muvekkil, MuvekkilInput, MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import type { OfficeSettings, OfficeSettingsInput, OfficeSettingsSaveSonuc } from "@shared/types/office";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type {
  OfisKasaAnaSayfaOzet,
  OfisKasaDuzeltmeInput,
  OfisKasaDovizDonusumInput,
  OfisKasaEkleInput,
  OfisKasaGuncellePatch,
  OfisKasaHareketListeSatir,
  OfisKasaIslemSonuc,
  OfisKasaListFilter,
  OfisKasaRaporPaketi,
  OfisKasaUstOzet,
} from "@shared/types/ofisKasa";
import type {
  SmmBekleyenSatir,
  TaksitEkleInput,
  TaksitGuncelleInput,
  TaksitOdemeAlInput,
  TaksitOdemeGuncelleInput,
  VekaletIslemSonuc,
  VekaletKaydetInput,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletTaksitUyariOzet,
  VekaletUcreti,
} from "@shared/types/vekalet";
import type {
  Randevu,
  RandevuIslemSonuc,
  RandevuKullanici,
  RandevuListFilter,
  RandevuWriteInput,
} from "@shared/types/randevu";

export type Api = {
  authNeedsSetup: () => Promise<boolean>;
  authGetSession: () => Promise<AuthUser | null>;
  authLogin: (input: unknown) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
  authSetupFirst: (input: unknown) => Promise<{ ok: boolean; user?: AuthUser; error?: string }>;
  authLogout: () => Promise<{ ok: boolean }>;
  authForgotPasswordGetQuestion: (kullaniciAdi: string) => Promise<{ ok: boolean; soruMetni?: string; error?: string }>;
  authForgotPasswordSubmit: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  getRememberedLogin: () => Promise<RememberedLogin | null>;
  saveRememberedLogin: (kullaniciAdi: string) => Promise<{ ok: boolean; error?: string }>;
  clearRememberedLogin: () => Promise<{ ok: boolean }>;
  authGuvenlikBilgisi: () => Promise<{ ok: true; guvenlikSorusuKodu: string | null } | { ok: false; error: string }>;
  authGuvenlikGuncelle: (input: {
    mevcutSifre: string;
    guvenlikSorusuKodu: string;
    guvenlikCevabi: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  authSifreGuncelle: (input: {
    mevcutSifre: string;
    yeniSifre: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  getAppVersion: () => Promise<string>;
  officeGet: () => Promise<OfficeSettings>;
  officeSave: (input: OfficeSettingsInput) => Promise<OfficeSettingsSaveSonuc>;
  officePickLogo: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  officeLogoDataUrl: (filePath: string) => Promise<string | null>;
  backupAl: () => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  backupGeriYukle: () => Promise<{ ok: true; autoBackupPath: string } | { ok: false; error: string }>;
  getAccountingPeriodMode: () => Promise<AccountingPeriodMode>;
  setAccountingPeriodMode: (mode: AccountingPeriodMode) => Promise<AccountingPeriodMode>;
  ofisKasaList: (f: OfisKasaListFilter) => Promise<OfisKasaHareketListeSatir[]>;
  ofisKasaUstOzet: (opts?: { referenceDate?: string }) => Promise<OfisKasaUstOzet>;
  ofisKasaAnaSayfaOzet: (opts?: { referenceDate?: string }) => Promise<OfisKasaAnaSayfaOzet>;
  ofisKasaEkle: (input: OfisKasaEkleInput) => Promise<OfisKasaIslemSonuc>;
  ofisKasaGuncelle: (id: number, patch: OfisKasaGuncellePatch) => Promise<OfisKasaIslemSonuc>;
  ofisKasaSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  ofisKasaGuvenliSil: (
    id: number,
    input: import("@shared/types/guvenliSil").GuvenliSilInput,
  ) => Promise<import("@shared/types/guvenliSil").GuvenliSilSonuc>;
  ofisKasaOnayla: (id: number) => Promise<OfisKasaIslemSonuc>;
  ofisKasaDuzeltmeEkle: (input: OfisKasaDuzeltmeInput) => Promise<OfisKasaIslemSonuc>;
  ofisKasaDovizDonusum: (input: OfisKasaDovizDonusumInput) => Promise<{ ok: true; rows: OfisKasaHareketListeSatir[] } | { ok: false; error: string }>;
  ofisKasaDovizDonusumSil: (dovizDonusumId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  kurlarTcmb: (opts?: { date?: string; forceRefresh?: boolean }) => Promise<any>;
  kurlarTcmbCapraz: (input: { baz: import("@shared/lib/paraBirimi").ParaBirimi; karsi: import("@shared/lib/paraBirimi").ParaBirimi; date?: string }) => Promise<{
    ok: boolean;
    available: boolean;
    error?: string;
    dovizAlis?: string;
    dovizSatis?: string | null;
    bulunanTcmbKurTarihi?: string;
  }>;
  kurlarYaklasikTry: (
    items: { tutar: number; paraBirimi: import("@shared/lib/paraBirimi").ParaBirimi; id?: string }[],
    date?: string,
  ) => Promise<
    {
      id: string | null;
      paraBirimi: import("@shared/lib/paraBirimi").ParaBirimi;
      tutar: number;
      tryTutar: number | null;
      kurTarihi: string | null;
      aciklama: string | null;
      available: boolean;
    }[]
  >;
  ofisKasaRaporPaketi: (input: { bas: string; bit: string }) => Promise<OfisKasaRaporPaketi>;
  muvekkilAra: (q: string) => Promise<MuvekkilListItem[]>;
  muvekkilAraPaged: (q: string, page: number, pageSize: number) => Promise<MuvekkilPagedResult>;
  muvekkilGet: (id: number) => Promise<Muvekkil | null>;
  muvekkilEkle: (input: MuvekkilInput) => Promise<Muvekkil>;
  muvekkilGuncelle: (id: number, input: MuvekkilInput) => Promise<Muvekkil | null>;
  muvekkilKarlilik: (id: number) => Promise<import("@shared/types/muvekkilKarlilik").MuvekkilKarlilikSonuc>;
  muvekkilOfisGelirleri: (
    id: number,
    opts?: { page?: number; limit?: number },
  ) => Promise<import("@shared/types/muvekkilOfisGelir").MuvekkilOfisGelirListe>;
  maliKontrolUyarilar: () => Promise<import("@shared/types/maliKontrol").MaliKontrolSonuc>;
  dosyaList: (muvekkilId: number) => Promise<Dosya[]>;
  dosyaListAll: (
    params?: import("@shared/types/dosyaListe").DosyaListeParams,
  ) => Promise<import("@shared/types/dosyaListe").DosyaListeSonuc>;
  dosyaGet: (id: number) => Promise<Dosya | null>;
  dosyaEkle: (input: DosyaInput) => Promise<Dosya>;
  dosyaGuncelle: (id: number, input: DosyaUpdateInput) => Promise<Dosya | null>;
  dosyaHesapOzetPaketi: (dosyaId: number) => Promise<DosyaHesapOzetPaketi>;
  dosyaMaliOzet: (dosyaId: number) => Promise<DosyaMaliOzetSonuc>;
  dosyaMuvekkilEkstre: (
    dosyaId: number,
    opts?: { itibariyleTarih?: string | null; belgeRef?: string | null },
  ) => Promise<MuvekkilEkstreSonuc>;
  kasaList: (dosyaId: number) => Promise<KasaHareket[]>;
  kasaOzet: (dosyaId: number) => Promise<KasaOzet>;
  kasaEkle: (input: KasaEkleInput) => Promise<KasaIslemSonuc>;
  kasaGuncelle: (id: number, patch: KasaGuncellePatch) => Promise<KasaIslemSonuc>;
  kasaSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  kasaGuvenliSil: (
    id: number,
    input: import("@shared/types/guvenliSil").GuvenliSilInput,
  ) => Promise<import("@shared/types/guvenliSil").GuvenliSilSonuc>;
  kasaOnayla: (id: number) => Promise<KasaIslemSonuc>;
  masrafTurleri: () => Promise<string[]>;
  finansKalemiList: (opts?: {
    tur?: "GELIR" | "GIDER";
    aktif?: "true" | "false" | "all";
    includeSistem?: boolean;
    forForm?: boolean;
  }) => Promise<
    {
      id: number;
      tur: "GELIR" | "GIDER";
      kod: string | null;
      ad: string;
      aktif: boolean;
      sistemMi: boolean;
      sira: number;
      archivedAt: string | null;
    }[]
  >;
  finansKalemiCreate: (
    tur: "GELIR" | "GIDER",
    ad: string,
  ) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  finansKalemiUpdate: (id: number, ad: string) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  finansKalemiArchive: (id: number) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  finansKalemiActivate: (id: number) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  finansKalemiReorder: (
    tur: "GELIR" | "GIDER",
    orderedIds: number[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  auditList: (opts?: {
    limit?: number;
    offset?: number;
  }) => Promise<{ rows: unknown[]; total: number }>;
  kullaniciYonetimList: () => Promise<
    {
      id: number;
      adSoyad: string;
      kullaniciAdi: string;
      eposta: string | null;
      telefon: string | null;
      rol: import("@shared/types/auth").KullaniciRolu;
      aktifMi: boolean;
      kayitTarihi: string;
    }[]
  >;
  kullaniciYonetimCreate: (input: unknown) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  kullaniciYonetimSetAktif: (
    id: number,
    aktif: boolean,
  ) => Promise<{ ok: true; row: unknown } | { ok: false; error: string }>;
  kullaniciYonetimResetSifre: (id: number, yeniSifre: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  vekaletGetOrCreate: (dosyaId: number, muvekkilId: number) => Promise<VekaletUcreti>;
  vekaletByDosya: (dosyaId: number) => Promise<VekaletUcreti | null>;
  vekaletKaydet: (dosyaId: number, muvekkilId: number, input: VekaletKaydetInput) => Promise<VekaletIslemSonuc<VekaletUcreti>>;
  vekaletGuncelle: (id: number, input: VekaletKaydetInput) => Promise<VekaletIslemSonuc<VekaletUcreti>>;
  vekaletTaksitList: (vekaletId: number) => Promise<VekaletTaksit[]>;
  vekaletTaksitEkle: (vekaletId: number, input: TaksitEkleInput) => Promise<VekaletIslemSonuc<VekaletTaksit>>;
  vekaletTaksitGuncelle: (id: number, patch: TaksitGuncelleInput) => Promise<VekaletIslemSonuc<VekaletTaksit>>;
  vekaletTaksitSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  vekaletTaksitleriTopluSil: (
    vekaletId: number,
  ) => Promise<{ ok: true; silinenAdet: number } | { ok: false; error: string }>;
  vekaletTaksitOdemeAl: (
    taksitId: number,
    input: TaksitOdemeAlInput
  ) => Promise<VekaletIslemSonuc<{ taksit: VekaletTaksit; odeme: VekaletTaksitOdeme }>>;
  vekaletTaksitOdemeGuncelle: (
    odemeId: number,
    input: TaksitOdemeGuncelleInput
  ) => Promise<VekaletIslemSonuc<{ taksit: VekaletTaksit; odeme: VekaletTaksitOdeme }>>;
  vekaletTaksitOdemeGecmisi: (taksitId: number) => Promise<VekaletTaksitOdeme[]>;
  vekaletSmmBekleyenler: (dosyaId?: number) => Promise<SmmBekleyenSatir[]>;
  vekaletTaksitUyariOzet: () => Promise<import("@shared/types/vekalet").VekaletTaksitUyariSonuc>;
  vekaletSmmKesildi: (odemeId: number) => Promise<VekaletIslemSonuc<VekaletTaksitOdeme>>;
  vekaletGuvenliSilTaksit: (
    id: number,
    input: import("@shared/types/guvenliSil").GuvenliSilInput,
  ) => Promise<import("@shared/types/vekaletGuvenliIptal").VekaletGuvenliIptalSonuc>;
  vekaletGuvenliSilTahsilat: (
    id: number,
    input: import("@shared/types/guvenliSil").GuvenliSilInput,
  ) => Promise<import("@shared/types/vekaletGuvenliIptal").VekaletGuvenliIptalSonuc>;
  tahsilatMerkeziOzet: () => Promise<import("@shared/types/tahsilatMerkezi").TahsilatMerkeziOzet>;
  tahsilatMerkeziList: (
    params?: import("@shared/types/tahsilatMerkezi").TahsilatMerkeziListeParams,
  ) => Promise<import("@shared/types/tahsilatMerkezi").TahsilatMerkeziListResponse>;
  icraTahsilatUstOzet: () => Promise<import("@shared/types/icraTahsilat").IcraTahsilatUstOzet>;
  icraTahsilatList: (
    filtre?: import("@shared/types/icraTahsilat").IcraTahsilatListeFiltre,
  ) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatListeSatir[]>;
  icraTahsilatAlacakOlustur: (
    input: import("@shared/types/icraTahsilat").IcraTahsilatAlacakOlusturInput,
  ) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatIslemSonuc<import("@shared/types/icraTahsilat").IcraTahsilatListeSatir>>;
  icraTahsilatTaksitList: (alacakId: number) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatTaksit[]>;
  icraTahsilatTaksitOdemeAl: (
    taksitId: number,
    input: import("@shared/types/icraTahsilat").IcraTahsilatOdemeAlInput,
  ) => Promise<
    import("@shared/types/icraTahsilat").IcraTahsilatIslemSonuc<{
      taksit: import("@shared/types/icraTahsilat").IcraTahsilatTaksit;
      odeme: import("@shared/types/icraTahsilat").IcraTahsilatOdeme;
    }>
  >;
  icraTahsilatTaksitOdemeGecmisi: (taksitId: number) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatOdeme[]>;
  icraTahsilatTaksitSil: (taksitId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  icraTahsilatTaksitGuncelle: (
    taksitId: number,
    patch: import("@shared/types/icraTahsilat").IcraTahsilatTaksitGuncelleInput,
  ) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatIslemSonuc<import("@shared/types/icraTahsilat").IcraTahsilatTaksit>>;
  icraTahsilatSmmKesildi: (
    odemeId: number,
  ) => Promise<import("@shared/types/icraTahsilat").IcraTahsilatIslemSonuc<import("@shared/types/icraTahsilat").IcraTahsilatOdeme>>;
  icraTahsilatAlacakIptal: (alacakId: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  randevuList: (filtre: RandevuListFilter) => Promise<Randevu[]>;
  randevuGet: (id: number) => Promise<Randevu | null>;
  randevuOlustur: (input: RandevuWriteInput) => Promise<RandevuIslemSonuc>;
  randevuGuncelle: (id: number, input: RandevuWriteInput) => Promise<RandevuIslemSonuc>;
  randevuSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  randevuKullanicilar: () => Promise<RandevuKullanici[]>;
  makbuzYazdirmaPaketi: (hareketId: number) => Promise<KasaMakbuzPaketi>;
  printGetPrinters: () => Promise<YaziciInfo[]>;
  printDocument: (req: PrintDocumentRequest) => Promise<PrintDocumentResult>;
  printHtmlToPdf: (req: HtmlToPdfRequest) => Promise<HtmlToPdfResult>;
  printPdf: (req: PrintPdfRequest) => Promise<PrintDocumentResult>;
  ensureReceiptNumberForTransaction: (hareketId: number) => Promise<MakbuzEnsureSonuc>;
  getReceiptDataByTransactionId: (hareketId: number) => Promise<KasaMakbuzPaketi>;
  ensureVekaletReceiptNumberForInstallment: (taksitId: number) => Promise<MakbuzEnsureSonuc>;
  ensureVekaletReceiptNumberForOdeme: (odemeId: number) => Promise<MakbuzEnsureSonuc>;
  getVekaletReceiptDataByInstallmentId: (taksitId: number) => Promise<VekaletMakbuzPaketi>;
  getVekaletPrintPackageByOdemeId: (odemeId: number) => Promise<VekaletMakbuzPaketi>;
  pathToFileUrl: (filePath: string) => Promise<string | null>;
  openContactLink: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  licenseGetState: () => Promise<import("@shared/types/license").LicenseState>;
  licenseActivate: (
    input: import("@shared/types/license").LicenseActivateInput,
  ) => Promise<import("@shared/types/license").LicenseActivateResult>;
  licenseStartTrial: (
    input: import("@shared/types/license").LicenseStartTrialInput,
  ) => Promise<import("@shared/types/license").LicenseStartTrialResult>;
  licenseValidate: (
    options?: import("@shared/types/license").LicenseValidateOptions,
  ) => Promise<import("@shared/types/license").LicenseValidateResult>;
  licenseOpenRenewalUrl: () => Promise<{ ok: true } | { ok: false; error: string }>;
  appQuit: () => Promise<{ ok: boolean }>;
  updateGetStatus: () => Promise<import("@shared/types/update").UpdateStatusSnapshot>;
  updateCheck: (
    source?: "auto" | "manual",
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
  updateInstall: () => Promise<{ ok: true } | { ok: false; error: string }>;
  updateDismiss: () => Promise<{ ok: true }>;
  onUpdateStatusChanged: (
    cb: (status: import("@shared/types/update").UpdateStatusSnapshot) => void,
  ) => () => void;
};

declare global {
  interface Window {
    api: Api;
  }
}

export {};
