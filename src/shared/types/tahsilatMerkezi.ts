import type { TaksitDurum, VekaletTaksit } from "./vekalet";

export type TahsilatMerkeziGorunum = "GECIKMIS" | "BUGUN" | "YAKLASAN" | "KISMI";

export type TahsilatMerkeziGorunumFilter =
  | "GECIKENLER"
  | "BUGUN"
  | "YAKLASANLAR"
  | "KISMI_ODENENLER"
  | "TUMU";

export type TahsilatMerkeziListeParams = {
  gorunum?: TahsilatMerkeziGorunumFilter;
  muvekkilId?: number;
  dosyaId?: number;
  vadeBas?: string;
  vadeBit?: string;
  durum?: TaksitDurum;
  q?: string;
  page?: number;
  limit?: number;
};

export type TahsilatMerkeziSatir = {
  id: number;
  muvekkilId: number;
  muvekkilAd: string;
  muvekkilTelefonVar: boolean;
  dosyaId: number;
  dosyaBaslik: string;
  dosyaNo: string | null;
  taksitNo: number;
  taksitAciklama: string | null;
  taksitTutari: number;
  odenenToplam: number;
  kalanTutar: number;
  vadeTarihi: string;
  durum: TaksitDurum;
  gunFarki: number;
  gorunumler: TahsilatMerkeziGorunum[];
  taksit: VekaletTaksit;
};

export type TahsilatMerkeziOzet = {
  gecikmisToplam: number;
  gecikmisAdet: number;
  bugunToplam: number;
  bugunAdet: number;
  yakin7GunToplam: number;
  yakin7GunAdet: number;
  kismiToplam: number;
  kismiAdet: number;
  yaklasanAdet: number;
};

export type TahsilatMerkeziListResponse = {
  items: TahsilatMerkeziSatir[];
  total: number;
  page: number;
  limit: number;
  ozet: TahsilatMerkeziOzet;
};
