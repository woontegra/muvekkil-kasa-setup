export type DosyaDurum = "AKTIF" | "PASIF" | "KAPANDI";

export type Dosya = {
  id: number;
  muvekkilId: number;
  konuBasligi: string | null;
  mahkemeAdi: string | null;
  dosyaNumarasi: string | null;
  aciklama: string | null;
  durum: DosyaDurum;
  not: string | null;
  kayitTarihi: string;
  guncellemeTarihi: string;
};

export type DosyaInput = {
  muvekkilId: number;
  konuBasligi: string;
  mahkemeAdi: string;
  dosyaNumarasi: string;
  aciklama?: string | null;
  durum?: DosyaDurum;
  not?: string | null;
};

export type DosyaUpdateInput = {
  konuBasligi?: string | null;
  mahkemeAdi?: string | null;
  dosyaNumarasi?: string | null;
  aciklama?: string | null;
  durum?: DosyaDurum;
  not?: string | null;
};
