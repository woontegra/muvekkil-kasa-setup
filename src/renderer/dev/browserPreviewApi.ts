import type { Dosya } from "@shared/types/dosya";
import type { KasaHareket, KasaOzet } from "@shared/types/kasa";
import type { LicenseState } from "@shared/types/license";
import type { MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import type { VekaletTaksit, VekaletUcreti } from "@shared/types/vekalet";
import {
  bugunYmdLocal,
  siniflaVekaletTaksitUyari,
  vekaletTaksitUyariSonucFromKayitlar,
} from "@shared/lib/vekaletTaksitUyari";
import type { VekaletTaksitUyariSonuc } from "@shared/types/vekalet";
import { muvekkilGorunenAd } from "../lib/muvekkil";

type RendererApi = Window["api"];

const PREVIEW_APP_VERSION = "0.1.3-preview";
const NOW = new Date().toISOString();

const MOCK_LICENSE: LicenseState = {
  valid: true,
  needsActivation: false,
  locked: false,
  phase: "paidActive",
  isExpired: false,
  offlineDegraded: false,
  daysRemaining: 365,
  expiresAt: "2027-12-31T00:00:00.000Z",
  expiryLabel: "31.12.2027",
  warningThreshold: null,
  message: null,
  record: null,
};

const MOCK_USER = {
  id: 1,
  kullaniciAdi: "demo",
  adSoyad: "Demo Kullanıcı",
  eposta: null,
  telefon: null,
};

const DEMO_DOSYALAR: Dosya[] = [
  {
    id: 501,
    muvekkilId: 5,
    konuBasligi: "İş Mahkemesi — Kıdem ve ihbar tazminatı",
    mahkemeAdi: "İstanbul 12. İş Mahkemesi",
    dosyaNumarasi: "2024/892",
    aciklama: "İşçi alacağı davası",
    durum: "AKTIF",
    not: "Duruşma 15.04.2026",
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 502,
    muvekkilId: 5,
    konuBasligi: "Alacak takibi — şantiye hakediş",
    mahkemeAdi: "Kadıköy İcra Dairesi",
    dosyaNumarasi: "2023/4451",
    aciklama: null,
    durum: "AKTIF",
    not: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 503,
    muvekkilId: 5,
    konuBasligi: "Tahkim — yapı denetim uyuşmazlığı",
    mahkemeAdi: "İstanbul Tahkim Merkezi",
    dosyaNumarasi: "2025/118",
    aciklama: null,
    durum: "PASIF",
    not: "Arabuluculuk aşamasında",
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 101,
    muvekkilId: 1,
    konuBasligi: "Boşanma ve nafaka",
    mahkemeAdi: "Ankara 3. Aile Mahkemesi",
    dosyaNumarasi: "2024/2156",
    aciklama: null,
    durum: "AKTIF",
    not: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 102,
    muvekkilId: 1,
    konuBasligi: "Tapu iptali ve tescil",
    mahkemeAdi: "Ankara 8. Asliye Hukuk Mahkemesi",
    dosyaNumarasi: "2023/7812",
    aciklama: null,
    durum: "KAPANDI",
    not: "Karar kesinleşti",
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 301,
    muvekkilId: 3,
    konuBasligi: "Ticari alacak davası",
    mahkemeAdi: "İstanbul Anadolu 5. Asliye Ticaret Mahkemesi",
    dosyaNumarasi: "2025/334",
    aciklama: null,
    durum: "AKTIF",
    not: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
  {
    id: 201,
    muvekkilId: 2,
    konuBasligi: "İş kazası tazminatı",
    mahkemeAdi: "Bursa 2. İş Mahkemesi",
    dosyaNumarasi: "2024/1205",
    aciklama: null,
    durum: "AKTIF",
    not: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  },
];

const DEMO_KASA: KasaHareket[] = [
  {
    id: 9001,
    dosyaId: 501,
    muvekkilId: 5,
    islemTipi: "AVANS_GIRISI",
    masrafTuru: null,
    tutar: 25000,
    tarih: "2026-01-10",
    masrafiYapanKisi: null,
    aciklama: "Dosya avansı",
    belgeNo: null,
    odemeYontemi: "NAKIT",
    onayDurumu: "ONAYLI",
    duzeltmeMi: false,
    duzeltilenIslemId: null,
    otomatikOnayMi: true,
    onayTarihi: NOW,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    olusturanKullaniciId: 1,
    olusturanKullaniciAdi: "Demo Kullanıcı",
    onaylayanKullaniciId: 1,
    onaylayanKullaniciAdi: "Demo Kullanıcı",
    makbuzNo: "MK-2026-001",
    makbuzTarihi: "2026-01-10",
    makbuzOlusturulduMu: true,
  },
  {
    id: 9002,
    dosyaId: 501,
    muvekkilId: 5,
    islemTipi: "MASRAF",
    masrafTuru: "Harç",
    tutar: 1850,
    tarih: "2026-01-15",
    masrafiYapanKisi: "Av. Demo",
    aciklama: "Dava harcı",
    belgeNo: null,
    odemeYontemi: "NAKIT",
    onayDurumu: "ONAYLI",
    duzeltmeMi: false,
    duzeltilenIslemId: null,
    otomatikOnayMi: false,
    onayTarihi: NOW,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    olusturanKullaniciId: 1,
    olusturanKullaniciAdi: "Demo Kullanıcı",
    onaylayanKullaniciId: 1,
    onaylayanKullaniciAdi: "Demo Kullanıcı",
    makbuzNo: null,
    makbuzTarihi: null,
    makbuzOlusturulduMu: false,
  },
  {
    id: 9003,
    dosyaId: 501,
    muvekkilId: 5,
    islemTipi: "MASRAF",
    masrafTuru: "Tebligat",
    tutar: 420,
    tarih: "2026-02-01",
    masrafiYapanKisi: "Av. Demo",
    aciklama: null,
    belgeNo: null,
    odemeYontemi: "NAKIT",
    onayDurumu: "ONAYSIZ",
    duzeltmeMi: false,
    duzeltilenIslemId: null,
    otomatikOnayMi: false,
    onayTarihi: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    olusturanKullaniciId: 1,
    olusturanKullaniciAdi: "Demo Kullanıcı",
    onaylayanKullaniciId: null,
    onaylayanKullaniciAdi: null,
    makbuzNo: null,
    makbuzTarihi: null,
    makbuzOlusturulduMu: false,
  },
  {
    id: 9004,
    dosyaId: 502,
    muvekkilId: 5,
    islemTipi: "AVANS_GIRISI",
    masrafTuru: null,
    tutar: 12000,
    tarih: "2025-11-20",
    masrafiYapanKisi: null,
    aciklama: "İcra avansı",
    belgeNo: null,
    odemeYontemi: "HAVALE",
    onayDurumu: "ONAYLI",
    duzeltmeMi: false,
    duzeltilenIslemId: null,
    otomatikOnayMi: true,
    onayTarihi: NOW,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    olusturanKullaniciId: 1,
    olusturanKullaniciAdi: "Demo Kullanıcı",
    onaylayanKullaniciId: 1,
    onaylayanKullaniciAdi: "Demo Kullanıcı",
    makbuzNo: "MK-2025-088",
    makbuzTarihi: "2025-11-20",
    makbuzOlusturulduMu: true,
  },
  {
    id: 9005,
    dosyaId: 101,
    muvekkilId: 1,
    islemTipi: "AVANS_GIRISI",
    masrafTuru: null,
    tutar: 8000,
    tarih: "2026-03-01",
    masrafiYapanKisi: null,
    aciklama: null,
    belgeNo: null,
    odemeYontemi: "NAKIT",
    onayDurumu: "ONAYLI",
    duzeltmeMi: false,
    duzeltilenIslemId: null,
    otomatikOnayMi: true,
    onayTarihi: NOW,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    olusturanKullaniciId: 1,
    olusturanKullaniciAdi: "Demo Kullanıcı",
    onaylayanKullaniciId: 1,
    onaylayanKullaniciAdi: "Demo Kullanıcı",
    makbuzNo: "MK-2026-012",
    makbuzTarihi: "2026-03-01",
    makbuzOlusturulduMu: true,
  },
];

const DEMO_VEKALETLER: VekaletUcreti[] = [
  { id: 5010, dosyaId: 501, muvekkilId: 5, anlasilanTutar: 100000, aciklama: "İş davası vekalet", kayitTarihi: NOW, guncellemeTarihi: NOW },
  { id: 5020, dosyaId: 502, muvekkilId: 5, anlasilanTutar: 35000, aciklama: null, kayitTarihi: NOW, guncellemeTarihi: NOW },
  { id: 1010, dosyaId: 101, muvekkilId: 1, anlasilanTutar: 45000, aciklama: null, kayitTarihi: NOW, guncellemeTarihi: NOW },
];

const DEMO_TAKSITLER: VekaletTaksit[] = buildDemoTaksitler();

function buildDemoTaksitler(): VekaletTaksit[] {
  const rows: VekaletTaksit[] = [];
  const durumlar: VekaletTaksit["durum"][] = ["ODENDI", "KISMI_ODENDI", "ODENMEDI", "GECIKTI"];
  for (let i = 1; i <= 10; i += 1) {
    const vekaletUcretiId = 5010;
    const tutar = 10000;
    const odenen = i <= 2 ? tutar : i === 3 ? 5000 : 0;
    const kalan = tutar - odenen;
    rows.push({
      id: 7000 + i,
      vekaletUcretiId,
      dosyaId: 501,
      muvekkilId: 5,
      taksitNo: i,
      tutar,
      vadeTarihi: `2026-${String(i).padStart(2, "0")}-15`,
      aciklama: i === 1 ? "Peşinat" : i === 10 ? "Kapanış taksiti" : null,
      kayitTarihi: NOW,
      guncellemeTarihi: NOW,
      odenenToplam: odenen,
      kalanTutar: kalan,
      durum: odenen >= tutar ? "ODENDI" : odenen > 0 ? "KISMI_ODENDI" : durumlar[i % durumlar.length],
      smmDurumu: i === 3 && odenen > 0 ? "BEKLIYOR" : odenen >= tutar ? "KESILDI" : "YOK",
      sonOdemeTarihi: odenen > 0 ? `2026-0${Math.min(i, 9)}-10` : null,
      sonMakbuzNo: odenen > 0 ? `VK-00${i}` : null,
      sonOdemeId: odenen > 0 ? 8000 + i : null,
      smmBekleyenOdemeId: i === 3 && odenen > 0 ? 8003 : null,
    });
  }
  rows.push(
    {
      id: 7011,
      vekaletUcretiId: 5020,
      dosyaId: 502,
      muvekkilId: 5,
      taksitNo: 1,
      tutar: 17500,
      vadeTarihi: "2026-02-01",
      aciklama: null,
      kayitTarihi: NOW,
      guncellemeTarihi: NOW,
      odenenToplam: 17500,
      kalanTutar: 0,
      durum: "ODENDI",
      smmDurumu: "KESILDI",
      sonOdemeTarihi: "2026-01-28",
      sonMakbuzNo: "VK-010",
      sonOdemeId: 8010,
      smmBekleyenOdemeId: null,
    },
    {
      id: 7012,
      vekaletUcretiId: 5020,
      dosyaId: 502,
      muvekkilId: 5,
      taksitNo: 2,
      tutar: 17500,
      vadeTarihi: "2026-05-01",
      aciklama: null,
      kayitTarihi: NOW,
      guncellemeTarihi: NOW,
      odenenToplam: 0,
      kalanTutar: 17500,
      durum: "GECIKTI",
      smmDurumu: "YOK",
      sonOdemeTarihi: null,
      sonMakbuzNo: null,
      sonOdemeId: null,
      smmBekleyenOdemeId: null,
    },
  );
  return rows;
}

function aktifDosyaSayisi(muvekkilId: number): number {
  return DEMO_DOSYALAR.filter((d) => d.muvekkilId === muvekkilId && d.durum === "AKTIF").length;
}

function demoMuvekkiller(): MuvekkilListItem[] {
  const base = (
    i: number,
    ad: string,
    tur: "GERCEK_KISI" | "TUZEL_KISI",
    extra?: Partial<MuvekkilListItem>,
  ): MuvekkilListItem => ({
    id: i,
    muvekkilTuru: tur,
    adSoyad: ad,
    telefon: `0532 000 ${String(i).padStart(2, "0")} ${String(i).padStart(2, "0")}`,
    eposta: `ornek${i}@mail.com`,
    adres: "Örnek Mah. Test Sok. No:1 İstanbul",
    sirketUnvani: tur === "TUZEL_KISI" ? ad : null,
    yetkiliAdSoyad: tur === "TUZEL_KISI" ? "Yetkili Kişi" : null,
    yetkiliTelefon: null,
    mudurAdSoyad: null,
    mudurTelefon: null,
    muhasebeAdSoyad: null,
    muhasebeTelefon: null,
    vergiNo: tur === "TUZEL_KISI" ? "1234567890" : null,
    vergiDairesi: tur === "TUZEL_KISI" ? "Kadıköy" : null,
    aktifMi: true,
    not: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
    aktifDosyaSayisi: aktifDosyaSayisi(i),
    ...extra,
  });

  return [
    base(1, "Ahmet Yılmaz", "GERCEK_KISI"),
    base(2, "Ayşe Demir", "GERCEK_KISI"),
    base(3, "Beta Hukuk Danışmanlık Ltd. Şti.", "TUZEL_KISI"),
    base(4, "Mehmet Kaya", "GERCEK_KISI"),
    base(5, "Gamma İnşaat A.Ş.", "TUZEL_KISI"),
    base(6, "Zeynep Çelik", "GERCEK_KISI"),
  ];
}

function pagedMuvekkil(q: string, page: number, pageSize: number): MuvekkilPagedResult {
  const all = demoMuvekkiller().filter((m) => {
    if (!q.trim()) return true;
    const hay = `${m.adSoyad} ${m.sirketUnvani ?? ""} ${m.telefon ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: all.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages: total === 0 ? 0 : totalPages,
  };
}

function demoDosyaList(muvekkilId: number): Dosya[] {
  return DEMO_DOSYALAR.filter((d) => d.muvekkilId === muvekkilId).sort((a, b) => b.id - a.id);
}

function demoDosyaGet(id: number): Dosya | null {
  return DEMO_DOSYALAR.find((d) => d.id === id) ?? null;
}

function demoKasaList(dosyaId: number): KasaHareket[] {
  return DEMO_KASA.filter((h) => h.dosyaId === dosyaId);
}

function demoKasaOzet(dosyaId: number): KasaOzet {
  const h = demoKasaList(dosyaId);
  const toplamAvans = h.filter((x) => x.islemTipi === "AVANS_GIRISI").reduce((s, x) => s + x.tutar, 0);
  const toplamMasraf = h.filter((x) => x.islemTipi === "MASRAF").reduce((s, x) => s + x.tutar, 0);
  return {
    toplamAvans,
    toplamMasraf,
    kalanAvans: toplamAvans - toplamMasraf,
    onayBekleyenSayisi: h.filter((x) => x.onayDurumu === "ONAYSIZ").length,
  };
}

function demoVekaletGetOrCreate(dosyaId: number, muvekkilId: number): VekaletUcreti {
  const existing = DEMO_VEKALETLER.find((v) => v.dosyaId === dosyaId);
  if (existing) return existing;
  return {
    id: dosyaId * 10,
    dosyaId,
    muvekkilId,
    anlasilanTutar: 0,
    aciklama: null,
    kayitTarihi: NOW,
    guncellemeTarihi: NOW,
  };
}

function demoTaksitUyariOzet(): VekaletTaksitUyariSonuc {
  const bugun = bugunYmdLocal();
  const muvekkiller = demoMuvekkiller();
  const muvekkilAd = (id: number) => {
    const m = muvekkiller.find((x) => x.id === id);
    return m ? muvekkilGorunenAd(m) : "—";
  };
  const dosyaKonu = (id: number) => (DEMO_DOSYALAR.find((d) => d.id === id)?.konuBasligi ?? "").trim() || "—";

  const kayitlar = DEMO_TAKSITLER.map((t) => {
    const sinif = siniflaVekaletTaksitUyari(t.vadeTarihi, t.kalanTutar, bugun);
    const satir =
      sinif === "vadesiGecmis"
        ? {
            taksitId: t.id,
            dosyaId: t.dosyaId,
            muvekkilId: t.muvekkilId,
            muvekkilAdi: muvekkilAd(t.muvekkilId),
            dosyaKonu: dosyaKonu(t.dosyaId),
            taksitNo: t.taksitNo,
            vadeTarihi: t.vadeTarihi,
            tutar: t.tutar,
            odenen: t.odenenToplam,
            kalan: t.kalanTutar,
            durum: "GECIKTI" as const,
          }
        : null;
    return { sinif, satir };
  });

  return vekaletTaksitUyariSonucFromKayitlar(kayitlar);
}

function demoVekaletTaksitList(vekaletId: number): VekaletTaksit[] {
  return DEMO_TAKSITLER.filter((t) => t.vekaletUcretiId === vekaletId).sort((a, b) => {
    const va = (a.vadeTarihi ?? "").slice(0, 10);
    const vb = (b.vadeTarihi ?? "").slice(0, 10);
    if (va !== vb) return va < vb ? -1 : 1;
    if (a.taksitNo !== b.taksitNo) return a.taksitNo - b.taksitNo;
    return a.id - b.id;
  });
}

function demoSmmBekleyenler(dosyaId?: number) {
  const rows = DEMO_TAKSITLER.filter((t) => t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId != null);
  const filtered = dosyaId != null && Number.isFinite(dosyaId) ? rows.filter((t) => t.dosyaId === dosyaId) : rows;
  return filtered.map((t) => ({
    odemeId: t.smmBekleyenOdemeId!,
    taksitId: t.id,
    dosyaId: t.dosyaId,
    muvekkilId: t.muvekkilId,
    tutar: t.odenenToplam,
    odemeTarihi: t.sonOdemeTarihi ?? NOW.slice(0, 10),
  }));
}

/** Tarayıcıda (Electron dışı) arayüz testi için sahte API. */
export function createBrowserPreviewApi(): RendererApi {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    licenseGetState: () => MOCK_LICENSE,
    licenseValidate: () => ({ ok: true, message: "Tarayıcı önizleme", expiresAt: MOCK_LICENSE.expiresAt }),
    licenseActivate: () => ({ ok: true, message: "Önizleme", productName: "Demo", expiresAt: null }),
    licenseStartTrial: () => ({ ok: true, message: "Önizleme deneme", expiresAt: MOCK_LICENSE.expiresAt, resumed: false }),
    licenseOpenRenewalUrl: () => ({ ok: true }),
    appQuit: () => ({ ok: true }),
    updateGetStatus: () => ({
      state: "idle",
      currentVersion: PREVIEW_APP_VERSION,
      availableVersion: null,
      releaseDate: null,
      releaseNotes: null,
      progress: null,
      errorMessage: null,
      showPrompt: false,
      infoMessage: null,
      lastCheckSource: null,
      packaged: false,
    }),
    updateCheck: () => ({ ok: true }),
    updateDownload: () => ({ ok: false, error: "Tarayıcı önizleme" }),
    updateInstall: () => ({ ok: false, error: "Tarayıcı önizleme" }),
    updateDismiss: () => ({ ok: true }),
    onUpdateStatusChanged: () => () => undefined,
    authNeedsSetup: () => false,
    authGetSession: () => MOCK_USER,
    authLogin: () => ({ ok: true, user: MOCK_USER }),
    authSetupFirst: () => ({ ok: true, user: MOCK_USER }),
    authLogout: () => ({ ok: true }),
    authForgotPasswordGetQuestion: () => ({ ok: false, error: "Önizleme modu" }),
    authForgotPasswordSubmit: () => ({ ok: false, error: "Önizleme modu" }),
    getRememberedLogin: () => null,
    saveRememberedLogin: () => ({ ok: true }),
    clearRememberedLogin: () => ({ ok: true }),
    authGuvenlikBilgisi: () => ({ guvenlikSorusuKodu: "ILK_OKUL", guvenlikSorusuMetni: "İlk okulunuz?" }),
    authGuvenlikGuncelle: () => ({ ok: true }),
    authSifreGuncelle: () => ({ ok: true }),
    getAppVersion: () => PREVIEW_APP_VERSION,
    officeGet: () => ({
      firmaAdi: "Demo Hukuk Bürosu",
      avukatAdSoyad: "Av. Demo Kullanıcı",
      adres: "Örnek Cad. No:1",
      telefon: "0212 000 00 00",
      eposta: "info@demo.com",
      vergiNo: null,
      vergiDairesi: null,
      logoPath: null,
    }),
    officeSave: () => ({ ok: true }),
    officePickLogo: () => ({ ok: false, error: "Tarayıcı önizleme" }),
    officeLogoDataUrl: () => null,
    backupAl: () => ({ ok: false, error: "Tarayıcı önizleme" }),
    backupGeriYukle: () => ({ ok: false, error: "Tarayıcı önizleme" }),
    muvekkilAraPaged: (_q: unknown, page: unknown, pageSize: unknown) =>
      pagedMuvekkil(String(_q ?? ""), Number(page) || 1, Number(pageSize) || 20),
    muvekkilAra: () => demoMuvekkiller(),
    muvekkilGet: (id: unknown) => demoMuvekkiller().find((m) => m.id === Number(id)) ?? null,
    muvekkilEkle: () => ({ ok: true }),
    muvekkilGuncelle: () => ({ ok: true }),
    dosyaList: (muvekkilId: unknown) => demoDosyaList(Number(muvekkilId)),
    dosyaGet: (id: unknown) => demoDosyaGet(Number(id)),
    dosyaEkle: () => ({ ok: true }),
    dosyaGuncelle: () => ({ ok: true }),
    ofisKasaAnaSayfaOzet: () => ({
      mode: "YEARLY",
      period: { mode: "YEARLY", bas: "2026-01-01", bit: "2026-12-31", etiket: "2026 Yılı" },
      isCurrent: true,
      canGoNext: false,
      bugunGider: 1250,
      buAyGider: 18450,
      devredenBakiye: 80000,
      donemGelir: 42000,
      donemGider: 18450,
      donemDuzeltmeEtkisi: 0,
      donemNetSonucu: 23550,
      kasaBakiyesi: 95600,
    }),
    ofisKasaUstOzet: () => ({
      mode: "YEARLY",
      period: { mode: "YEARLY", bas: "2026-01-01", bit: "2026-12-31", etiket: "2026 Yılı" },
      devredenBakiye: 80000,
      buAyGelir: 42000,
      buAyGider: 18450,
      buAyDuzeltmeEtkisi: 0,
      donemGelir: 42000,
      donemGider: 18450,
      donemDuzeltmeEtkisi: 0,
      donemNetSonucu: 23550,
      kasaBakiyesi: 95600,
    }),
    ofisKasaList: () => [],
    kurlarTcmb: () => ({
      ok: true as const,
      available: true as const,
      istenilenTarih: "2026-09-18",
      bulunanTcmbKurTarihi: "2026-09-18",
      effectiveDate: "2026-09-18",
      fetchedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      fromCache: true,
      source: "TCMB" as const,
      sourceLabel: "Türkiye Cumhuriyet Merkez Bankası",
      stale: false,
      fallbackKullanildi: false,
      cacheNote: null,
      usdDovizAlis: "48.61160000",
      usdDovizSatis: "48.70000000",
      eurDovizAlis: "55.79810000",
      eurDovizSatis: "55.90000000",
      usdEurCapraz: "0.87100000",
      eurUsdCapraz: "1.14800000",
      rates: [],
    }),
    kurlarTcmbCapraz: () => ({
      ok: true as const,
      available: true as const,
      dovizAlis: "1.14800000",
      bulunanTcmbKurTarihi: "2026-09-18",
    }),
    kurlarYaklasikTry: (items: { tutar: number; paraBirimi: string; id?: string }[]) =>
      (items ?? []).map((it) => ({
        id: it.id ?? null,
        paraBirimi: it.paraBirimi,
        tutar: it.tutar,
        tryTutar: it.paraBirimi === "TRY" ? it.tutar : it.tutar * 48.6116,
        kurTarihi: "2026-09-18",
        aciklama: "Bugünkü TCMB Döviz Alış kuruna göre yaklaşık",
        available: true,
      })),
    getAccountingPeriodMode: () => "YEARLY",
    setAccountingPeriodMode: (mode: unknown) => (mode === "MONTHLY" ? "MONTHLY" : "YEARLY"),
    icraTahsilatUstOzet: () => ({
      toplamAlacak: 0,
      tahsilEdilen: 0,
      kalanAlacak: 0,
      vadesiGecmisTaksit: 0,
      buAyTahsilat: 0,
    }),
    icraTahsilatList: () => [],
    vekaletSmmBekleyenler: (dosyaId: unknown) =>
      demoSmmBekleyenler(dosyaId != null && dosyaId !== "" ? Number(dosyaId) : undefined),
    vekaletTaksitUyariOzet: () => demoTaksitUyariOzet(),
    vekaletGetOrCreate: (dosyaId: unknown, muvekkilId: unknown) =>
      demoVekaletGetOrCreate(Number(dosyaId), Number(muvekkilId)),
    vekaletTaksitList: (vekaletId: unknown) => demoVekaletTaksitList(Number(vekaletId)),
    vekaletTaksitleriTopluSil: () => ({ ok: false as const, error: "Önizlemede toplu silme yok" }),
    masrafTurleri: () => [
      "Harç",
      "Gider Avansı",
      "Bilirkişi Ücreti",
      "Keşif-İcra, Haciz vs.",
      "Yol-Yemek vs.",
      "Diğer",
    ],
    kasaList: (dosyaId: unknown) => demoKasaList(Number(dosyaId)),
    kasaOzet: (dosyaId: unknown) => demoKasaOzet(Number(dosyaId)),
    printGetPrinters: () => [],
    pathToFileUrl: () => null,
    openContactLink: (url: string) => {
      if (/^mailto:/i.test(url) || /^tel:/i.test(url)) {
        return { ok: true as const };
      }
      return { ok: false as const, error: "Tarayıcı önizleme" };
    },
  };

  const fallback = () => [];

  return new Proxy(handlers, {
    get(target, prop: string) {
      if (prop in target) {
        const fn = target[prop];
        return (...args: unknown[]) => Promise.resolve(fn(...args));
      }
      return () => Promise.resolve(fallback());
    },
  }) as unknown as RendererApi;
}
