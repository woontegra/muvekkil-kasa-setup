export type AuthUser = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  eposta: string | null;
  telefon: string | null;
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
