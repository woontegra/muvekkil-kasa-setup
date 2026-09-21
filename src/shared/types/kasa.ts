import type { OdemeYontemiKodu } from "../constants/kasa";

export type KasaIslemTipi = "AVANS_GIRISI" | "MASRAF" | "DUZELTME";
export type KasaOnayDurumu = "ONAYSIZ" | "ONAYLI" | "REDDEDILDI";

export type KasaHareket = {
  id: number;
  dosyaId: number;
  muvekkilId: number;
  islemTipi: KasaIslemTipi;
  masrafTuru: string | null;
  tutar: number;
  tarih: string;
  masrafiYapanKisi: string | null;
  aciklama: string | null;
  belgeNo: string | null;
  /** Eski kod (NAKIT…) veya masraf için serbest/etiket metin (Baro kart, Enpara…). */
  odemeYontemi: string;
  onayDurumu: KasaOnayDurumu;
  duzeltmeMi: boolean;
  duzeltilenIslemId: number | null;
  otomatikOnayMi: boolean;
  onayTarihi: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
  olusturanKullaniciId: number | null;
  olusturanKullaniciAdi: string | null;
  onaylayanKullaniciId: number | null;
  onaylayanKullaniciAdi: string | null;
  makbuzNo: string | null;
  makbuzTarihi: string | null;
  makbuzOlusturulduMu: boolean;
  hasCorrection?: boolean;
};

export type KasaOzet = {
  toplamAvans: number;
  toplamMasraf: number;
  kalanAvans: number;
  onayBekleyenSayisi: number;
};

export type KasaEkleInput = {
  dosyaId: number;
  muvekkilId: number;
  islemTipi: KasaIslemTipi;
  tutar: number;
  tarih: string;
  odemeYontemi?: OdemeYontemiKodu | string;
  aciklama?: string | null;
  masrafTuru?: string | null;
  masrafiYapanKisi?: string | null;
  duzeltilenIslemId?: number | null;
};

export type KasaGuncellePatch = {
  tutar?: number;
  tarih?: string;
  aciklama?: string | null;
  belgeNo?: string | null;
  masrafTuru?: string | null;
  masrafiYapanKisi?: string | null;
  odemeYontemi?: OdemeYontemiKodu | string;
  onayDurumu?: "REDDEDILDI";
};

export type KasaIslemSonuc = { ok: true; row: KasaHareket } | { ok: false; error: string };
