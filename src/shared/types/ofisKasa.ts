import type { OfficeSettings } from "./office";

export type OfisKasaIslemTipi = "GELIR" | "GIDER" | "DUZELTME";
export type OfisKasaOnayDurumu = "ONAYSIZ" | "ONAYLI";

export type OfisKasaHareket = {
  id: number;
  islemTipi: OfisKasaIslemTipi;
  tarih: string;
  kategori: string;
  ozelKategoriAdi: string | null;
  aciklama: string | null;
  tutar: number;
  odemeYontemi: string;
  belgeNo: string | null;
  not: string | null;
  onayDurumu: OfisKasaOnayDurumu;
  duzeltmeMi: boolean;
  orijinalHareketId: number | null;
  otomatikOnayMi: boolean;
  onayTarihi: string | null;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  onaylayanKullaniciId: number | null;
  onaylayanKullaniciAdi: string | null;
  duzeltmeYonu?: OfisKasaDuzeltmeYon | null;
  duzeltmeOrijinalTutar?: number | null;
  duzeltmeDogruTutar?: number | null;
  duzeltmeFarkTutar?: number | null;
  duzeltmeKasaEtkisi?: number | null;
  duzeltmeRefTipi?: "GELIR" | "GIDER" | null;
};

export type OfisKasaHareketListeSatir = OfisKasaHareket & { hasCorrection?: boolean };

export type OfisKasaListFilter = {
  tarihBas?: string;
  tarihBit?: string;
  islemTipi?: string;
  kategori?: string;
  q?: string;
};

export type OfisKasaEkleInput = {
  islemTipi: "GELIR" | "GIDER";
  tarih: string;
  kategori: string;
  ozelKategoriAdi?: string | null;
  aciklama?: string | null;
  tutar: number;
  odemeYontemi: string;
  belgeNo?: string | null;
  not?: string | null;
};

export type OfisKasaGuncellePatch = {
  tarih?: string;
  kategori?: string;
  ozelKategoriAdi?: string | null;
  aciklama?: string | null;
  tutar?: number;
  odemeYontemi?: string;
  belgeNo?: string | null;
  not?: string | null;
};

export type OfisKasaDuzeltmeYon = "ARTIR" | "AZALT";

export type OfisKasaDuzeltmeInput = {
  orijinalHareketId: number;
  dogruTutar: number;
  tarih: string;
  not?: string | null;
};

export type OfisKasaIslemSonuc = { ok: true; row: OfisKasaHareket } | { ok: false; error: string };

export type OfisKasaUstOzet = {
  toplamGelir: number;
  toplamGider: number;
  duzeltmeEtkisi: number;
  kasaBakiyesi: number;
  buAyGelir: number;
  buAyGider: number;
};

export type OfisKasaAnaSayfaOzet = {
  bugunGider: number;
  buAyGider: number;
  kasaBakiyesi: number;
};

export type OfisKasaRaporPaketi =
  | {
      ok: true;
      tarihBas: string;
      tarihBit: string;
      yazdirmaTarihi: string;
      office: OfficeSettings;
      toplamGelir: number;
      toplamGider: number;
      duzeltmeEtkisi: number;
      kasaBakiyesi: number;
      hareketler: OfisKasaHareketListeSatir[];
    }
  | { ok: false; mesaj: string };
