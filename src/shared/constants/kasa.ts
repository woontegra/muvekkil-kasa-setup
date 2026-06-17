export const MASRAF_TURLERI = [
  "Harç",
  "Posta",
  "Bilirkişi",
  "Keşif",
  "Yol",
  "Fotokopi",
  "Dosya masrafı",
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

export function isOdemeYontemiGecerli(k: string): k is OdemeYontemiKodu {
  return (ODEME_YONTEMI_KODLARI as readonly string[]).includes(k);
}

export function isMasrafTuruKaydiGecerli(v: unknown): boolean {
  const s = String(v ?? "").trim();
  if (!s) return false;
  if (s === DIGER_MASRAF_ETIKETI) return false;
  return true;
}
