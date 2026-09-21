import type { AccountingPeriod, AccountingPeriodMode } from "./accountingPeriod";
import type { OfficeSettings } from "./office";
import type { KurKaynagi, ParaBirimi } from "@shared/lib/paraBirimi";

export type OfisKasaIslemTipi = "GELIR" | "GIDER" | "DUZELTME" | "DOVIZ_CIKIS" | "DOVIZ_GIRIS";
export type OfisKasaOnayDurumu = "ONAYSIZ" | "ONAYLI";

export type OfisKasaHareket = {
  id: number;
  islemTipi: OfisKasaIslemTipi;
  tarih: string;
  kategori: string;
  ozelKategoriAdi: string | null;
  kalemId: number | null;
  muvekkilId: number | null;
  muvekkilAdiSnapshot: string | null;
  tahsilatiYapanKullaniciId: number | null;
  tahsilatiYapanKullaniciAdi: string | null;
  aciklama: string | null;
  tutar: number;
  paraBirimi: ParaBirimi;
  dovizDonusumId: string | null;
  kur: number | null;
  kurBazParaBirimi: ParaBirimi | null;
  kurKarsiParaBirimi: ParaBirimi | null;
  kurKaynagi: KurKaynagi | null;
  tcmbKurTarihi: string | null;
  tcmbReferansKur: number | null;
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
  kaynakTipi?: string | null;
  kaynakId?: number | null;
};

export type OfisKasaHareketListeSatir = OfisKasaHareket & { hasCorrection?: boolean };

export type OfisKasaListFilter = {
  tarihBas?: string;
  tarihBit?: string;
  islemTipi?: string;
  kategori?: string;
  paraBirimi?: string;
  muvekkilId?: number | null;
  q?: string;
};

export type OfisKasaEkleInput = {
  islemTipi: "GELIR" | "GIDER";
  tarih: string;
  /** Geriye uyum — kalemId yoksa kod ile doğrulanır. */
  kategori?: string;
  kalemId?: number | null;
  ozelKategoriAdi?: string | null;
  aciklama?: string | null;
  tutar: number;
  paraBirimi?: ParaBirimi;
  odemeYontemi: string;
  belgeNo?: string | null;
  not?: string | null;
  muvekkilId?: number | null;
  tahsilatiYapanKullaniciId?: number | null;
};

export type OfisKasaGuncellePatch = {
  tarih?: string;
  kategori?: string;
  kalemId?: number | null;
  ozelKategoriAdi?: string | null;
  aciklama?: string | null;
  tutar?: number;
  odemeYontemi?: string;
  belgeNo?: string | null;
  not?: string | null;
  muvekkilId?: number | null;
  tahsilatiYapanKullaniciId?: number | null;
};

export type OfisKasaDuzeltmeYon = "ARTIR" | "AZALT";

export type OfisKasaDuzeltmeInput = {
  orijinalHareketId: number;
  dogruTutar: number;
  tarih: string;
  not?: string | null;
};

export type OfisKasaIslemSonuc = { ok: true; row: OfisKasaHareket } | { ok: false; error: string };

export type OfisKasaDovizDonusumInput = {
  tarih: string;
  kaynakParaBirimi: ParaBirimi;
  hedefParaBirimi: ParaBirimi;
  kaynakTutar: number;
  hedefTutar: number;
  aciklama?: string | null;
  odemeYontemi?: string;
  kurKaynagi?: KurKaynagi;
  tcmbKurTarihi?: string | null;
  tcmbReferansKur?: number | null;
};

export type OfisKasaParaBirimiOzet = {
  devredenBakiye: number;
  donemGelir: number;
  donemGider: number;
  donemDuzeltmeEtkisi: number;
  donemNetSonucu: number;
  kasaBakiyesi: number;
  bugunGider?: number;
};

export type OfisKasaUstOzet = {
  mode: AccountingPeriodMode;
  period: AccountingPeriod;
  devredenBakiye: number;
  /** Geriye uyum — dönem geliri */
  buAyGelir: number;
  buAyGider: number;
  buAyDuzeltmeEtkisi: number;
  donemGelir: number;
  donemGider: number;
  donemDuzeltmeEtkisi: number;
  donemNetSonucu: number;
  kasaBakiyesi: number;
  bakiyeler: Record<ParaBirimi, number>;
  byCurrency: Record<ParaBirimi, OfisKasaParaBirimiOzet>;
};

export type OfisKasaAnaSayfaOzet = {
  mode: AccountingPeriodMode;
  period: AccountingPeriod;
  isCurrent: boolean;
  canGoNext: boolean;
  bugunGider: number;
  /** Geriye uyum — dönem gideri */
  buAyGider: number;
  devredenBakiye: number;
  donemGelir: number;
  donemGider: number;
  donemDuzeltmeEtkisi: number;
  donemNetSonucu: number;
  kasaBakiyesi: number;
  bakiyeler: Record<ParaBirimi, number>;
  byCurrency: Record<ParaBirimi, OfisKasaParaBirimiOzet>;
};

export type OfisKasaRaporPaketi =
  | {
      ok: true;
      tarihBas: string;
      tarihBit: string;
      yazdirmaTarihi: string;
      office: OfficeSettings;
      devredenBakiye: number;
      donemGelir: number;
      donemGider: number;
      donemDuzeltmeEtkisi: number;
      kasaBakiyesi: number;
      bakiyeler: Record<ParaBirimi, number>;
      byCurrency: Record<ParaBirimi, OfisKasaParaBirimiOzet>;
      hareketler: OfisKasaHareketListeSatir[];
    }
  | { ok: false; mesaj: string };
