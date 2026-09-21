import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  PERSONEL_MAAS_KOD,
  isGecerliOfisGelirKategori,
  isGecerliOfisGiderKategori,
  isOfisOdemeYontemiGecerli,
  OFIS_GELIR_KATEGORI_ETIKET,
  OFIS_GIDER_KATEGORI_ETIKET,
  OFIS_KASA_KAYNAK_VEKALET_TAHSILATI,
  OFIS_KASA_KAYNAK_ICRA_TAHSILAT,
  ofisKategoriOzelAdDb,
} from "@shared/constants/ofisKasa";
import {
  duzeltmeKasaEtkisiFromRow,
  hesaplaOfisKasaDuzeltme,
} from "@shared/ofisKasaDuzeltme";
import type {
  OfisKasaAnaSayfaOzet,
  OfisKasaDovizDonusumInput,
  OfisKasaDuzeltmeInput,
  OfisKasaEkleInput,
  OfisKasaGuncellePatch,
  OfisKasaHareket,
  OfisKasaHareketListeSatir,
  OfisKasaIslemSonuc,
  OfisKasaListFilter,
  OfisKasaRaporPaketi,
  OfisKasaUstOzet,
} from "@shared/types/ofisKasa";
import {
  PARA_BIRIMLERI,
  applyToCurrencyBucket,
  currencyBucketBalance,
  emptyCurrencyBuckets,
  formatKurOzeti,
  resolveDovizDonusum,
  resolveParaBirimi,
  roundMoney,
  tryResolveParaBirimi,
  type ParaBirimi,
} from "@shared/lib/paraBirimi";
import { randomUUID } from "node:crypto";
import { OFIS_KASA_AKTIF_SQL } from "./kasaAktifSql";
import { fromKurus, toKurus } from "@shared/lib/moneyKurus";
import {
  canGoToNextAccountingPeriod,
  getAccountingPeriod,
  isCurrentAccountingPeriod,
  toLocalYmd,
} from "@shared/lib/accountingPeriod";
import { getAccountingPeriodMode } from "./appSettings.service";
import { getDb, nowIso } from "../db/connection";
import { officeSettingsGetForMakbuz } from "./office.service";
import { getTcmbPairRate } from "./tcmbKur.service";
import {
  getFinansKalemiByKod,
  kalemOzelAdGerekli,
  resolveAktifManuelKalem,
} from "./finansKalemi.service";
import { muvekkilGet } from "./muvekkil.service";

function formatDateTrSimple(iso: string): string {
  const p = String(iso ?? "").slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function formatTrySimple(n: number): string {
  return `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function kategoriEtiketi(kategori: string, ozelKategoriAdi: string | null): string {
  if (kategori === "DUZELTME") return "Düzeltme";
  const ozel = (ozelKategoriAdi ?? "").trim();
  if (kategori === DIGER_GELIR_KOD || kategori === DIGER_GIDER_KOD) {
    return ozel || (kategori === DIGER_GELIR_KOD ? OFIS_GELIR_KATEGORI_ETIKET[DIGER_GELIR_KOD] : OFIS_GIDER_KATEGORI_ETIKET[DIGER_GIDER_KOD]);
  }
  if (kategori === PERSONEL_MAAS_KOD) {
    const base = OFIS_GIDER_KATEGORI_ETIKET[PERSONEL_MAAS_KOD];
    return ozel ? `${base} · ${ozel}` : base;
  }
  return OFIS_GELIR_KATEGORI_ETIKET[kategori] ?? OFIS_GIDER_KATEGORI_ETIKET[kategori] ?? kategori;
}

type OfisKasaOzetSatir = {
  islem_tipi: string;
  tutar: number;
  tarih: string;
  duzeltme_mi: number;
  onay_durumu: string;
  duzeltme_kasa_etkisi: number | null;
  para_birimi?: string;
};

function ofisKasaSatirKasaEtkisi(x: OfisKasaOzetSatir): number {
  if (x.islem_tipi === "GELIR") return x.tutar;
  if (x.islem_tipi === "GIDER") return -x.tutar;
  if (x.islem_tipi === "DUZELTME") {
    return duzeltmeKasaEtkisiFromRow({
      tutar: x.tutar,
      duzeltmeKasaEtkisi: x.duzeltme_kasa_etkisi,
    });
  }
  if (x.islem_tipi === "DOVIZ_CIKIS") return -x.tutar;
  if (x.islem_tipi === "DOVIZ_GIRIS") return x.tutar;
  return 0;
}

type OfisKasaSatirKatki = { gelir: number; gider: number; duzeltme: number; dovizCikis: number; dovizGiris: number };

function ofisKasaSatirKatki(r: OfisKasaOzetSatir): OfisKasaSatirKatki {
  if (r.islem_tipi === "GELIR" && !r.duzeltme_mi) return { gelir: r.tutar, gider: 0, duzeltme: 0, dovizCikis: 0, dovizGiris: 0 };
  if (r.islem_tipi === "GIDER" && !r.duzeltme_mi) return { gelir: 0, gider: r.tutar, duzeltme: 0, dovizCikis: 0, dovizGiris: 0 };
  if (r.islem_tipi === "DUZELTME" && r.duzeltme_mi) {
    return { gelir: 0, gider: 0, duzeltme: ofisKasaSatirKasaEtkisi(r), dovizCikis: 0, dovizGiris: 0 };
  }
  if (r.islem_tipi === "DOVIZ_CIKIS") return { gelir: 0, gider: 0, duzeltme: 0, dovizCikis: r.tutar, dovizGiris: 0 };
  if (r.islem_tipi === "DOVIZ_GIRIS") return { gelir: 0, gider: 0, duzeltme: 0, dovizCikis: 0, dovizGiris: r.tutar };
  return { gelir: 0, gider: 0, duzeltme: 0, dovizCikis: 0, dovizGiris: 0 };
}

function ofisKasaNetFromKatki(k: OfisKasaSatirKatki): number {
  return k.gelir - k.gider + k.duzeltme - k.dovizCikis + k.dovizGiris;
}

function ofisKasaLifetimeBakiye(rows: OfisKasaOzetSatir[]): number {
  const buckets = emptyCurrencyBuckets();
  for (const r of rows) {
    const pb = tryResolveParaBirimi(r.para_birimi);
    const tutar = r.islem_tipi === "DUZELTME" ? ofisKasaSatirKasaEtkisi(r) : r.tutar;
    applyToCurrencyBucket(buckets, r.islem_tipi, pb, tutar);
  }
  const pb = rows[0] ? tryResolveParaBirimi(rows[0].para_birimi) : "TRY";
  return currencyBucketBalance(buckets[pb]);
}

function ayBasiSonuYmd(d = new Date()): { bas: string; bit: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const bas = `${y}-${pad(m + 1)}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const bit = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
  return { bas, bit };
}

function hesaplaOfisKasaDonemOzet(
  rows: OfisKasaOzetSatir[],
  donemBas: string,
  donemBit: string
): {
  devredenBakiye: number;
  donemGelir: number;
  donemGider: number;
  donemDuzeltmeEtkisi: number;
  kasaBakiyesi: number;
} {
  let devredenGelirK = 0;
  let devredenGiderK = 0;
  let devredenDuzeltmeK = 0;
  let devredenDovizK = 0;
  let donemGelirK = 0;
  let donemGiderK = 0;
  let donemDuzeltmeK = 0;
  let donemDovizK = 0;

  for (const r of rows) {
    const t = String(r.tarih ?? "").slice(0, 10);
    const k = ofisKasaSatirKatki(r);
    if (t < donemBas) {
      devredenGelirK += toKurus(k.gelir);
      devredenGiderK += toKurus(k.gider);
      devredenDuzeltmeK += toKurus(k.duzeltme);
      devredenDovizK += toKurus(-k.dovizCikis + k.dovizGiris);
    } else if (t <= donemBit) {
      donemGelirK += toKurus(k.gelir);
      donemGiderK += toKurus(k.gider);
      donemDuzeltmeK += toKurus(k.duzeltme);
      donemDovizK += toKurus(-k.dovizCikis + k.dovizGiris);
    }
  }

  const devredenBakiye = fromKurus(devredenGelirK - devredenGiderK + devredenDuzeltmeK + devredenDovizK);
  const donemGelir = fromKurus(donemGelirK);
  const donemGider = fromKurus(donemGiderK);
  const donemDuzeltmeEtkisi = fromKurus(donemDuzeltmeK);
  const kasaBakiyesi = fromKurus(
    devredenGelirK - devredenGiderK + devredenDuzeltmeK + devredenDovizK +
      donemGelirK - donemGiderK + donemDuzeltmeK + donemDovizK,
  );

  return {
    devredenBakiye,
    donemGelir,
    donemGider,
    donemDuzeltmeEtkisi,
    kasaBakiyesi,
  };
}

function hesaplaParaBirimiOzetleri(rows: OfisKasaOzetSatir[], bas: string, bit: string) {
  const byCurrency = {} as OfisKasaUstOzet["byCurrency"];
  const bakiyeler = {} as Record<ParaBirimi, number>;
  for (const pb of PARA_BIRIMLERI) {
    const pbRows = rows.filter((r) => tryResolveParaBirimi(r.para_birimi) === pb);
    const o = hesaplaOfisKasaDonemOzet(pbRows, bas, bit);
    byCurrency[pb] = {
      ...o,
      donemNetSonucu: roundMoney(o.kasaBakiyesi - o.devredenBakiye),
    };
    bakiyeler[pb] = ofisKasaLifetimeBakiye(pbRows);
  }
  return { byCurrency, bakiyeler };
}

function ofisKasaOzetSatirlari(d: ReturnType<typeof getDb>): OfisKasaOzetSatir[] {
  return d
    .prepare(
      `SELECT islem_tipi, tutar, tarih, duzeltme_mi, onay_durumu, duzeltme_kasa_etkisi,
              COALESCE(para_birimi, 'TRY') AS para_birimi
       FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ', 'ONAYLI') ${OFIS_KASA_AKTIF_SQL}`
    )
    .all() as OfisKasaOzetSatir[];
}

function allocateDztBelgeNo(d: ReturnType<typeof getDb>): string {
  const grup = "DZT";
  const yil = new Date().getFullYear();
  const row = d.prepare(`SELECT son_sira FROM belge_no_sayac WHERE yil = ? AND grup = ?`).get(yil, grup) as
    | { son_sira: number }
    | undefined;
  const next = (row?.son_sira ?? 0) + 1;
  if (row) {
    d.prepare(`UPDATE belge_no_sayac SET son_sira = ? WHERE yil = ? AND grup = ?`).run(next, yil, grup);
  } else {
    d.prepare(`INSERT INTO belge_no_sayac (yil, grup, son_sira) VALUES (?,?,?)`).run(yil, grup, next);
  }
  return `${grup}-${yil}-${String(next).padStart(6, "0")}`;
}

function bugunYerelIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowOfisKasaHareket(r: Record<string, unknown>): OfisKasaHareket {
  return {
    id: Number(r.id),
    islemTipi: r.islem_tipi as OfisKasaHareket["islemTipi"],
    tarih: String(r.tarih ?? ""),
    kategori: String(r.kategori ?? ""),
    ozelKategoriAdi: r.ozel_kategori_adi == null ? null : String(r.ozel_kategori_adi),
    kalemId: r.kalem_id == null ? null : Number(r.kalem_id),
    muvekkilId: r.muvekkil_id == null ? null : Number(r.muvekkil_id),
    muvekkilAdiSnapshot: r.muvekkil_adi_snapshot == null ? null : String(r.muvekkil_adi_snapshot),
    tahsilatiYapanKullaniciId:
      r.tahsilati_yapan_kullanici_id == null ? null : Number(r.tahsilati_yapan_kullanici_id),
    tahsilatiYapanKullaniciAdi:
      r.tahsilati_yapan_kullanici_adi == null ? null : String(r.tahsilati_yapan_kullanici_adi),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    tutar: Number(r.tutar ?? 0),
    paraBirimi: tryResolveParaBirimi(r.para_birimi),
    dovizDonusumId: r.doviz_donusum_id == null ? null : String(r.doviz_donusum_id),
    kur: r.kur == null ? null : Number(r.kur),
    kurBazParaBirimi: r.kur_baz_para_birimi == null ? null : tryResolveParaBirimi(r.kur_baz_para_birimi),
    kurKarsiParaBirimi: r.kur_karsi_para_birimi == null ? null : tryResolveParaBirimi(r.kur_karsi_para_birimi),
    kurKaynagi: r.kur_kaynagi === "TCMB" || r.kur_kaynagi === "MANUEL" ? r.kur_kaynagi : null,
    tcmbKurTarihi: r.tcmb_kur_tarihi == null ? null : String(r.tcmb_kur_tarihi),
    tcmbReferansKur: r.tcmb_referans_kur == null ? null : Number(r.tcmb_referans_kur),
    odemeYontemi: String(r.odeme_yontemi ?? ""),
    belgeNo: r.belge_no == null ? null : String(r.belge_no),
    not: r.not_metni == null ? null : String(r.not_metni),
    onayDurumu: (r.onay_durumu as OfisKasaHareket["onayDurumu"]) ?? "ONAYSIZ",
    duzeltmeMi: Boolean(r.duzeltme_mi),
    orijinalHareketId: r.orijinal_hareket_id == null ? null : Number(r.orijinal_hareket_id),
    otomatikOnayMi: Boolean(r.otomatik_onay_mi ?? 0),
    onayTarihi: r.onay_tarihi == null ? null : String(r.onay_tarihi),
    olusturmaTarihi: String(r.olusturma_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    onaylayanKullaniciId: r.onaylayan_kullanici_id == null ? null : Number(r.onaylayan_kullanici_id),
    onaylayanKullaniciAdi: r.onaylayan_kullanici_adi == null ? null : String(r.onaylayan_kullanici_adi),
    duzeltmeYonu:
      r.duzeltme_yonu === "ARTIR" || r.duzeltme_yonu === "AZALT"
        ? r.duzeltme_yonu
        : null,
    duzeltmeOrijinalTutar: r.duzeltme_orijinal_tutar == null ? null : Number(r.duzeltme_orijinal_tutar),
    duzeltmeDogruTutar: r.duzeltme_dogru_tutar == null ? null : Number(r.duzeltme_dogru_tutar),
    duzeltmeFarkTutar: r.duzeltme_fark_tutar == null ? null : Number(r.duzeltme_fark_tutar),
    duzeltmeKasaEtkisi: r.duzeltme_kasa_etkisi == null ? null : Number(r.duzeltme_kasa_etkisi),
    duzeltmeRefTipi:
      r.duzeltme_ref_tipi === "GELIR" || r.duzeltme_ref_tipi === "GIDER" ? r.duzeltme_ref_tipi : null,
    kaynakTipi: r.kaynak_tipi == null ? null : String(r.kaynak_tipi),
    kaynakId: r.kaynak_id == null ? null : Number(r.kaynak_id),
  };
}

export function approveAllPendingOfisKasaOnExit(): { approved: number } {
  const d = getDb();
  const t = nowIso();
  const r = d
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 1,
       onaylayan_kullanici_id = NULL, onaylayan_kullanici_adi = 'Otomatik (kapanış)', guncelleme_tarihi = ?
       WHERE onay_durumu = 'ONAYSIZ' ${OFIS_KASA_AKTIF_SQL}`
    )
    .run(t, t);
  return { approved: Number(r.changes ?? 0) };
}

function ofisKasaHareketSilinmisMi(id: number): boolean {
  const r = getDb()
    .prepare(`SELECT silinme_tarihi FROM ofis_kasa_hareketleri WHERE id = ?`)
    .get(id) as { silinme_tarihi: string | null } | undefined;
  return Boolean(r?.silinme_tarihi);
}

export function ofisKasaHareketList(f: OfisKasaListFilter = {}): OfisKasaHareketListeSatir[] {
  const d = getDb();
  const tb = (f.tarihBas ?? "").trim().slice(0, 10);
  const te = (f.tarihBit ?? "").trim().slice(0, 10);
  const q = (f.q ?? "").trim();
  const kat = (f.kategori ?? "").trim();
  const conds = [`tarih >= ?`, `tarih <= ?`, `silinme_tarihi IS NULL`];
  const params: unknown[] = [tb, te];
  if (f.islemTipi === "GELIR") {
    conds.push(`islem_tipi = 'GELIR'`);
  } else if (f.islemTipi === "GIDER") {
    conds.push(`islem_tipi = 'GIDER'`);
  } else if (f.islemTipi === "DUZELTME") {
    conds.push(`islem_tipi = 'DUZELTME'`);
  } else if (f.islemTipi === "DOVIZ_CIKIS" || f.islemTipi === "DOVIZ_GIRIS") {
    conds.push(`islem_tipi = ?`);
    params.push(f.islemTipi);
  }
  if (f.paraBirimi?.trim()) {
    conds.push(`COALESCE(para_birimi, 'TRY') = ?`);
    params.push(resolveParaBirimi(f.paraBirimi));
  }
  if (kat) {
    conds.push(`kategori = ?`);
    params.push(kat);
  }
  if (f.muvekkilId != null && Number.isFinite(Number(f.muvekkilId)) && Number(f.muvekkilId) > 0) {
    conds.push(`muvekkil_id = ?`);
    params.push(Number(f.muvekkilId));
  }
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    conds.push(
      `(aciklama LIKE ? ESCAPE '\\' OR belge_no LIKE ? ESCAPE '\\' OR not_metni LIKE ? ESCAPE '\\' OR ozel_kategori_adi LIKE ? ESCAPE '\\' OR muvekkil_adi_snapshot LIKE ? ESCAPE '\\')`,
    );
    params.push(like, like, like, like, like);
  }
  const sql = `SELECT * FROM ofis_kasa_hareketleri WHERE ${conds.join(" AND ")} ORDER BY tarih DESC, id DESC`;
  const rows = d.prepare(sql).all(...params) as Record<string, unknown>[];
  const correctedIds = new Set(
    (
      d
        .prepare(
          `SELECT DISTINCT orijinal_hareket_id AS x FROM ofis_kasa_hareketleri WHERE islem_tipi = 'DUZELTME' AND duzeltme_mi = 1 AND orijinal_hareket_id IS NOT NULL ${OFIS_KASA_AKTIF_SQL}`
        )
        .all() as { x: number }[]
    ).map((r) => r.x)
  );
  return rows.map((raw) => {
    const h = rowOfisKasaHareket(raw);
    const hasCorrection = correctedIds.has(h.id) && h.islemTipi !== "DUZELTME";
    if (h.islemTipi === "DUZELTME" && !h.duzeltmeRefTipi && h.orijinalHareketId != null) {
      const origRaw = rows.find((r) => Number(r.id) === h.orijinalHareketId);
      if (origRaw) {
        const orig = rowOfisKasaHareket(origRaw);
        if (orig.islemTipi === "GELIR" || orig.islemTipi === "GIDER") {
          return { ...h, duzeltmeRefTipi: orig.islemTipi, hasCorrection };
        }
      }
    }
    return { ...h, hasCorrection };
  });
}

export function ofisKasaUstOzet(opts?: { referenceDate?: string }): OfisKasaUstOzet {
  const d = getDb();
  const rows = ofisKasaOzetSatirlari(d);
  const mode = getAccountingPeriodMode();
  const period = getAccountingPeriod(mode, opts?.referenceDate ?? toLocalYmd());
  const { byCurrency, bakiyeler } = hesaplaParaBirimiOzetleri(rows, period.bas, period.bit);
  const donem = byCurrency.TRY;
  const donemNetSonucu = donem.donemNetSonucu;
  return {
    mode,
    period,
    devredenBakiye: donem.devredenBakiye,
    buAyGelir: donem.donemGelir,
    buAyGider: donem.donemGider,
    buAyDuzeltmeEtkisi: donem.donemDuzeltmeEtkisi,
    donemGelir: donem.donemGelir,
    donemGider: donem.donemGider,
    donemDuzeltmeEtkisi: donem.donemDuzeltmeEtkisi,
    donemNetSonucu,
    kasaBakiyesi: bakiyeler.TRY,
    bakiyeler,
    byCurrency,
  };
}

export function ofisKasaAnaSayfaOzet(opts?: { referenceDate?: string }): OfisKasaAnaSayfaOzet {
  const mode = getAccountingPeriodMode();
  const ref = opts?.referenceDate ?? toLocalYmd();
  const period = getAccountingPeriod(mode, ref);
  const ust = ofisKasaUstOzet({ referenceDate: period.bas });
  const d = getDb();
  const bugun = toLocalYmd();
  const rows = ofisKasaOzetSatirlari(d);
  const bugunGider = { TRY: 0, USD: 0, EUR: 0 } as Record<ParaBirimi, number>;
  for (const r of rows) {
    const t = String(r.tarih ?? "").slice(0, 10);
    if (r.islem_tipi === "GIDER" && !r.duzeltme_mi && t === bugun) {
      const pb = tryResolveParaBirimi(r.para_birimi);
      bugunGider[pb] += toKurus(r.tutar);
    }
  }
  const byCurrency = { ...ust.byCurrency };
  for (const pb of PARA_BIRIMLERI) byCurrency[pb] = { ...byCurrency[pb], bugunGider: fromKurus(bugunGider[pb]) };
  return {
    mode,
    period,
    isCurrent: isCurrentAccountingPeriod(period),
    canGoNext: canGoToNextAccountingPeriod(period),
    bugunGider: fromKurus(bugunGider.TRY),
    buAyGider: ust.donemGider,
    devredenBakiye: ust.devredenBakiye,
    donemGelir: ust.donemGelir,
    donemGider: ust.donemGider,
    donemDuzeltmeEtkisi: ust.donemDuzeltmeEtkisi,
    donemNetSonucu: ust.donemNetSonucu,
    kasaBakiyesi: ust.kasaBakiyesi,
    bakiyeler: ust.bakiyeler,
    byCurrency,
  };
}

function ofisKasaHareketGet(id: number): OfisKasaHareket | null {
  const r = getDb().prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return r ? rowOfisKasaHareket(r) : null;
}

export function ofisKasaHareketEkle(
  input: OfisKasaEkleInput,
  olusturanKullaniciId: number | null,
  olusturanKullaniciAdi: string | null,
): OfisKasaIslemSonuc {
  const tarih = (input.tarih ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin (YYYY-AA-GG)." };

  let kalemId: number | null = input.kalemId != null ? Number(input.kalemId) : null;
  let kat = (input.kategori ?? "").trim();

  if (kalemId != null && Number.isFinite(kalemId) && kalemId > 0) {
    const resolved = resolveAktifManuelKalem(kalemId, input.islemTipi);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    kat = resolved.kalem.kod?.trim() || resolved.kalem.ad;
    const ozel = (input.ozelKategoriAdi ?? "").trim();
    if (kalemOzelAdGerekli(resolved.kalem) && !ozel) {
      return {
        ok: false,
        error: resolved.kalem.kod === PERSONEL_MAAS_KOD ? "Personel ismi zorunludur." : "Özel kategori adı zorunludur.",
      };
    }
  } else {
    if (input.islemTipi === "GELIR") {
      if (!isGecerliOfisGelirKategori(kat)) return { ok: false, error: "Geçerli gelir kategorisi seçin." };
    } else if (!isGecerliOfisGiderKategori(kat)) {
      return { ok: false, error: "Geçerli gider kategorisi seçin." };
    }
    const byKod = getFinansKalemiByKod(kat);
    if (byKod) kalemId = byKod.id;
    const ozel = (input.ozelKategoriAdi ?? "").trim();
    if (kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD) {
      if (!ozel) return { ok: false, error: "Özel kategori adı zorunludur." };
    }
    if (kat === PERSONEL_MAAS_KOD) {
      if (!ozel) return { ok: false, error: "Personel ismi zorunludur." };
    }
  }

  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalıdır." };
  }
  const od = (input.odemeYontemi ?? "").trim();
  if (!isOfisOdemeYontemiGecerli(od)) return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
  let paraBirimi: ParaBirimi;
  try {
    paraBirimi = resolveParaBirimi(input.paraBirimi);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Geçersiz para birimi." };
  }

  let muvekkilId: number | null = null;
  let muvekkilAdi: string | null = null;
  if (input.muvekkilId != null && Number(input.muvekkilId) > 0) {
    const m = muvekkilGet(Number(input.muvekkilId));
    if (!m || !m.aktifMi) return { ok: false, error: "İlgili müvekkil bulunamadı veya pasif." };
    muvekkilId = m.id;
    muvekkilAdi =
      m.muvekkilTuru === "TUZEL_KISI" && m.sirketUnvani?.trim()
        ? m.sirketUnvani.trim()
        : m.adSoyad.trim() || m.sirketUnvani?.trim() || null;
  }

  let tahsilUserId: number | null = null;
  let tahsilUserAdi: string | null = null;
  if (input.islemTipi === "GELIR" && input.tahsilatiYapanKullaniciId != null && Number(input.tahsilatiYapanKullaniciId) > 0) {
    const u = getDb()
      .prepare(`SELECT id, ad_soyad FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
      .get(Number(input.tahsilatiYapanKullaniciId)) as { id: number; ad_soyad: string } | undefined;
    if (!u) return { ok: false, error: "Tahsilatı yapan kullanıcı bulunamadı." };
    tahsilUserId = u.id;
    tahsilUserAdi = u.ad_soyad;
  }

  const d = getDb();
  const t = nowIso();
  const ozelDb = ofisKategoriOzelAdDb(kat, (input.ozelKategoriAdi ?? "").trim());
  try {
    const rIns = d
      .prepare(
        `INSERT INTO ofis_kasa_hareketleri (
          islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, para_birimi, odeme_yontemi, belge_no, not_metni,
          onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
          olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
          onaylayan_kullanici_id, onaylayan_kullanici_adi,
          kalem_id, muvekkil_id, muvekkil_adi_snapshot, tahsilati_yapan_kullanici_id, tahsilati_yapan_kullanici_adi
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        input.islemTipi,
        tarih,
        kat,
        ozelDb,
        (input.aciklama ?? "").trim() || null,
        input.tutar,
        paraBirimi,
        od,
        (input.belgeNo ?? "").trim() || null,
        (input.not ?? "").trim() || null,
        "ONAYSIZ",
        0,
        null,
        0,
        null,
        t,
        t,
        olusturanKullaniciId,
        olusturanKullaniciAdi,
        null,
        null,
        kalemId,
        muvekkilId,
        muvekkilAdi,
        tahsilUserId,
        tahsilUserAdi,
      );
    const id = Number(rIns.lastInsertRowid);
    const row = ofisKasaHareketGet(id);
    return row ? { ok: true, row } : { ok: false, error: "Kayıt oluşturulamadı." };
  } catch (e) {
    console.error("[ofisKasaHareketEkle]", e);
    return { ok: false, error: "Kayıt oluşturulamadı." };
  }
}

type VekaletTahsilatOfisKasaInput = {
  vekaletOdemeId: number;
  tutar: number;
  paraBirimi?: ParaBirimi;
  tarih: string;
  odemeYontemi: string;
  aciklama: string;
  not?: string | null;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  t: string;
};

/** Vekalet taksit ödemesi için Ofis Kasası gelir kaydı — aynı ödeme için tek kayıt (idempotent). */
export function ofisKasaVekaletTahsilatEkleInTx(
  d: ReturnType<typeof getDb>,
  input: VekaletTahsilatOfisKasaInput
): number {
  const existing = d
    .prepare(`SELECT id FROM ofis_kasa_hareketleri WHERE kaynak_tipi = ? AND kaynak_id = ? ${OFIS_KASA_AKTIF_SQL}`)
    .get(OFIS_KASA_KAYNAK_VEKALET_TAHSILATI, input.vekaletOdemeId) as { id: number } | undefined;
  if (existing) return existing.id;

  const rIns = d
    .prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, para_birimi, odeme_yontemi, belge_no, not_metni,
        onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
        olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
        onaylayan_kullanici_id, onaylayan_kullanici_adi, kaynak_tipi, kaynak_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      "GELIR",
      input.tarih,
      "VEKALET_TAHSILATI",
      null,
      input.aciklama,
      input.tutar,
      resolveParaBirimi(input.paraBirimi),
      input.odemeYontemi,
      null,
      (input.not ?? "").trim() || null,
      "ONAYSIZ",
      0,
      null,
      0,
      null,
      input.t,
      input.t,
      input.olusturanKullaniciId,
      input.olusturanKullaniciAdi,
      null,
      null,
      OFIS_KASA_KAYNAK_VEKALET_TAHSILATI,
      input.vekaletOdemeId
    );
  return Number(rIns.lastInsertRowid);
}

type IcraTahsilatOfisKasaInput = {
  icraOdemeId: number;
  tutar: number;
  paraBirimi?: ParaBirimi;
  tarih: string;
  odemeYontemi: string;
  kategori: string;
  aciklama: string;
  not?: string | null;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  t: string;
};

/** İcra tahsilat ödemesi için Ofis Kasası gelir kaydı — aynı ödeme için tek kayıt (idempotent). */
export function ofisKasaIcraTahsilatEkleInTx(
  d: ReturnType<typeof getDb>,
  input: IcraTahsilatOfisKasaInput,
): number {
  const existing = d
    .prepare(`SELECT id FROM ofis_kasa_hareketleri WHERE kaynak_tipi = ? AND kaynak_id = ? ${OFIS_KASA_AKTIF_SQL}`)
    .get(OFIS_KASA_KAYNAK_ICRA_TAHSILAT, input.icraOdemeId) as { id: number } | undefined;
  if (existing) return existing.id;

  const rIns = d
    .prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, para_birimi, odeme_yontemi, belge_no, not_metni,
        onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
        olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
        onaylayan_kullanici_id, onaylayan_kullanici_adi, kaynak_tipi, kaynak_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      "GELIR",
      input.tarih,
      input.kategori,
      null,
      input.aciklama,
      input.tutar,
      resolveParaBirimi(input.paraBirimi),
      input.odemeYontemi,
      null,
      (input.not ?? "").trim() || null,
      "ONAYSIZ",
      0,
      null,
      0,
      null,
      input.t,
      input.t,
      input.olusturanKullaniciId,
      input.olusturanKullaniciAdi,
      null,
      null,
      OFIS_KASA_KAYNAK_ICRA_TAHSILAT,
      input.icraOdemeId,
    );
  return Number(rIns.lastInsertRowid);
}

export function ofisKasaHareketGuncelle(id: number, patch: OfisKasaGuncellePatch): OfisKasaIslemSonuc {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (ofisKasaHareketSilinmisMi(id)) return { ok: false, error: "Silinmiş işlem üzerinde işlem yapılamaz" };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Onaylı işlem düzenlenemez." };
  if (cur.islemTipi === "DUZELTME") return { ok: false, error: "Düzeltme kaydı düzenlenemez." };
  const d = getDb();
  let kat = cur.kategori;
  if (patch.kategori !== undefined) kat = patch.kategori.trim();
  const tip = cur.islemTipi;
  if (patch.kategori !== undefined || patch.tutar !== undefined || patch.ozelKategoriAdi !== undefined) {
    if (tip === "GELIR" && !isGecerliOfisGelirKategori(kat)) {
      return { ok: false, error: "Geçerli gelir kategorisi seçin." };
    }
    if (tip === "GIDER" && !isGecerliOfisGiderKategori(kat)) {
      return { ok: false, error: "Geçerli gider kategorisi seçin." };
    }
  }
  const ozelRaw = patch.ozelKategoriAdi !== undefined ? patch.ozelKategoriAdi : cur.ozelKategoriAdi;
  const ozel = (ozelRaw ?? "").trim();
  if (kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD) {
    if (!ozel) return { ok: false, error: "Özel kategori adı zorunludur." };
  }
  if (kat === PERSONEL_MAAS_KOD) {
    if (!ozel) return { ok: false, error: "Personel ismi zorunludur." };
  }
  if (patch.tutar !== undefined && (!Number.isFinite(patch.tutar) || patch.tutar <= 0)) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalıdır." };
  }
  if (patch.odemeYontemi !== undefined && !isOfisOdemeYontemiGecerli(patch.odemeYontemi.trim())) {
    return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
  }
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.tarih !== undefined) {
    const tarih = patch.tarih.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin." };
    fields.push("tarih = ?");
    vals.push(tarih);
  }
  if (patch.kategori !== undefined) {
    fields.push("kategori = ?");
    vals.push(kat);
  }
  if (patch.ozelKategoriAdi !== undefined) {
    fields.push("ozel_kategori_adi = ?");
    vals.push(ofisKategoriOzelAdDb(kat, ozel));
  }
  if (patch.aciklama !== undefined) {
    fields.push("aciklama = ?");
    vals.push((patch.aciklama ?? "").trim() || null);
  }
  if (patch.tutar !== undefined) {
    fields.push("tutar = ?");
    vals.push(patch.tutar);
  }
  if (patch.odemeYontemi !== undefined) {
    fields.push("odeme_yontemi = ?");
    vals.push(patch.odemeYontemi.trim());
  }
  if (patch.belgeNo !== undefined) {
    fields.push("belge_no = ?");
    vals.push((patch.belgeNo ?? "").trim() || null);
  }
  if (patch.not !== undefined) {
    fields.push("not_metni = ?");
    vals.push((patch.not ?? "").trim() || null);
  }
  if (patch.kalemId !== undefined) {
    if (patch.kalemId != null && Number(patch.kalemId) > 0) {
      const tipKalem = tip === "GELIR" || tip === "GIDER" ? tip : null;
      if (!tipKalem) return { ok: false, error: "Bu kayıt tipi için kalem güncellenemez." };
      const resolved = resolveAktifManuelKalem(Number(patch.kalemId), tipKalem);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      kat = resolved.kalem.kod?.trim() || resolved.kalem.ad;
      fields.push("kalem_id = ?");
      vals.push(resolved.kalem.id);
      fields.push("kategori = ?");
      vals.push(kat);
    } else {
      fields.push("kalem_id = ?");
      vals.push(null);
    }
  }
  if (patch.muvekkilId !== undefined) {
    if (patch.muvekkilId != null && Number(patch.muvekkilId) > 0) {
      const m = muvekkilGet(Number(patch.muvekkilId));
      if (!m || !m.aktifMi) return { ok: false, error: "İlgili müvekkil bulunamadı veya pasif." };
      const adi =
        m.muvekkilTuru === "TUZEL_KISI" && m.sirketUnvani?.trim()
          ? m.sirketUnvani.trim()
          : m.adSoyad.trim() || m.sirketUnvani?.trim() || null;
      fields.push("muvekkil_id = ?");
      vals.push(m.id);
      fields.push("muvekkil_adi_snapshot = ?");
      vals.push(adi);
    } else {
      fields.push("muvekkil_id = ?");
      vals.push(null);
      fields.push("muvekkil_adi_snapshot = ?");
      vals.push(null);
    }
  }
  if (patch.tahsilatiYapanKullaniciId !== undefined) {
    if (tip !== "GELIR") {
      fields.push("tahsilati_yapan_kullanici_id = ?");
      vals.push(null);
      fields.push("tahsilati_yapan_kullanici_adi = ?");
      vals.push(null);
    } else if (patch.tahsilatiYapanKullaniciId != null && Number(patch.tahsilatiYapanKullaniciId) > 0) {
      const u = d
        .prepare(`SELECT id, ad_soyad FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
        .get(Number(patch.tahsilatiYapanKullaniciId)) as { id: number; ad_soyad: string } | undefined;
      if (!u) return { ok: false, error: "Tahsilatı yapan kullanıcı bulunamadı." };
      fields.push("tahsilati_yapan_kullanici_id = ?");
      vals.push(u.id);
      fields.push("tahsilati_yapan_kullanici_adi = ?");
      vals.push(u.ad_soyad);
    } else {
      fields.push("tahsilati_yapan_kullanici_id = ?");
      vals.push(null);
      fields.push("tahsilati_yapan_kullanici_adi = ?");
      vals.push(null);
    }
  }
  if (fields.length === 0) return { ok: true, row: cur };
  const t = nowIso();
  fields.push("guncelleme_tarihi = ?");
  vals.push(t);
  vals.push(id);
  d.prepare(`UPDATE ofis_kasa_hareketleri SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const row = ofisKasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı." };
}

export function ofisKasaHareketSil(id: number): { ok: true } | { ok: false; error: string } {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (ofisKasaHareketSilinmisMi(id)) return { ok: false, error: "İşlem bulunamadı." };
  if (cur.onayDurumu === "ONAYLI") {
    return { ok: false, error: "Onaylı işlem için güvenli sil kullanın." };
  }
  getDb().prepare(`DELETE FROM ofis_kasa_hareketleri WHERE id = ?`).run(id);
  return { ok: true };
}

export function ofisKasaHareketOnayla(
  id: number,
  onaylayanKullaniciId: number | null,
  onaylayanKullaniciAdi: string | null
): OfisKasaIslemSonuc {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (ofisKasaHareketSilinmisMi(id)) return { ok: false, error: "Silinmiş işlem üzerinde işlem yapılamaz" };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Zaten onaylı." };
  const t = nowIso();
  getDb()
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 0,
       onaylayan_kullanici_id = ?, onaylayan_kullanici_adi = ?, guncelleme_tarihi = ? WHERE id = ?`
    )
    .run(t, onaylayanKullaniciId, onaylayanKullaniciAdi, t, id);
  const row = ofisKasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı." };
}

export function ofisKasaDuzeltmeEkle(
  input: OfisKasaDuzeltmeInput,
  olusturanKullaniciId: number | null,
  olusturanKullaniciAdi: string | null
): OfisKasaIslemSonuc {
  const ref = ofisKasaHareketGet(input.orijinalHareketId);
  if (!ref) return { ok: false, error: "Düzeltilen işlem bulunamadı." };
  if (ofisKasaHareketSilinmisMi(input.orijinalHareketId)) {
    return { ok: false, error: "Silinmiş işlem üzerinde düzeltme yapılamaz." };
  }
  if (ref.onayDurumu !== "ONAYLI") {
    return { ok: false, error: "Düzeltme yalnızca onaylı işlemler için kaydedilebilir." };
  }
  if (ref.islemTipi === "DUZELTME") {
    return { ok: false, error: "Düzeltme kaydı üzerinden yeni düzeltme açılamaz." };
  }
  if (ref.islemTipi !== "GELIR" && ref.islemTipi !== "GIDER") {
    return { ok: false, error: "Geçersiz işlem tipi." };
  }
  const d = getDb();
  const mevcutDuz = d
    .prepare(
      `SELECT 1 AS x FROM ofis_kasa_hareketleri WHERE islem_tipi = 'DUZELTME' AND duzeltme_mi = 1 AND orijinal_hareket_id = ? ${OFIS_KASA_AKTIF_SQL}`
    )
    .get(input.orijinalHareketId);
  if (mevcutDuz) {
    return { ok: false, error: "Bu kayıt için zaten düzeltme yapılmış." };
  }
  const hesap = hesaplaOfisKasaDuzeltme(ref.islemTipi, ref.tutar, input.dogruTutar);
  if (!hesap.ok) return { ok: false, error: hesap.error };
  const tarih = (input.tarih ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin." };
  const refTipLabel = ref.islemTipi === "GELIR" ? "Gelir" : "Gider";
  const katEtiket = kategoriEtiketi(ref.kategori, ref.ozelKategoriAdi);
  const notMetni = (input.not ?? "").trim();
  const aciklama =
    notMetni ||
    `${formatDateTrSimple(ref.tarih)} tarihli ${refTipLabel} / ${katEtiket} / ${formatTrySimple(ref.tutar)} kaydı için düzeltme`;
  const t = nowIso();
  try {
    const belgeNo = allocateDztBelgeNo(d);
    const rIns = d
      .prepare(
        `INSERT INTO ofis_kasa_hareketleri (
          islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, para_birimi, odeme_yontemi, belge_no, not_metni,
          onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
          olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
          onaylayan_kullanici_id, onaylayan_kullanici_adi,
          duzeltme_yonu, duzeltme_orijinal_tutar, duzeltme_dogru_tutar, duzeltme_fark_tutar, duzeltme_kasa_etkisi,
          duzeltme_ref_tipi
        ) VALUES ('DUZELTME',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        tarih,
        ref.kategori,
        ref.ozelKategoriAdi,
        aciklama,
        hesap.kasaEtkisi,
        ref.paraBirimi,
        ref.odemeYontemi,
        belgeNo,
        notMetni || null,
        "ONAYSIZ",
        1,
        input.orijinalHareketId,
        0,
        null,
        t,
        t,
        olusturanKullaniciId,
        olusturanKullaniciAdi,
        null,
        null,
        hesap.yon,
        ref.tutar,
        input.dogruTutar,
        hesap.farkTutar,
        hesap.kasaEtkisi,
        ref.islemTipi
      );
    const id = Number(rIns.lastInsertRowid);
    const row = ofisKasaHareketGet(id);
    return row ? { ok: true, row } : { ok: false, error: "Düzeltme kaydı oluşturulamadı." };
  } catch (e) {
    console.error("[ofisKasaDuzeltmeEkle]", e);
    return { ok: false, error: "Düzeltme kaydı oluşturulamadı." };
  }
}

export async function ofisKasaDovizDonusum(
  input: OfisKasaDovizDonusumInput,
  olusturanKullaniciId: number | null,
  olusturanKullaniciAdi: string | null,
): Promise<
  | { ok: true; cikis: OfisKasaHareket; giris: OfisKasaHareket }
  | { ok: false; error: string }
> {
  const tarih = (input.tarih ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin." };
  try {
    const x = resolveDovizDonusum(input);
    const odemeYontemi = (input.odemeYontemi ?? "BANKA").trim();
    if (!isOfisOdemeYontemiGecerli(odemeYontemi)) {
      return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
    }
    let kurKaynagi = input.kurKaynagi ?? "MANUEL";
    let tcmbKurTarihi = input.tcmbKurTarihi ?? null;
    let tcmbReferansKur = input.tcmbReferansKur ?? null;
    if (kurKaynagi === "TCMB" && tcmbReferansKur == null) {
      try {
        const quote = await getTcmbPairRate(x.kaynakParaBirimi, x.hedefParaBirimi, { date: tarih });
        if (quote) {
          tcmbKurTarihi = quote.bulunanTcmbKurTarihi;
          tcmbReferansKur = Number(quote.dovizAlis);
        } else {
          kurKaynagi = "MANUEL";
        }
      } catch {
        kurKaynagi = "MANUEL";
      }
    }
    const d = getDb();
    const donusumId = randomUUID();
    const t = nowIso();
    const aciklama = (input.aciklama ?? "").trim() || formatKurOzeti(x.kaynakParaBirimi, x.hedefParaBirimi, x.kur);
    const insertSql = `INSERT INTO ofis_kasa_hareketleri (
      islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, para_birimi, odeme_yontemi,
      belge_no, not_metni, onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi,
      onay_tarihi, olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
      onaylayan_kullanici_id, onaylayan_kullanici_adi, doviz_donusum_id, kur, kur_baz_para_birimi,
      kur_karsi_para_birimi, kur_kaynagi, tcmb_kur_tarihi, tcmb_referans_kur
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const ids = d.transaction(() => {
      const common = [
        tarih, "DOVIZ_DONUSUM", null, aciklama, odemeYontemi, null, null, "ONAYSIZ", 0, null, 0,
        null, t, t, olusturanKullaniciId, olusturanKullaniciAdi, null, null, donusumId, x.kur,
        x.kaynakParaBirimi, x.hedefParaBirimi, kurKaynagi, tcmbKurTarihi, tcmbReferansKur,
      ];
      const cikis = d.prepare(insertSql).run(
        "DOVIZ_CIKIS", ...common.slice(0, 4), x.kaynakTutar, x.kaynakParaBirimi, ...common.slice(4),
      );
      const giris = d.prepare(insertSql).run(
        "DOVIZ_GIRIS", ...common.slice(0, 4), x.hedefTutar, x.hedefParaBirimi, ...common.slice(4),
      );
      return { cikisId: Number(cikis.lastInsertRowid), girisId: Number(giris.lastInsertRowid) };
    })();
    const cikis = ofisKasaHareketGet(ids.cikisId);
    const giris = ofisKasaHareketGet(ids.girisId);
    return cikis && giris ? { ok: true, cikis, giris } : { ok: false, error: "Döviz dönüşümü oluşturulamadı." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Döviz dönüşümü oluşturulamadı." };
  }
}

export function ofisKasaDovizDonusumSil(dovizDonusumId: string): { ok: true } | { ok: false; error: string } {
  const id = dovizDonusumId.trim();
  if (!id) return { ok: false, error: "Döviz dönüşümü bulunamadı." };
  const d = getDb();
  const approved = d.prepare(
    `SELECT 1 AS x FROM ofis_kasa_hareketleri WHERE doviz_donusum_id = ? AND onay_durumu = 'ONAYLI' LIMIT 1`,
  ).get(id);
  if (approved) return { ok: false, error: "Onaylı döviz dönüşümü silinemez." };
  d.prepare(`DELETE FROM ofis_kasa_hareketleri WHERE doviz_donusum_id = ?`).run(id);
  return { ok: true };
}

export function getOfisKasaRaporPaketi(tarihBas: string, tarihBit: string): OfisKasaRaporPaketi {
  const tb = (tarihBas ?? "").trim().slice(0, 10);
  const te = (tarihBit ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tb) || !/^\d{4}-\d{2}-\d{2}$/.test(te)) {
    return { ok: false, mesaj: "Geçersiz tarih aralığı." };
  }
  const office = officeSettingsGetForMakbuz();
  const liste = ofisKasaHareketList({ tarihBas: tb, tarihBit: te, islemTipi: "TUMU", kategori: "", q: "" });
  const d = getDb();
  const rows = ofisKasaOzetSatirlari(d);
  const { byCurrency, bakiyeler } = hesaplaParaBirimiOzetleri(rows, tb, te);
  const ozet = byCurrency.TRY;
  return {
    ok: true,
    tarihBas: tb,
    tarihBit: te,
    yazdirmaTarihi: nowIso(),
    office,
    devredenBakiye: ozet.devredenBakiye,
    donemGelir: ozet.donemGelir,
    donemGider: ozet.donemGider,
    donemDuzeltmeEtkisi: ozet.donemDuzeltmeEtkisi,
    kasaBakiyesi: ozet.kasaBakiyesi,
    bakiyeler,
    byCurrency,
    hareketler: liste,
  };
}
