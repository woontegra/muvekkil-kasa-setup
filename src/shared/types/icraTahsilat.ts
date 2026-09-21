import type { OdemeYontemiKodu } from "../constants/kasa";
import type { IcraAlacakDurumKodu, IcraAlacakTuruKodu } from "../constants/icraTahsilat";
import type { KurKaynagi, ParaBirimi } from "../lib/paraBirimi";

export type IcraTahsilatParaBirimiOzet = {
  toplamAlacak: number;
  tahsilEdilen: number;
  kalanAlacak: number;
  buAyTahsilat: number;
};

export type IcraTaksitDurum = "ODENMEDI" | "KISMI_ODENDI" | "ODENDI" | "GECIKTI";

export type IcraTaksitSmmDurum = "YOK" | "BEKLIYOR" | "KESILDI";

export type IcraTahsilatUstOzet = {
  toplamAlacak: number;
  tahsilEdilen: number;
  kalanAlacak: number;
  vadesiGecmisTaksit: number;
  buAyTahsilat: number;
  bakiyeler: Record<ParaBirimi, number>;
  byCurrency: Record<ParaBirimi, IcraTahsilatParaBirimiOzet>;
};

export type IcraTahsilatListeFiltre = {
  tarihBas?: string;
  tarihBit?: string;
  alacakTuru?: string;
  durum?: string;
  q?: string;
};

export type IcraTahsilatListeSatir = {
  id: number;
  borcluAdi: string;
  muvekkilId: number | null;
  muvekkilAdi: string | null;
  dosyaId: number | null;
  dosyaKonu: string | null;
  alacakTuru: IcraAlacakTuruKodu;
  paraBirimi: ParaBirimi;
  toplamTutar: number;
  pesinatTutar: number;
  odenenToplam: number;
  kalanTutar: number;
  taksitSayisi: number;
  durum: IcraAlacakDurumKodu;
  kayitTarihi: string;
};

export type IcraTahsilatAlacakOlusturInput = {
  alacakTuru: IcraAlacakTuruKodu;
  borcluAdi: string;
  muvekkilId?: number | null;
  dosyaId?: number | null;
  toplamTutar: number;
  paraBirimi?: ParaBirimi;
  odemeParaBirimi?: ParaBirimi;
  kasaTutari?: number;
  kurKaynagi?: KurKaynagi;
  tcmbKurTarihi?: string | null;
  tcmbReferansKur?: number | null;
  pesinatVar: boolean;
  pesinatTutar?: number;
  taksitSayisi: number;
  ilkVadeTarihi: string;
  odemeYontemi: OdemeYontemiKodu;
  aciklama?: string | null;
};

export type IcraTahsilatTaksit = {
  id: number;
  alacakId: number;
  taksitNo: number;
  tutar: number;
  paraBirimi: ParaBirimi;
  vadeTarihi: string | null;
  aciklama: string | null;
  odenenToplam: number;
  kalanTutar: number;
  durum: IcraTaksitDurum;
  smmDurumu: IcraTaksitSmmDurum;
  sonOdemeTarihi: string | null;
  sonMakbuzNo: string | null;
  sonOdemeId: number | null;
  smmBekleyenOdemeId: number | null;
};

export type IcraTahsilatOdeme = {
  id: number;
  alacakId: number;
  taksitId: number | null;
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
  ofisKasaHareketId: number | null;
  pesinatMi: boolean;
  kayitTarihi: string;
};

export type IcraTahsilatOdemeAlInput = {
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

export type IcraTahsilatTaksitGuncelleInput = {
  tutar?: number;
  vadeTarihi?: string | null;
  aciklama?: string | null;
};

export type IcraTahsilatIslemSonuc<T> = { ok: true; row: T } | { ok: false; error: string };
