import type { DosyaDurum } from "./dosya";

export type DosyaListeDurumFilter = DosyaDurum | "TUMU";

export type DosyaListeParams = {
  q?: string;
  durum?: DosyaListeDurumFilter;
  page?: number;
  pageSize?: number;
};

export type DosyaListeSatir = {
  id: number;
  muvekkilId: number;
  muvekkilAd: string;
  konuBasligi: string | null;
  mahkemeAdi: string | null;
  dosyaNumarasi: string | null;
  durum: DosyaDurum;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type DosyaListeSonuc = {
  items: DosyaListeSatir[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const DOSYA_LISTE_PAGE_SIZES = [20, 50, 100] as const;
