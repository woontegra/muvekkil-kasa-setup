export type KullaniciRolu = "BURO_SAHIBI" | "AVUKAT_YONETICI" | "KATIP_PERSONEL";

export const KULLANICI_ROLLERI: readonly KullaniciRolu[] = [
  "BURO_SAHIBI",
  "AVUKAT_YONETICI",
  "KATIP_PERSONEL",
];

export const KULLANICI_ROL_ETIKET: Record<KullaniciRolu, string> = {
  BURO_SAHIBI: "Büro sahibi",
  AVUKAT_YONETICI: "Avukat / yönetici",
  KATIP_PERSONEL: "Kâtip / personel",
};

/** Bilinmeyen/boş rol en kısıtlı role düşer (fail-closed). */
export function normalizeKullaniciRolu(raw: unknown): KullaniciRolu {
  const s = String(raw ?? "").trim().toUpperCase();
  return (KULLANICI_ROLLERI as KullaniciRolu[]).includes(s as KullaniciRolu)
    ? (s as KullaniciRolu)
    : "KATIP_PERSONEL";
}

export type AuthUser = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  eposta: string | null;
  telefon: string | null;
  rol: KullaniciRolu;
};

export type AuthResult<T = void> =
  | { ok: true; user?: AuthUser; data?: T }
  | { ok: false; error: string };

export type SetupInput = {
  adSoyad: string;
  kullaniciAdi?: string;
  sifre: string;
  guvenlikSorusuKodu: string;
  guvenlikCevabi: string;
  eposta?: string;
  telefon?: string;
};

export type LoginInput = {
  kullaniciAdi: string;
  password: string;
  rememberMe?: boolean;
};

export type RememberedLogin = {
  kullaniciAdi: string;
  rememberMe: boolean;
};

export const GUVENLIK_SORULARI: Record<string, string> = {
  G1: "Annenizin kızlık soyadı nedir?",
  G2: "Doğduğunuz şehir nedir?",
  G3: "İlkokul öğretmeninizin adı nedir?",
  G4: "İlk evcil hayvanınızın adı nedir?",
};

export const GUVENLIK_SORU_KODLARI = Object.keys(GUVENLIK_SORULARI);
