export type CalendarView = "day" | "week" | "month";

export type RandevuKullanici = {
  id: number;
  adSoyad: string;
};

export type Randevu = {
  id: number;
  baslik: string;
  baslangicAt: string;
  bitisAt: string;
  muvekkilId: number | null;
  dosyaId: number | null;
  sorumluKullaniciId: number | null;
  konum: string | null;
  aciklama: string | null;
  aktifMi: boolean;
  olusturanKullaniciId: number | null;
  createdAt: string;
  updatedAt: string;
  muvekkilAd: string | null;
  dosyaBaslik: string | null;
  sorumluAdSoyad: string | null;
};

export type RandevuListFilter = {
  baslangic: string;
  bitis: string;
  muvekkilId?: number;
  sorumluKullaniciId?: number;
};

export type RandevuWriteInput = {
  baslik: string;
  baslangicAt: string;
  bitisAt: string;
  muvekkilId?: number | null;
  dosyaId?: number | null;
  sorumluKullaniciId?: number | null;
  konum?: string | null;
  aciklama?: string | null;
};

export type RandevuIslemSonuc<T = Randevu> =
  | { ok: true; data: T }
  | { ok: false; error: string };
