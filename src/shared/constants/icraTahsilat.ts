export const ICRA_ALACAK_TURU_KODLARI = ["KARSI_TARAF_VEKALET", "ICRA_VEKALET"] as const;

export type IcraAlacakTuruKodu = (typeof ICRA_ALACAK_TURU_KODLARI)[number];

export const ICRA_ALACAK_TURU_ETIKET: Record<IcraAlacakTuruKodu, string> = {
  KARSI_TARAF_VEKALET: "Karşı Taraf Vekalet Ücreti",
  ICRA_VEKALET: "İcra Vekalet Ücreti",
};

export const ICRA_ALACAK_DURUM_KODLARI = ["ACIK", "KISMI_ODENDI", "ODENDI", "GECIKTI", "IPTAL"] as const;

export type IcraAlacakDurumKodu = (typeof ICRA_ALACAK_DURUM_KODLARI)[number];

export const ICRA_ALACAK_DURUM_ETIKET: Record<IcraAlacakDurumKodu, string> = {
  ACIK: "Açık",
  KISMI_ODENDI: "Kısmi ödendi",
  ODENDI: "Ödendi",
  GECIKTI: "Gecikti",
  IPTAL: "İptal",
};

export function icraAlacakTuruOfisKategori(tur: IcraAlacakTuruKodu): string {
  return tur;
}

export function isGecerliIcraAlacakTuru(k: string): k is IcraAlacakTuruKodu {
  return (ICRA_ALACAK_TURU_KODLARI as readonly string[]).includes(k);
}
