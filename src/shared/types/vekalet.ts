import type { OdemeYontemiKodu } from "../constants/kasa";
import type { KurKaynagi, ParaBirimi } from "../lib/paraBirimi";

export type VekaletUcreti = {
  id: number;
  dosyaId: number;
  muvekkilId: number;
  anlasilanTutar: number;
  paraBirimi: ParaBirimi;
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
  paraBirimi: ParaBirimi;
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
  kasaTutari: number;
  alacakParaBirimi: ParaBirimi;
  odemeParaBirimi: ParaBirimi;
  kur: number | null;
  kurBazParaBirimi: ParaBirimi | null;
  kurKarsiParaBirimi: ParaBirimi | null;
  kurKaynagi: KurKaynagi | null;
  tcmbKurTarihi: string | null;
  tcmbReferansKur: number | null;
  odemeYontemi: OdemeYontemiKodu;
  aciklama: string | null;
  makbuzNo: string | null;
  smmKesildiMi: boolean;
  kasaHareketId: number | null;
  ofisKasaHareketId: number | null;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  makbuzDurumu: "AKTIF" | "IPTAL";
  iptalTarihi: string | null;
  iptalEdenKullaniciId: number | null;
  iptalNedeni: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type VekaletOzet = {
  paraBirimi: ParaBirimi;
  anlasilanTutar: number;
  odenenToplam: number;
  kalanVekalet: number;
};

export type VekaletKaydetInput = {
  anlasilanTutar: number;
  paraBirimi?: ParaBirimi;
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
  odemeParaBirimi?: ParaBirimi;
  kasaTutari?: number;
  kurKaynagi?: KurKaynagi;
  tcmbKurTarihi?: string | null;
  tcmbReferansKur?: number | null;
  odemeTarihi: string;
  odemeYontemi: OdemeYontemiKodu;
  aciklama?: string | null;
  smmKesildiMi?: boolean;
};

/**
 * Tahsilat düzenleme — makbuz no, SMM ve TCMB kur anlık görüntüsü korunur.
 * Verilmeyen alanlar mevcut değeriyle kalır.
 */
export type TaksitOdemeGuncelleInput = {
  tutar?: number;
  odemeParaBirimi?: ParaBirimi;
  kasaTutari?: number;
  odemeTarihi?: string;
  odemeYontemi?: OdemeYontemiKodu;
  aciklama?: string | null;
};

export type SmmBekleyenSatir = {
  odemeId: number;
  taksitId: number;
  dosyaId: number;
  taksitNo: number;
  tutar: number;
  odemeTarihi: string;
};

export type { VekaletTaksitUyariOzet, VekaletTaksitUyariSatir, VekaletTaksitUyariSonuc } from "../lib/vekaletTaksitUyari";

export type VekaletIslemSonuc<T> = { ok: true; row: T } | { ok: false; error: string };
