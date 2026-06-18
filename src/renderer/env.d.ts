import type {
  HtmlToPdfRequest,
  HtmlToPdfResult,
  PrintDocumentRequest,
  PrintDocumentResult,
  PrintPdfRequest,
  YaziciInfo,
} from "@shared/types/print";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
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
import type {
  OfisKasaAnaSayfaOzet,
  OfisKasaDuzeltmeInput,
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
  VekaletIslemSonuc,
  VekaletKaydetInput,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletUcreti,
} from "@shared/types/vekalet";

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
  ofisKasaList: (f: OfisKasaListFilter) => Promise<OfisKasaHareketListeSatir[]>;
  ofisKasaUstOzet: () => Promise<OfisKasaUstOzet>;
  ofisKasaAnaSayfaOzet: () => Promise<OfisKasaAnaSayfaOzet>;
  ofisKasaEkle: (input: OfisKasaEkleInput) => Promise<OfisKasaIslemSonuc>;
  ofisKasaGuncelle: (id: number, patch: OfisKasaGuncellePatch) => Promise<OfisKasaIslemSonuc>;
  ofisKasaSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  ofisKasaOnayla: (id: number) => Promise<OfisKasaIslemSonuc>;
  ofisKasaDuzeltmeEkle: (input: OfisKasaDuzeltmeInput) => Promise<OfisKasaIslemSonuc>;
  ofisKasaRaporPaketi: (input: { bas: string; bit: string }) => Promise<OfisKasaRaporPaketi>;
  muvekkilAra: (q: string) => Promise<MuvekkilListItem[]>;
  muvekkilAraPaged: (q: string, page: number, pageSize: number) => Promise<MuvekkilPagedResult>;
  muvekkilGet: (id: number) => Promise<Muvekkil | null>;
  muvekkilEkle: (input: MuvekkilInput) => Promise<Muvekkil>;
  muvekkilGuncelle: (id: number, input: MuvekkilInput) => Promise<Muvekkil | null>;
  dosyaList: (muvekkilId: number) => Promise<Dosya[]>;
  dosyaGet: (id: number) => Promise<Dosya | null>;
  dosyaEkle: (input: DosyaInput) => Promise<Dosya>;
  dosyaGuncelle: (id: number, input: DosyaUpdateInput) => Promise<Dosya | null>;
  dosyaHesapOzetPaketi: (dosyaId: number) => Promise<DosyaHesapOzetPaketi>;
  kasaList: (dosyaId: number) => Promise<KasaHareket[]>;
  kasaOzet: (dosyaId: number) => Promise<KasaOzet>;
  kasaEkle: (input: KasaEkleInput) => Promise<KasaIslemSonuc>;
  kasaGuncelle: (id: number, patch: KasaGuncellePatch) => Promise<KasaIslemSonuc>;
  kasaSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  kasaOnayla: (id: number) => Promise<KasaIslemSonuc>;
  masrafTurleri: () => Promise<string[]>;
  vekaletGetOrCreate: (dosyaId: number, muvekkilId: number) => Promise<VekaletUcreti>;
  vekaletByDosya: (dosyaId: number) => Promise<VekaletUcreti | null>;
  vekaletKaydet: (dosyaId: number, muvekkilId: number, input: VekaletKaydetInput) => Promise<VekaletIslemSonuc<VekaletUcreti>>;
  vekaletGuncelle: (id: number, input: VekaletKaydetInput) => Promise<VekaletIslemSonuc<VekaletUcreti>>;
  vekaletTaksitList: (vekaletId: number) => Promise<VekaletTaksit[]>;
  vekaletTaksitEkle: (vekaletId: number, input: TaksitEkleInput) => Promise<VekaletIslemSonuc<VekaletTaksit>>;
  vekaletTaksitGuncelle: (id: number, patch: TaksitGuncelleInput) => Promise<VekaletIslemSonuc<VekaletTaksit>>;
  vekaletTaksitSil: (id: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  vekaletTaksitOdemeAl: (
    taksitId: number,
    input: TaksitOdemeAlInput
  ) => Promise<VekaletIslemSonuc<{ taksit: VekaletTaksit; odeme: VekaletTaksitOdeme }>>;
  vekaletTaksitOdemeGecmisi: (taksitId: number) => Promise<VekaletTaksitOdeme[]>;
  vekaletSmmBekleyenler: (dosyaId?: number) => Promise<SmmBekleyenSatir[]>;
  vekaletSmmKesildi: (odemeId: number) => Promise<VekaletIslemSonuc<VekaletTaksitOdeme>>;
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
};

declare global {
  interface Window {
    api: Api;
  }
}

export {};
