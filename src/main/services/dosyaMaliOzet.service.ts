import { getAccountingPeriod, toLocalYmd } from "@shared/lib/accountingPeriod";
import { moneyToFixed2 } from "@shared/lib/paraBirimi";
import { filterAktifTahsilatOdemeleri } from "@shared/lib/tahsilatOdemeAktif";
import type { DosyaMaliOzetPayload, DosyaMaliOzetResponse, DosyaMaliOzetSonuc } from "@shared/types/dosyaMaliOzet";
import { getDb } from "../db/connection";
import { getAccountingPeriodMode } from "./appSettings.service";
import { dosyaGet } from "./dosya.service";
import { KASA_AKTIF_SQL } from "./kasaAktifSql";
import { DOSYA_KASA_VEKALET_HARIC_SQL } from "./kasa.service";

function fmt(n: number): string {
  return moneyToFixed2(n);
}

function roundRatio(n: number): number {
  return Math.round(n * 100) / 100;
}

type PeriodRange = { bas: string; bit: string };

function inPeriod(ymd: string, period?: PeriodRange): boolean {
  const t = ymd.slice(0, 10);
  if (!period) return true;
  return t >= period.bas && t <= period.bit;
}

function computeForDosya(dosyaId: number, period?: PeriodRange): DosyaMaliOzetPayload {
  const d = getDb();

  const vekalet = period
    ? null
    : (d
        .prepare(`SELECT anlasilan_tutar FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`)
        .get(dosyaId) as { anlasilan_tutar: number } | undefined);

  const odemeRows = d
    .prepare(
      `SELECT o.tutar, o.odeme_tarihi, o.ofis_kasa_hareket_id, ok.silinme_tarihi AS ofis_silinme_tarihi
       FROM vekalet_taksit_odeme o
       LEFT JOIN ofis_kasa_hareketleri ok ON ok.id = o.ofis_kasa_hareket_id
       WHERE o.dosya_id = ?`,
    )
    .all(dosyaId) as {
    tutar: number;
    odeme_tarihi: string;
    ofis_kasa_hareket_id: number | null;
    ofis_silinme_tarihi: string | null;
  }[];

  const aktifOdemeler = filterAktifTahsilatOdemeleri(
    odemeRows.map((o) => ({
      ...o,
      ofisKasaHareketId: o.ofis_kasa_hareket_id,
      ofisSilinmeTarihi: o.ofis_silinme_tarihi,
    })),
  ).filter((o) => inPeriod(String(o.odeme_tarihi), period));

  let tahsilEdilen = 0;
  for (const o of aktifOdemeler) tahsilEdilen += Number(o.tutar ?? 0);

  const kararlastirilan = period ? 0 : Number(vekalet?.anlasilan_tutar ?? 0);
  const kalan = Math.max(0, kararlastirilan - tahsilEdilen);
  const tahsilatOrani = kararlastirilan > 0 ? roundRatio((tahsilEdilen / kararlastirilan) * 100) : 0;

  const kasaRows = d
    .prepare(
      `SELECT islem_tipi, tutar, tarih FROM dosya_kasa_hareket
       WHERE dosya_id = ? AND onay_durumu = 'ONAYLI' ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}`,
    )
    .all(dosyaId) as { islem_tipi: string; tutar: number; tarih: string }[];

  let avans = 0;
  let masraf = 0;
  let duzeltmeTotal = 0;
  let masrafAvansiIadesi = 0;

  for (const r of kasaRows) {
    if (!inPeriod(String(r.tarih), period)) continue;
    const v = Number(r.tutar);
    if (r.islem_tipi === "AVANS_GIRISI") avans += v;
    else if (r.islem_tipi === "MASRAF") masraf += v;
    else if (r.islem_tipi === "DUZELTME") {
      duzeltmeTotal += v;
      if (v < 0) masrafAvansiIadesi += Math.abs(v);
    }
  }

  const kasaBakiye = avans - masraf + duzeltmeTotal;
  const buroKarsiladi = kasaBakiye < 0 ? Math.abs(kasaBakiye) : 0;
  const netKazanc = tahsilEdilen - buroKarsiladi;

  return {
    kararlastirilanVekalet: fmt(kararlastirilan),
    tahsilEdilenVekalet: fmt(tahsilEdilen),
    kalanVekalet: fmt(kalan),
    tahsilatOrani,
    alinanMasrafAvansi: fmt(avans),
    toplamMasraf: fmt(masraf),
    duzeltmeEtkisi: fmt(duzeltmeTotal),
    masrafAvansiIadesi: fmt(masrafAvansiIadesi),
    kalanMasrafAvansi: fmt(Math.max(0, kasaBakiye)),
    buroKarsiladigiGider: fmt(buroKarsiladi),
    netKazanc: fmt(netKazanc),
  };
}

export function getDosyaMaliOzet(dosyaId: number): DosyaMaliOzetSonuc {
  const dosya = dosyaGet(dosyaId);
  if (!dosya) {
    return { ok: false, error: "DOSYA_YOK", mesaj: "Dosya bulunamadı." };
  }

  const mode = getAccountingPeriodMode();
  const period = getAccountingPeriod(mode, toLocalYmd());
  const range: PeriodRange = { bas: period.bas, bit: period.bit };

  const tumZamanlar = computeForDosya(dosyaId);
  const buDonem = computeForDosya(dosyaId, range);

  const data: DosyaMaliOzetResponse = {
    tumZamanlar,
    buDonem,
    donemEtiketi: period.etiket,
  };

  return { ok: true, data };
}
