export const DIGER_GELIR_KOD = "DIGER_GELIR";
export const DIGER_GIDER_KOD = "DIGER_GIDER";

export const OFIS_GELIR_KATEGORI_KODLARI = [
  "VEKALET_DISI_GELIR",
  "DANISMANLIK_GELIR",
  "IADE_ALINAN",
  DIGER_GELIR_KOD,
] as const;

export const OFIS_GIDER_KATEGORI_KODLARI = [
  "OFIS_KIRASI",
  "PERSONEL_MAAS",
  "SGK",
  "VERGI",
  "STOPAJ",
  "MUHASEBE_UCRET",
  "ELEKTRIK",
  "SU",
  "INTERNET_TELEFON",
  "KIRTASIYE",
  "ULASIM",
  "YEMEK",
  "TEMIZLIK",
  "DEMIRBAS",
  "YAZILIM_ABONELIK",
  "BANKA_MASRAF",
  DIGER_GIDER_KOD,
] as const;

export const OFIS_GELIR_KATEGORI_ETIKET: Record<string, string> = {
  VEKALET_DISI_GELIR: "Vekalet ücreti dışı gelir",
  DANISMANLIK_GELIR: "Danışmanlık geliri",
  IADE_ALINAN: "İade alınan ödeme",
  [DIGER_GELIR_KOD]: "Diğer gelir",
};

export const OFIS_GIDER_KATEGORI_ETIKET: Record<string, string> = {
  OFIS_KIRASI: "Ofis kirası",
  PERSONEL_MAAS: "Personel maaşı",
  SGK: "SGK ödemesi",
  VERGI: "Vergi ödemesi",
  STOPAJ: "Stopaj",
  MUHASEBE_UCRET: "Muhasebe ücreti",
  ELEKTRIK: "Elektrik",
  SU: "Su",
  INTERNET_TELEFON: "İnternet / telefon",
  KIRTASIYE: "Kırtasiye",
  ULASIM: "Ulaşım",
  YEMEK: "Yemek",
  TEMIZLIK: "Temizlik",
  DEMIRBAS: "Demirbaş",
  YAZILIM_ABONELIK: "Yazılım / abonelik",
  BANKA_MASRAF: "Banka masrafı",
  [DIGER_GIDER_KOD]: "Diğer gider",
};

export const OFIS_ODEME_YONTEMI_KODLARI = ["NAKIT", "BANKA", "KREDI_KARTI", "DIGER"] as const;

export const OFIS_ODEME_YONTEMI_ETIKET: Record<string, string> = {
  NAKIT: "Nakit",
  BANKA: "Banka",
  KREDI_KARTI: "Kredi kartı",
  DIGER: "Diğer",
};

export function isGecerliOfisGelirKategori(k: string): boolean {
  return (OFIS_GELIR_KATEGORI_KODLARI as readonly string[]).includes(k);
}

export function isGecerliOfisGiderKategori(k: string): boolean {
  return (OFIS_GIDER_KATEGORI_KODLARI as readonly string[]).includes(k);
}

export function isOfisOdemeYontemiGecerli(k: string): boolean {
  return (OFIS_ODEME_YONTEMI_KODLARI as readonly string[]).includes(k);
}
