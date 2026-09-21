export const MASRAF_TURLERI = [
  "Harç",
  "Gider Avansı",
  "Bilirkişi Ücreti",
  "Keşif-İcra, Haciz vs.",
  "Yol-Yemek vs.",
  "Diğer",
] as const;

export const DIGER_MASRAF_ETIKETI = "Diğer";

export const ODEME_YONTEMI_KODLARI = ["NAKIT", "BANKA", "KREDI_KARTI", "DIGER"] as const;

export type OdemeYontemiKodu = (typeof ODEME_YONTEMI_KODLARI)[number];

export const ODEME_YONTEMI_ETIKET: Record<OdemeYontemiKodu, string> = {
  NAKIT: "Nakit",
  BANKA: "Banka",
  KREDI_KARTI: "Kredi kartı",
  DIGER: "Diğer",
};

/** Masraf Girişi dropdown seçenekleri (görünen metin = kayıt değeri). */
export const MASRAF_ODEME_YONTEMI_SECENEKLERI = [
  "Baro kart",
  "Vakıfbank",
  "Ziraat Bankası",
  "Nakit",
  "Diğer",
] as const;

export const DIGER_ODEME_YONTEMI_ETIKETI = "Diğer";

export function isOdemeYontemiGecerli(k: string): k is OdemeYontemiKodu {
  return (ODEME_YONTEMI_KODLARI as readonly string[]).includes(k);
}

/** Masraf kaydı için ödeme yöntemi: boş veya salt "Diğer" kabul edilmez. */
export function isMasrafOdemeYontemiKaydiGecerli(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s === DIGER_ODEME_YONTEMI_ETIKETI) return false;
  return true;
}

export function isMasrafTuruKaydiGecerli(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s === DIGER_MASRAF_ETIKETI) return false;
  return true;
}
