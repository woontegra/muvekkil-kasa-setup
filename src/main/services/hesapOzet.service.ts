import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import { getDb } from "../db/connection";
import { dosyaGet } from "./dosya.service";
import { hesaplaAvansBakiye, kasaHareketList, DOSYA_KASA_VEKALET_HARIC_SQL } from "./kasa.service";
import { KASA_AKTIF_SQL } from "./kasaAktifSql";
import { muvekkilGet } from "./muvekkil.service";
import { officeSettingsGet } from "./office.service";
import { vekaletGetOrCreate, vekaletTaksitList } from "./vekalet.service";

function bugunYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function vekaletOzetFromTaksitler(
  anlasilanTutar: number,
  paraBirimi: import("@shared/lib/paraBirimi").ParaBirimi,
  taksitler: { odenenToplam: number }[],
) {
  const odenenToplam = taksitler.reduce((s, t) => s + t.odenenToplam, 0);
  return {
    paraBirimi,
    anlasilanTutar,
    odenenToplam,
    kalanVekalet: Math.max(0, anlasilanTutar - odenenToplam),
  };
}

export function dosyaHesapOzetPaketiGetir(dosyaId: number): DosyaHesapOzetPaketi {
  const dosya = dosyaGet(dosyaId);
  if (!dosya) {
    return { ok: false, error: "DOSYA_YOK", mesaj: "Dosya bulunamadı." };
  }

  const muvekkil = muvekkilGet(dosya.muvekkilId);
  if (!muvekkil) {
    return { ok: false, error: "MUVEKKIL_YOK", mesaj: "Müvekkil bulunamadı." };
  }

  const ozet = hesaplaAvansBakiye(dosyaId);
  const rows = getDb()
    .prepare(
      `SELECT islem_tipi, tutar FROM dosya_kasa_hareket WHERE dosya_id = ? AND onay_durumu IN ('ONAYSIZ','ONAYLI') ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}`
    )
    .all(dosyaId) as { islem_tipi: string; tutar: number }[];

  let toplamAlinanAvans = 0;
  let toplamYapilanMasraf = 0;
  let duzeltmelerNet = 0;
  for (const r of rows) {
    if (r.islem_tipi === "AVANS_GIRISI") toplamAlinanAvans += r.tutar;
    else if (r.islem_tipi === "MASRAF") toplamYapilanMasraf += r.tutar;
    else if (r.islem_tipi === "DUZELTME") duzeltmelerNet += r.tutar;
  }

  const vekalet = vekaletGetOrCreate(dosyaId, dosya.muvekkilId);
  const taksitler = vekaletTaksitList(vekalet.id);
  const hareketler = [...kasaHareketList(dosyaId)].sort((a, b) => {
    const t = a.tarih.localeCompare(b.tarih);
    return t !== 0 ? t : a.id - b.id;
  });

  return {
    ok: true,
    office: officeSettingsGet(),
    muvekkil,
    dosya,
    duzenlemeTarihi: bugunYmd(),
    kasaOzet: {
      toplamAlinanAvans,
      toplamYapilanMasraf,
      duzeltmelerNet,
      kalanAvans: ozet.kalanAvans,
    },
    hareketler,
    vekalet,
    taksitler,
    vekaletOzet: vekaletOzetFromTaksitler(vekalet.anlasilanTutar, vekalet.paraBirimi, taksitler),
  };
}
