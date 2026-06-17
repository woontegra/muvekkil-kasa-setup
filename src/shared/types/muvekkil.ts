export type MuvekkilTuru = "GERCEK_KISI" | "TUZEL_KISI";

export type Muvekkil = {
  id: number;
  muvekkilTuru: MuvekkilTuru;
  adSoyad: string;
  telefon: string | null;
  eposta: string | null;
  adres: string | null;
  sirketUnvani: string | null;
  yetkiliAdSoyad: string | null;
  yetkiliTelefon: string | null;
  mudurAdSoyad: string | null;
  mudurTelefon: string | null;
  muhasebeAdSoyad: string | null;
  muhasebeTelefon: string | null;
  vergiNo: string | null;
  vergiDairesi: string | null;
  aktifMi: boolean;
  not: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type MuvekkilInput = {
  muvekkilTuru: MuvekkilTuru;
  adSoyad?: string | null;
  telefon?: string | null;
  eposta?: string | null;
  adres?: string | null;
  sirketUnvani?: string | null;
  yetkiliAdSoyad?: string | null;
  yetkiliTelefon?: string | null;
  mudurAdSoyad?: string | null;
  mudurTelefon?: string | null;
  muhasebeAdSoyad?: string | null;
  muhasebeTelefon?: string | null;
  vergiNo?: string | null;
  vergiDairesi?: string | null;
  not?: string | null;
};

export type MuvekkilListItem = Muvekkil & {
  aktifDosyaSayisi: number;
};

export type MuvekkilPagedResult = {
  items: MuvekkilListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
