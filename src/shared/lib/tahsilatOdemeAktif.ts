/** Aktif vekalet tahsilat ödemesi — iptal damgası ve bağlı kasa soft-delete kontrolü. */

export const TAKSIT_AKTIF_SQL = `COALESCE(t.odeme_durumu, 'AKTIF') != 'IPTAL'`;

export const ODEME_AKTIF_SQL = `COALESCE(o.makbuz_durumu, 'AKTIF') = 'AKTIF' AND o.iptal_tarihi IS NULL`;

export const ODEME_AKTIF_OFIS_SQL = `
  ${ODEME_AKTIF_SQL}
  AND (
    o.ofis_kasa_hareket_id IS NULL
    OR EXISTS (
      SELECT 1 FROM ofis_kasa_hareketleri ok
      WHERE ok.id = o.ofis_kasa_hareket_id AND ok.silinme_tarihi IS NULL
    )
  )
  AND (
    o.kasa_hareket_id IS NULL
    OR EXISTS (
      SELECT 1 FROM dosya_kasa_hareket dk
      WHERE dk.id = o.kasa_hareket_id AND dk.silinme_tarihi IS NULL
    )
  )
`;

export const VEKALET_AKTIF_SQL = `COALESCE(v.durum, 'AKTIF') = 'AKTIF' AND v.silinme_tarihi IS NULL`;

export type TahsilatOdemeAktifRow = {
  makbuz_durumu?: string | null;
  makbuzDurumu?: "AKTIF" | "IPTAL";
  iptal_tarihi?: string | null;
  iptalTarihi?: string | null;
  ofisKasaHareketId?: number | null;
  ofis_silinme_tarihi?: string | null;
  ofisSilinmeTarihi?: string | null;
  kasa_silinme_tarihi?: string | null;
};

export function isTahsilatOdemeAktifRow(r: TahsilatOdemeAktifRow): boolean {
  const makbuz = (r.makbuz_durumu ?? r.makbuzDurumu ?? "AKTIF").toString().trim() || "AKTIF";
  if (makbuz === "IPTAL") return false;
  const iptal = r.iptal_tarihi ?? r.iptalTarihi;
  if (iptal != null && String(iptal).trim() !== "") return false;
  const ofisSil = r.ofis_silinme_tarihi ?? r.ofisSilinmeTarihi;
  if (ofisSil != null && String(ofisSil).trim() !== "") return false;
  const kasaSil = r.kasa_silinme_tarihi;
  if (kasaSil != null && String(kasaSil).trim() !== "") return false;
  return true;
}

/** @deprecated use isTahsilatOdemeAktifRow */
export function isTahsilatOdemeAktif(odeme: TahsilatOdemeAktifRow): boolean {
  return isTahsilatOdemeAktifRow(odeme);
}

export function filterAktifTahsilatOdemeleri<T extends TahsilatOdemeAktifRow>(odemeler: T[]): T[] {
  return odemeler.filter(isTahsilatOdemeAktifRow);
}
