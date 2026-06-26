import type { OdemeYontemiKodu } from "../constants/kasa";

export type VekaletUcreti = {
  id: number;
  dosyaId: number;
  muvekkilId: number;
  anlasilanTutar: number;
  aciklama: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type TaksitDurum = "ODENMEDI" | "KISMI_ODENDI" | "ODENDI" | "GECIKTI";

export type TaksitSmmDurum = "YOK" | "BEKLIYOR" | "KESILDI";

export type VekaletTaksit = {
  id: number;
  vekaletUcretiId: number;
  dosyaId: number;
  muvekkilId: number;
  taksitNo: number;
  tutar: number;
  vadeTarihi: string | null;
  aciklama: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
  odenenToplam: number;
  kalanTutar: number;
  durum: TaksitDurum;
  smmDurumu: TaksitSmmDurum;
  sonOdemeTarihi: string | null;
  sonMakbuzNo: string | null;
  sonOdemeId: number | null;
  smmBekleyenOdemeId: number | null;
};

export type VekaletTaksitOdeme = {
  id: number;
  taksitId: number;
  vekaletId: number;
  dosyaId: number;
  muvekkilId: number;
  odemeTarihi: string;
  tutar: number;
  odemeYontemi: OdemeYontemiKodu;
  aciklama: string | null;
  makbuzNo: string | null;
  smmKesildiMi: boolean;
  kasaHareketId: number | null;
  ofisKasaHareketId: number | null;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type VekaletOzet = {
  anlasilanTutar: number;
  odenenToplam: number;
  kalanVekalet: number;
};

export type VekaletKaydetInput = {
  anlasilanTutar: number;
  aciklama?: string | null;
};

export type TaksitEkleInput = {
  taksitNo?: number | null;
  tutar: number;
  vadeTarihi?: string | null;
  aciklama?: string | null;
};

export type TaksitGuncelleInput = {
  taksitNo?: number;
  tutar?: number;
  vadeTarihi?: string | null;
  aciklama?: string | null;
};

export type TaksitOdemeAlInput = {
  tutar: number;
  odemeTarihi: string;
  odemeYontemi: OdemeYontemiKodu;
  aciklama?: string | null;
  smmKesildiMi?: boolean;
};

export type SmmBekleyenSatir = {
  odemeId: number;
  taksitId: number;
  dosyaId: number;
  taksitNo: number;
  tutar: number;
  odemeTarihi: string;
};

export type VekaletIslemSonuc<T> = { ok: true; row: T } | { ok: false; error: string };
