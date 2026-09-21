import { getDb } from "../db/connection";
import { ODEME_AKTIF_OFIS_SQL, TAKSIT_AKTIF_SQL, VEKALET_AKTIF_SQL } from "@shared/lib/tahsilatOdemeAktif";
import { bugunYmdLocal } from "@shared/lib/vekaletTaksitUyari";
import { tryResolveParaBirimi } from "@shared/lib/paraBirimi";
import { isOdemeYontemiGecerli } from "@shared/constants/kasa";
import type {
  TahsilatMerkeziGorunum,
  TahsilatMerkeziGorunumFilter,
  TahsilatMerkeziListeParams,
  TahsilatMerkeziListResponse,
  TahsilatMerkeziOzet,
  TahsilatMerkeziSatir,
} from "@shared/types/tahsilatMerkezi";
import type { TaksitDurum, TaksitSmmDurum, VekaletTaksit, VekaletTaksitOdeme } from "@shared/types/vekalet";

type RawDbRow = {
  taksit_id: number;
  vekalet_ucreti_id: number;
  dosya_id: number;
  muvekkil_id: number;
  taksit_no: number;
  vade_tarihi: string | null;
  tutar: number;
  para_birimi: string | null;
  aciklama: string | null;
  kayit_tarihi: string;
  guncelleme_tarihi: string;
  odenen: number;
  konu_basligi: string | null;
  dosya_numarasi: string | null;
  muvekkil_turu: string;
  ad_soyad: string | null;
  sirket_unvani: string | null;
  telefon: string | null;
};

type OdemeRow = {
  id: number;
  taksit_id: number;
  vekalet_id: number;
  dosya_id: number;
  muvekkil_id: number;
  odeme_tarihi: string;
  tutar: number;
  kasa_tutari: number | null;
  alacak_para_birimi: string | null;
  odeme_para_birimi: string | null;
  kur: number | null;
  kur_baz_para_birimi: string | null;
  kur_karsi_para_birimi: string | null;
  kur_kaynagi: string | null;
  tcmb_kur_tarihi: string | null;
  tcmb_referans_kur: number | null;
  odeme_yontemi: string;
  aciklama: string | null;
  makbuz_no: string | null;
  smm_kesildi_mi: number;
  kasa_hareket_id: number | null;
  ofis_kasa_hareket_id: number | null;
  olusturan_kullanici_id: number | null;
  olusturan_kullanici_adi: string | null;
  kayit_tarihi: string;
  guncelleme_tarihi: string;
};

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return bugunYmdLocal(dt);
}

function gunFarkiFromVade(vadeYmd: string, bugunYmd: string): number {
  const [vy, vm, vd] = vadeYmd.split("-").map(Number);
  const [by, bm, bd] = bugunYmd.split("-").map(Number);
  const v = Date.UTC(vy, vm - 1, vd);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((v - b) / 86_400_000);
}

function vadeGecmisMi(vade: string | null, bugun: string): boolean {
  if (!vade) return false;
  const v = vade.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && v < bugun;
}

function hesaplaDurum(tutar: number, odenen: number, vadeTarihi: string | null, bugun: string): TaksitDurum {
  const kalan = Math.max(0, tutar - odenen);
  if (odenen <= 0) {
    if (vadeGecmisMi(vadeTarihi, bugun) && kalan > 0) return "GECIKTI";
    return "ODENMEDI";
  }
  if (odenen >= tutar - 0.001) return "ODENDI";
  if (vadeGecmisMi(vadeTarihi, bugun) && kalan > 0) return "GECIKTI";
  return "KISMI_ODENDI";
}

function hesaplaSmmDurumu(odemeler: VekaletTaksitOdeme[]): { smmDurumu: TaksitSmmDurum; smmBekleyenOdemeId: number | null } {
  if (odemeler.length === 0) return { smmDurumu: "YOK", smmBekleyenOdemeId: null };
  const bekleyen = odemeler.find((o) => !o.smmKesildiMi);
  if (bekleyen) return { smmDurumu: "BEKLIYOR", smmBekleyenOdemeId: bekleyen.id };
  return { smmDurumu: "KESILDI", smmBekleyenOdemeId: null };
}

function rowOdeme(r: OdemeRow): VekaletTaksitOdeme {
  return {
    id: Number(r.id),
    taksitId: Number(r.taksit_id),
    vekaletId: Number(r.vekalet_id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    odemeTarihi: String(r.odeme_tarihi ?? "").slice(0, 10),
    tutar: Number(r.tutar ?? 0),
    kasaTutari: Number(r.kasa_tutari ?? r.tutar ?? 0),
    alacakParaBirimi: tryResolveParaBirimi(r.alacak_para_birimi),
    odemeParaBirimi: tryResolveParaBirimi(r.odeme_para_birimi),
    kur: r.kur == null ? null : Number(r.kur),
    kurBazParaBirimi: r.kur_baz_para_birimi == null ? null : tryResolveParaBirimi(r.kur_baz_para_birimi),
    kurKarsiParaBirimi: r.kur_karsi_para_birimi == null ? null : tryResolveParaBirimi(r.kur_karsi_para_birimi),
    kurKaynagi: r.kur_kaynagi === "TCMB" || r.kur_kaynagi === "MANUEL" ? r.kur_kaynagi : null,
    tcmbKurTarihi: r.tcmb_kur_tarihi == null ? null : String(r.tcmb_kur_tarihi),
    tcmbReferansKur: r.tcmb_referans_kur == null ? null : Number(r.tcmb_referans_kur),
    odemeYontemi: isOdemeYontemiGecerli(String(r.odeme_yontemi ?? ""))
      ? (String(r.odeme_yontemi) as VekaletTaksitOdeme["odemeYontemi"])
      : "NAKIT",
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    smmKesildiMi: Number(r.smm_kesildi_mi) === 1,
    kasaHareketId: r.kasa_hareket_id == null ? null : Number(r.kasa_hareket_id),
    ofisKasaHareketId: r.ofis_kasa_hareket_id == null ? null : Number(r.ofis_kasa_hareket_id),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function buildVekaletTaksit(r: RawDbRow, odemeler: VekaletTaksitOdeme[]): VekaletTaksit {
  const tutar = Number(r.tutar ?? 0);
  const odenenToplam = odemeler.reduce((s, o) => s + o.tutar, 0);
  const kalanTutar = Math.max(0, tutar - odenenToplam);
  const vade = r.vade_tarihi == null ? null : String(r.vade_tarihi).slice(0, 10);
  const bugun = bugunYmdLocal();
  const sorted = [...odemeler].sort((a, b) => {
    if (a.odemeTarihi !== b.odemeTarihi) return b.odemeTarihi.localeCompare(a.odemeTarihi);
    return b.id - a.id;
  });
  const sonOdeme = sorted[0] ?? null;
  const { smmDurumu, smmBekleyenOdemeId } = hesaplaSmmDurumu(sorted);
  return {
    id: Number(r.taksit_id),
    vekaletUcretiId: Number(r.vekalet_ucreti_id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    taksitNo: Number(r.taksit_no),
    tutar,
    paraBirimi: tryResolveParaBirimi(r.para_birimi),
    vadeTarihi: vade,
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
    odenenToplam,
    kalanTutar,
    durum: hesaplaDurum(tutar, odenenToplam, vade, bugun),
    smmDurumu,
    sonOdemeTarihi: sonOdeme?.odemeTarihi ?? null,
    sonMakbuzNo: sonOdeme?.makbuzNo ?? null,
    sonOdemeId: sonOdeme?.id ?? null,
    smmBekleyenOdemeId,
  };
}

function muvekkilAdFromRow(r: Pick<RawDbRow, "muvekkil_turu" | "ad_soyad" | "sirket_unvani">): string {
  if (r.muvekkil_turu === "TUZEL_KISI") {
    const unvan = (r.sirket_unvani ?? "").trim();
    if (unvan) return unvan;
  }
  const ad = (r.ad_soyad ?? "").trim();
  return ad || "—";
}

function classifyGorunumler(
  vadeYmd: string,
  bugunYmd: string,
  kalan: number,
  durum: TaksitDurum,
): TahsilatMerkeziGorunum[] {
  if (!Number.isFinite(kalan) || kalan <= 0.001) return [];
  const tags: TahsilatMerkeziGorunum[] = [];
  if (durum === "KISMI_ODENDI") tags.push("KISMI");
  if (vadeYmd < bugunYmd) tags.push("GECIKMIS");
  else if (vadeYmd === bugunYmd) tags.push("BUGUN");
  else if (vadeYmd <= ymdAddDays(bugunYmd, 7)) tags.push("YAKLASAN");
  return tags;
}

function matchesGorunumFilter(gorunumler: TahsilatMerkeziGorunum[], filter: TahsilatMerkeziGorunumFilter): boolean {
  switch (filter) {
    case "GECIKENLER":
      return gorunumler.includes("GECIKMIS");
    case "BUGUN":
      return gorunumler.includes("BUGUN");
    case "YAKLASANLAR":
      return gorunumler.includes("YAKLASAN");
    case "KISMI_ODENENLER":
      return gorunumler.includes("KISMI");
    case "TUMU":
      return true;
    default:
      return true;
  }
}

function loadOdemeMap(d: ReturnType<typeof getDb>, taksitIds: number[]): Map<number, VekaletTaksitOdeme[]> {
  const map = new Map<number, VekaletTaksitOdeme[]>();
  if (taksitIds.length === 0) return map;
  const placeholders = taksitIds.map(() => "?").join(",");
  const rows = d
    .prepare(
      `SELECT * FROM vekalet_taksit_odeme WHERE taksit_id IN (${placeholders})
       ORDER BY odeme_tarihi ASC, id ASC`,
    )
    .all(...taksitIds) as OdemeRow[];
  for (const row of rows) {
    const tid = Number(row.taksit_id);
    const list = map.get(tid) ?? [];
    list.push(rowOdeme(row));
    map.set(tid, list);
  }
  return map;
}

function loadOpenTaksitRows(): TahsilatMerkeziSatir[] {
  const d = getDb();
  const bugun = bugunYmdLocal();

  const rows = d
    .prepare(
      `SELECT t.id AS taksit_id,
        t.vekalet_ucreti_id,
        t.dosya_id,
        t.muvekkil_id,
        t.taksit_no,
        t.vade_tarihi,
        t.tutar,
        t.para_birimi,
        t.aciklama,
        t.kayit_tarihi,
        t.guncelleme_tarihi,
        d.konu_basligi,
        d.dosya_numarasi,
        m.muvekkil_turu,
        m.ad_soyad,
        m.sirket_unvani,
        m.telefon,
        COALESCE((SELECT SUM(o.tutar) FROM vekalet_taksit_odeme o WHERE o.taksit_id = t.id AND ${ODEME_AKTIF_OFIS_SQL}), 0) AS odenen
       FROM vekalet_ucreti_taksit t
       INNER JOIN anlasilan_vekalet_ucreti v ON v.id = t.vekalet_ucreti_id
       INNER JOIN dosya d ON d.id = v.dosya_id
       INNER JOIN muvekkil m ON m.id = v.muvekkil_id
       WHERE ${TAKSIT_AKTIF_SQL} AND ${VEKALET_AKTIF_SQL}`,
    )
    .all() as RawDbRow[];

  const openRows = rows.filter((r) => {
    const kalan = Math.max(0, Number(r.tutar ?? 0) - Number(r.odenen ?? 0));
    return kalan > 0.001;
  });

  const odemeMap = loadOdemeMap(
    d,
    openRows.map((r) => Number(r.taksit_id)),
  );

  const result: TahsilatMerkeziSatir[] = [];

  for (const r of openRows) {
    const taksitTutari = Number(r.tutar ?? 0);
    const odenen = Number(r.odenen ?? 0);
    const kalan = Math.max(0, taksitTutari - odenen);
    const odemeler = odemeMap.get(Number(r.taksit_id)) ?? [];
    const taksit = buildVekaletTaksit(r, odemeler);
    if (taksit.durum === "ODENDI") continue;

    const vadeYmd = taksit.vadeTarihi ?? bugun;
    const gorunumler = classifyGorunumler(vadeYmd, bugun, kalan, taksit.durum);
    const telefon = (r.telefon ?? "").trim();

    result.push({
      id: Number(r.taksit_id),
      muvekkilId: Number(r.muvekkil_id),
      muvekkilAd: muvekkilAdFromRow(r),
      muvekkilTelefonVar: telefon.length > 0,
      dosyaId: Number(r.dosya_id),
      dosyaBaslik: (r.konu_basligi ?? "").trim() || "—",
      dosyaNo: r.dosya_numarasi == null || String(r.dosya_numarasi).trim() === "" ? null : String(r.dosya_numarasi).trim(),
      taksitNo: Number(r.taksit_no),
      taksitAciklama: r.aciklama == null ? null : String(r.aciklama),
      taksitTutari,
      odenenToplam: odenen,
      kalanTutar: kalan,
      vadeTarihi: vadeYmd,
      durum: taksit.durum,
      gunFarki: gunFarkiFromVade(vadeYmd, bugun),
      gorunumler,
      taksit,
    });
  }

  result.sort((a, b) => {
    if (a.gunFarki !== b.gunFarki) return a.gunFarki - b.gunFarki;
    if (a.vadeTarihi !== b.vadeTarihi) return a.vadeTarihi.localeCompare(b.vadeTarihi);
    return a.muvekkilAd.localeCompare(b.muvekkilAd, "tr");
  });

  return result;
}

function filterRows(rows: TahsilatMerkeziSatir[], params: TahsilatMerkeziListeParams): TahsilatMerkeziSatir[] {
  const gorunum = params.gorunum ?? "YAKLASANLAR";
  const q = params.q?.trim().toLowerCase();

  return rows.filter((row) => {
    if (gorunum === "TUMU") {
      /* tüm açık taksitler */
    } else if (gorunum === "KISMI_ODENENLER") {
      if (!row.gorunumler.includes("KISMI")) return false;
    } else if (!matchesGorunumFilter(row.gorunumler, gorunum)) {
      return false;
    }

    if (params.muvekkilId != null && row.muvekkilId !== params.muvekkilId) return false;
    if (params.dosyaId != null && row.dosyaId !== params.dosyaId) return false;
    if (params.durum && row.durum !== params.durum) return false;
    if (params.vadeBas && row.vadeTarihi < params.vadeBas) return false;
    if (params.vadeBit && row.vadeTarihi > params.vadeBit) return false;

    if (q) {
      const hay = `${row.muvekkilAd} ${row.dosyaBaslik} ${row.dosyaNo ?? ""} ${row.taksitNo}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

function computeOzet(rows: TahsilatMerkeziSatir[], bugun: string): TahsilatMerkeziOzet {
  let gecikmisToplam = 0;
  let gecikmisAdet = 0;
  let bugunToplam = 0;
  let bugunAdet = 0;
  let yakin7GunToplam = 0;
  let yakin7GunAdet = 0;
  let kismiToplam = 0;
  let kismiAdet = 0;
  let yaklasanAdet = 0;

  const yakinBit = ymdAddDays(bugun, 7);

  for (const row of rows) {
    const kalan = row.kalanTutar;
    const v = row.vadeTarihi;

    if (v < bugun) {
      gecikmisToplam += kalan;
      gecikmisAdet += 1;
    }
    if (v === bugun) {
      bugunToplam += kalan;
      bugunAdet += 1;
    }
    if (v > bugun && v <= yakinBit) {
      yakin7GunToplam += kalan;
      yakin7GunAdet += 1;
    }
    if (row.gorunumler.includes("YAKLASAN")) {
      yaklasanAdet += 1;
    }
    if (row.durum === "KISMI_ODENDI") {
      kismiToplam += kalan;
      kismiAdet += 1;
    }
  }

  return {
    gecikmisToplam,
    gecikmisAdet,
    bugunToplam,
    bugunAdet,
    yakin7GunToplam,
    yakin7GunAdet,
    kismiToplam,
    kismiAdet,
    yaklasanAdet,
  };
}

export function getTahsilatMerkeziOzet(): TahsilatMerkeziOzet {
  const bugun = bugunYmdLocal();
  const rows = loadOpenTaksitRows();
  return computeOzet(rows, bugun);
}

export function listTahsilatMerkezi(params: TahsilatMerkeziListeParams = {}): TahsilatMerkeziListResponse {
  const bugun = bugunYmdLocal();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));

  const allRows = loadOpenTaksitRows();
  const ozet = computeOzet(allRows, bugun);
  const filtered = filterRows(allRows, params);
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return { items, total, page, limit, ozet };
}
