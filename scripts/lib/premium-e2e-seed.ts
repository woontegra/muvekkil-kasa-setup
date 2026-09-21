import { getDb, nowIso } from "../../src/main/db/connection";
import { dosyaEkle } from "../../src/main/services/dosya.service";
import { kasaHareketEkle } from "../../src/main/services/kasa.service";
import { muvekkilEkle } from "../../src/main/services/muvekkil.service";
import { ofisKasaHareketEkle } from "../../src/main/services/ofisKasa.service";
import { vekaletKaydet, vekaletTaksitEkle, vekaletTaksitOdemeAl } from "../../src/main/services/vekalet.service";
import { icraTahsilatAlacakOlustur, icraTahsilatTaksitList, icraTahsilatTaksitOdemeAl } from "../../src/main/services/icraTahsilat.service";

export type CrudSeed = {
  muvekkilId: number;
  dosyaId: number;
  vekaletOdemeId: number;
  kasaHareketId: number;
};

/** Print paritesi için bilinen kayıtlar (GUI öncesi servis katmanı). */
export function seedPrintParityData(): CrudSeed {
  const m = muvekkilEkle({
    muvekkilTuru: "GERCEK_KISI",
    adSoyad: "Print Parite Müvekkil",
    telefon: "5551112233",
  });
  const d = dosyaEkle({
    muvekkilId: m.id,
    konuBasligi: "Print Parite Dosya",
    mahkemeAdi: "Ankara 1. İcra",
    dosyaNumarasi: "2026/99",
  });
  const avans = kasaHareketEkle({
    dosyaId: d.id,
    muvekkilId: m.id,
    islemTipi: "AVANS_GIRISI",
    tutar: 2500,
    tarih: "2026-06-01",
    odemeYontemi: "NAKIT",
    aciklama: "Print test avans",
  });
  if (!avans.ok) throw new Error(avans.error);
  getDb()
    .prepare(`UPDATE dosya_kasa_hareket SET onay_durumu = 'ONAYLI', onay_tarihi = ? WHERE id = ?`)
    .run(nowIso(), avans.row.id);
  const masraf = kasaHareketEkle({
    dosyaId: d.id,
    muvekkilId: m.id,
    islemTipi: "MASRAF",
    tutar: 500,
    tarih: "2026-06-02",
    odemeYontemi: "NAKIT",
    masrafTuru: "Harç",
    aciklama: "Print test masraf",
  });
  if (!masraf.ok) throw new Error(masraf.error);
  ofisKasaHareketEkle({
    islemTipi: "GELIR",
    kategori: "DIGER",
    tutar: 1200,
    tarih: "2026-06-03",
    odemeYontemi: "NAKIT",
    aciklama: "Print test gelir",
  });
  ofisKasaHareketEkle({
    islemTipi: "GIDER",
    kategori: "DIGER",
    tutar: 300,
    tarih: "2026-06-04",
    odemeYontemi: "NAKIT",
    aciklama: "Print test gider",
  });
  const vk = vekaletKaydet(d.id, m.id, { anlasilanTutar: 10000 });
  if (!vk.ok) throw new Error(vk.error);
  const tk = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: 1, vadeTarihi: "2026-06-15" });
  if (!tk.ok) throw new Error(tk.error);
  const od = vekaletTaksitOdemeAl(tk.row.id, {
    tutar: 5000,
    odemeTarihi: "2026-06-10",
    odemeYontemi: "NAKIT",
    aciklama: null,
  });
  if (!od.ok) throw new Error(od.error);
  const alacak = icraTahsilatAlacakOlustur({
    alacakTuru: "KARSI_TARAF_VEKALET",
    borcluAdi: "Print Borçlu",
    muvekkilId: m.id,
    dosyaId: d.id,
    toplamTutar: 9000,
    pesinatVar: false,
    taksitSayisi: 2,
    ilkVadeTarihi: "2026-07-01",
    odemeYontemi: "NAKIT",
  });
  if (!alacak.ok) throw new Error(alacak.error);
  const taksitler = icraTahsilatTaksitList(alacak.row.id);
  const icraOd = icraTahsilatTaksitOdemeAl(taksitler[0]!.id, {
    tutar: 4500,
    odemeTarihi: "2026-06-20",
    odemeYontemi: "NAKIT",
  });
  if (!icraOd.ok) throw new Error(icraOd.error);

  return {
    muvekkilId: m.id,
    dosyaId: d.id,
    vekaletOdemeId: od.row.odeme.id,
    kasaHareketId: avans.row.id,
  };
}

export function countTable(table: string): number {
  const db = getDb();
  return Number(db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
}

export function setOfficeName(name: string): void {
  const db = getDb();
  const t = nowIso();
  db.prepare(
    `INSERT INTO office_settings (id, ofis_adi, kayit_tarihi, guncelleme_tarihi)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET ofis_adi = excluded.ofis_adi, guncelleme_tarihi = excluded.guncelleme_tarihi`,
  ).run(name, t, t);
}
