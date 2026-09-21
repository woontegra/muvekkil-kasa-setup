/**
 * SaaS getMuvekkilKarlilik / computeForMuvekkil paritesi.
 * Para birimleri birbirine çevrilmez.
 */
import { getAccountingPeriod } from "@shared/lib/accountingPeriod";
import {
  addToNumberByCurrency,
  emptyNumberByCurrency,
  netByCurrency,
  toMoneyByCurrency,
  type KarlilikCurrency,
  type NumberByCurrency,
} from "@shared/lib/karlilikParaBirimi";
import { moneyToFixed2, roundMoney } from "@shared/lib/paraBirimi";
import { ODEME_AKTIF_OFIS_SQL } from "@shared/lib/tahsilatOdemeAktif";
import type { DosyaDurum } from "@shared/types/dosya";
import type {
  MuvekkilKarlilikDosya,
  MuvekkilKarlilikPayload,
  MuvekkilKarlilikResponse,
  MuvekkilKarlilikSonuc,
} from "@shared/types/muvekkilKarlilik";
import type { MuvekkilOfisGelirListe, MuvekkilOfisGelirSatir } from "@shared/types/muvekkilOfisGelir";
import { getDb } from "../db/connection";
import { getAccountingPeriodMode } from "./appSettings.service";
import { KASA_AKTIF_SQL, OFIS_KASA_AKTIF_SQL } from "./kasaAktifSql";
import { DOSYA_KASA_VEKALET_HARIC_SQL } from "./kasa.service";
import { muvekkilGet } from "./muvekkil.service";

export type { MuvekkilOfisGelirListe, MuvekkilOfisGelirSatir };

type PeriodRange = { bas: string; bit: string };

function inPeriod(ymd: string, period?: PeriodRange): boolean {
  const t = ymd.slice(0, 10);
  if (!period) return true;
  return t >= period.bas && t <= period.bit;
}

function normalizeDurum(v: unknown): DosyaDurum {
  const s = String(v ?? "AKTIF").toUpperCase();
  if (s === "PASIF" || s === "KAPANDI") return s;
  return "AKTIF";
}

function computeForMuvekkil(muvekkilId: number, period?: PeriodRange): MuvekkilKarlilikPayload {
  const d = getDb();

  const dosyalar = d
    .prepare(`SELECT id, konu_basligi, dosya_numarasi, durum FROM dosya WHERE muvekkil_id = ?`)
    .all(muvekkilId) as Record<string, unknown>[];

  const kararlastirilan = emptyNumberByCurrency();
  const tahsil = emptyNumberByCurrency();
  const ofisGeliri = emptyNumberByCurrency();
  const gider = emptyNumberByCurrency();

  let toplamAvansBakiye = 0;
  let toplamDosyaMasrafi = 0;
  let toplamMasrafAvansiIadesi = 0;

  type DosyaNet = {
    dosyaId: number;
    konuBasligi: string;
    dosyaNo: string | null;
    durum: DosyaDurum;
    nets: NumberByCurrency;
    tahsil: NumberByCurrency;
    buroTry: number;
  };
  const dosyaNets: DosyaNet[] = [];

  for (const dos of dosyalar) {
    const dosyaId = Number(dos.id);
    const konu = (dos.konu_basligi == null ? "" : String(dos.konu_basligi)).trim() || "Dosya";
    const dosyaNo = dos.dosya_numarasi == null ? null : String(dos.dosya_numarasi).trim() || null;
    const durum = normalizeDurum(dos.durum);

    const dosyaTahsil = emptyNumberByCurrency();
    let buroTry = 0;

    if (!period) {
      const vekaletler = d
        .prepare(
          `SELECT anlasilan_tutar, COALESCE(para_birimi, 'TRY') AS pb
           FROM anlasilan_vekalet_ucreti
           WHERE dosya_id = ? AND COALESCE(durum, 'AKTIF') = 'AKTIF' AND silinme_tarihi IS NULL`,
        )
        .all(dosyaId) as { anlasilan_tutar: number; pb: string }[];
      for (const v of vekaletler) {
        addToNumberByCurrency(kararlastirilan, v.pb, Number(v.anlasilan_tutar ?? 0));
      }
    }

    const odemeler = d
      .prepare(
        `SELECT o.tutar, o.odeme_tarihi, COALESCE(o.alacak_para_birimi, 'TRY') AS pb
         FROM vekalet_taksit_odeme o
         WHERE o.dosya_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
      )
      .all(dosyaId) as { tutar: number; odeme_tarihi: string; pb: string }[];
    for (const o of odemeler) {
      if (!inPeriod(String(o.odeme_tarihi), period)) continue;
      addToNumberByCurrency(tahsil, o.pb, Number(o.tutar ?? 0));
      addToNumberByCurrency(dosyaTahsil, o.pb, Number(o.tutar ?? 0));
    }

    const kasa = d
      .prepare(
        `SELECT islem_tipi, tutar, tarih FROM dosya_kasa_hareket
         WHERE dosya_id = ? AND onay_durumu = 'ONAYLI' ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}`,
      )
      .all(dosyaId) as { islem_tipi: string; tutar: number; tarih: string }[];

    let avans = 0;
    let masraf = 0;
    let duzeltme = 0;
    for (const r of kasa) {
      if (!inPeriod(String(r.tarih), period)) continue;
      const v = Number(r.tutar ?? 0);
      if (r.islem_tipi === "AVANS_GIRISI") avans += v;
      else if (r.islem_tipi === "MASRAF") {
        masraf += v;
        toplamDosyaMasrafi += v;
      } else if (r.islem_tipi === "DUZELTME") {
        duzeltme += v;
        if (v < 0) toplamMasrafAvansiIadesi += Math.abs(v);
      }
    }
    const kasaBakiye = avans - masraf + duzeltme;
    if (kasaBakiye > 0) toplamAvansBakiye += kasaBakiye;
    if (kasaBakiye < 0) {
      buroTry = Math.abs(kasaBakiye);
      gider.TRY = roundMoney(gider.TRY + buroTry);
    }

    const nets = emptyNumberByCurrency();
    for (const pb of ["TRY", "USD", "EUR"] as KarlilikCurrency[]) {
      nets[pb] = roundMoney(dosyaTahsil[pb] - (pb === "TRY" ? buroTry : 0));
    }

    dosyaNets.push({
      dosyaId,
      konuBasligi: konu,
      dosyaNo,
      durum,
      nets,
      tahsil: dosyaTahsil,
      buroTry,
    });
  }

  // Ofis manuel gelir (kaynak yok) + bağlı düzeltme — ONAYLI
  const ofisGelirRows = d
    .prepare(
      `SELECT id, tutar, COALESCE(para_birimi, 'TRY') AS pb, tarih, islem_tipi, orijinal_hareket_id
       FROM ofis_kasa_hareketleri
       WHERE muvekkil_id = ?
         AND onay_durumu = 'ONAYLI'
         ${OFIS_KASA_AKTIF_SQL}
         AND (
           (islem_tipi = 'GELIR' AND (kaynak_tipi IS NULL OR TRIM(kaynak_tipi) = ''))
           OR islem_tipi = 'DUZELTME'
         )`,
    )
    .all(muvekkilId) as {
    id: number;
    tutar: number;
    pb: string;
    tarih: string;
    islem_tipi: string;
    orijinal_hareket_id: number | null;
  }[];

  const manuelGelirIds = new Set(
    ofisGelirRows.filter((r) => r.islem_tipi === "GELIR").map((r) => r.id),
  );
  for (const r of ofisGelirRows) {
    if (!inPeriod(String(r.tarih), period)) continue;
    if (r.islem_tipi === "GELIR") {
      addToNumberByCurrency(ofisGeliri, r.pb, Number(r.tutar ?? 0));
    } else if (
      r.islem_tipi === "DUZELTME" &&
      r.orijinal_hareket_id != null &&
      manuelGelirIds.has(Number(r.orijinal_hareket_id))
    ) {
      // Düzeltme etkisi: tutar signed as stored
      addToNumberByCurrency(ofisGeliri, r.pb, Number(r.tutar ?? 0));
    }
  }

  // Müvekkile bağlı ofis GIDER (+ düzeltme)
  const ofisGiderRows = d
    .prepare(
      `SELECT id, tutar, COALESCE(para_birimi, 'TRY') AS pb, tarih, islem_tipi, orijinal_hareket_id
       FROM ofis_kasa_hareketleri
       WHERE muvekkil_id = ?
         AND onay_durumu = 'ONAYLI'
         ${OFIS_KASA_AKTIF_SQL}
         AND (islem_tipi = 'GIDER' OR islem_tipi = 'DUZELTME')`,
    )
    .all(muvekkilId) as {
    id: number;
    tutar: number;
    pb: string;
    tarih: string;
    islem_tipi: string;
    orijinal_hareket_id: number | null;
  }[];

  const giderIds = new Set(ofisGiderRows.filter((r) => r.islem_tipi === "GIDER").map((r) => r.id));
  for (const r of ofisGiderRows) {
    if (!inPeriod(String(r.tarih), period)) continue;
    if (r.islem_tipi === "GIDER") {
      addToNumberByCurrency(gider, r.pb, Number(r.tutar ?? 0));
    } else if (
      r.islem_tipi === "DUZELTME" &&
      r.orijinal_hareket_id != null &&
      giderIds.has(Number(r.orijinal_hareket_id))
    ) {
      addToNumberByCurrency(gider, r.pb, Number(r.tutar ?? 0));
    }
  }

  const gelir = emptyNumberByCurrency();
  for (const pb of ["TRY", "USD", "EUR"] as KarlilikCurrency[]) {
    gelir[pb] = roundMoney(tahsil[pb] + ofisGeliri[pb]);
  }
  const net = netByCurrency(gelir, gider);

  const kalan = emptyNumberByCurrency();
  for (const pb of ["TRY", "USD", "EUR"] as KarlilikCurrency[]) {
    kalan[pb] = Math.max(0, roundMoney(kararlastirilan[pb] - tahsil[pb]));
  }

  function toDosyaRow(n: DosyaNet, pb: KarlilikCurrency): MuvekkilKarlilikDosya {
    return {
      dosyaId: n.dosyaId,
      konuBasligi: n.konuBasligi,
      dosyaNo: n.dosyaNo,
      durum: n.durum,
      paraBirimi: pb,
      tahsilEdilenVekalet: moneyToFixed2(n.tahsil[pb]),
      buroKarsiladigiGider: moneyToFixed2(pb === "TRY" ? n.buroTry : 0),
      netKazanc: moneyToFixed2(n.nets[pb]),
    };
  }

  const kazancDagilimi: MuvekkilKarlilikPayload["kazancDagilimi"] = {
    TRY: null,
    USD: null,
    EUR: null,
  };
  for (const pb of ["TRY", "USD", "EUR"] as KarlilikCurrency[]) {
    const ranked = [...dosyaNets].sort((a, b) => b.nets[pb] - a.nets[pb]);
    if (ranked.length === 0) continue;
    kazancDagilimi[pb] = {
      enYuksekKazanc: toDosyaRow(ranked[0], pb),
      enDusukKazanc: toDosyaRow(ranked[ranked.length - 1], pb),
    };
  }

  return {
    toplamDosya: dosyalar.length,
    kararlastirilanVekalet: toMoneyByCurrency(kararlastirilan),
    tahsilEdilenVekalet: toMoneyByCurrency(tahsil),
    kalanAlacak: toMoneyByCurrency(kalan),
    toplamAvansBakiye: moneyToFixed2(toplamAvansBakiye),
    toplamDosyaMasrafi: moneyToFixed2(toplamDosyaMasrafi),
    toplamMasrafAvansiIadesi: moneyToFixed2(toplamMasrafAvansiIadesi),
    ofisGeliri: toMoneyByCurrency(ofisGeliri),
    gider: toMoneyByCurrency(gider),
    netKazanc: toMoneyByCurrency(net),
    kazancDagilimi,
  };
}

export function getMuvekkilKarlilik(muvekkilId: number): MuvekkilKarlilikSonuc {
  if (!Number.isFinite(muvekkilId) || muvekkilId <= 0) {
    return { ok: false, error: "Geçersiz müvekkil" };
  }
  if (!muvekkilGet(muvekkilId)) {
    return { ok: false, error: "Müvekkil bulunamadı" };
  }
  try {
    const mode = getAccountingPeriodMode();
    const period = getAccountingPeriod(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
    const data: MuvekkilKarlilikResponse = {
      tumZamanlar: computeForMuvekkil(muvekkilId),
      buDonem: computeForMuvekkil(muvekkilId, { bas: period.bas, bit: period.bit }),
      donemEtiketi: period.etiket,
    };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Kârlılık hesaplanamadı" };
  }
}

export function listMuvekkilOfisGelirleri(
  muvekkilId: number,
  opts?: { page?: number; limit?: number },
): MuvekkilOfisGelirListe {
  const d = getDb();
  const pageSize = Math.min(200, Math.max(1, opts?.limit ?? 20));
  const page = Math.max(1, opts?.page ?? 1);
  const offset = (page - 1) * pageSize;

  const total = Number(
    (
      d
        .prepare(
          `SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri
           WHERE muvekkil_id = ? AND islem_tipi = 'GELIR' ${OFIS_KASA_AKTIF_SQL}`,
        )
        .get(muvekkilId) as { c: number }
    ).c ?? 0,
  );

  const rows = d
    .prepare(
      `SELECT id, tarih, belge_no, kategori, ozel_kategori_adi, aciklama, odeme_yontemi,
              tahsilati_yapan_kullanici_adi, tutar, COALESCE(para_birimi, 'TRY') AS pb,
              islem_tipi, kaynak_tipi
       FROM ofis_kasa_hareketleri
       WHERE muvekkil_id = ? AND islem_tipi = 'GELIR' ${OFIS_KASA_AKTIF_SQL}
       ORDER BY tarih DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(muvekkilId, pageSize, offset) as Record<string, unknown>[];

  return {
    total,
    page,
    pageSize,
    items: rows.map((r) => ({
      id: Number(r.id),
      tarih: String(r.tarih ?? "").slice(0, 10),
      belgeNo: r.belge_no == null ? null : String(r.belge_no),
      kategori: String(r.kategori ?? ""),
      ozelKategoriAdi: r.ozel_kategori_adi == null ? null : String(r.ozel_kategori_adi),
      aciklama: r.aciklama == null ? null : String(r.aciklama),
      odemeYontemi: String(r.odeme_yontemi ?? ""),
      tahsilatiYapanKullaniciAdi:
        r.tahsilati_yapan_kullanici_adi == null ? null : String(r.tahsilati_yapan_kullanici_adi),
      tutar: Number(r.tutar ?? 0),
      paraBirimi: String(r.pb ?? "TRY"),
      islemTipi: String(r.islem_tipi ?? "GELIR"),
      kaynakTipi: r.kaynak_tipi == null ? null : String(r.kaynak_tipi),
    })),
  };
}
