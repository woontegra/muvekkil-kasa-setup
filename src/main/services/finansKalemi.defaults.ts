export type FinansKalemTuru = "GELIR" | "GIDER";

export type FinansKalemSeed = {
  tur: FinansKalemTuru;
  ad: string;
  kod?: string;
  sistemMi: boolean;
  sira: number;
};

/** SaaS normalizeFinansKalemAd paritesi. */
export function normalizeFinansKalemAd(ad: string): string {
  return ad.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/** Sistem kalemleri — kullanıcı düzenleyemez / kaldıramaz / ofis formunda seçemez. */
export const SISTEM_FINANS_KALEMLERI: FinansKalemSeed[] = [
  { tur: "GELIR", ad: "Vekalet Ücreti Tahsilatı", kod: "VEKALET_TAHSILATI", sistemMi: true, sira: 0 },
  { tur: "GELIR", ad: "Karşı Taraf Vekalet Ücreti", kod: "KARSI_TARAF_VEKALET", sistemMi: true, sira: 1 },
  { tur: "GELIR", ad: "İcra Vekalet Ücreti", kod: "ICRA_VEKALET", sistemMi: true, sira: 2 },
  { tur: "GELIR", ad: "Düzeltme", kod: "DUZELTME", sistemMi: true, sira: 3 },
  { tur: "GELIR", ad: "Döviz dönüşümü", kod: "DOVIZ_DONUSUM", sistemMi: true, sira: 4 },
];

/** Manuel ofis gelir — Desktop kodlarıyla uyumlu. */
export const VARSAYILAN_GELIR_KALEMLERI: { ad: string; kod: string }[] = [
  { ad: "Vekalet ücreti dışı gelir", kod: "VEKALET_DISI_GELIR" },
  { ad: "Danışmanlık geliri", kod: "DANISMANLIK_GELIR" },
  { ad: "İade alınan ödeme", kod: "IADE_ALINAN" },
  { ad: "Diğer gelir", kod: "DIGER_GELIR" },
];

/** Ofis gider + dosya masraf birleşik (SaaS). */
export const VARSAYILAN_GIDER_KALEMLERI: { ad: string; kod?: string }[] = [
  { ad: "Ofis kirası", kod: "OFIS_KIRASI" },
  { ad: "Personel maaşı", kod: "PERSONEL_MAAS" },
  { ad: "SGK ödemesi", kod: "SGK" },
  { ad: "Vergi ödemesi", kod: "VERGI" },
  { ad: "Stopaj", kod: "STOPAJ" },
  { ad: "Muhasebe ücreti", kod: "MUHASEBE_UCRET" },
  { ad: "Elektrik", kod: "ELEKTRIK" },
  { ad: "Su", kod: "SU" },
  { ad: "İnternet / telefon", kod: "INTERNET_TELEFON" },
  { ad: "Kırtasiye", kod: "KIRTASIYE" },
  { ad: "Ulaşım", kod: "ULASIM" },
  { ad: "Yemek", kod: "YEMEK" },
  { ad: "Temizlik", kod: "TEMIZLIK" },
  { ad: "Demirbaş", kod: "DEMIRBAS" },
  { ad: "Yazılım / abonelik", kod: "YAZILIM_ABONELIK" },
  { ad: "Banka masrafı", kod: "BANKA_MASRAF" },
  { ad: "Diğer gider", kod: "DIGER_GIDER" },
  { ad: "Harç" },
  { ad: "Gider Avansı" },
  { ad: "Bilirkişi Ücreti" },
  { ad: "Keşif-İcra, Haciz vs." },
  { ad: "Yol-Yemek vs." },
  { ad: "Diğer" },
];

export function buildFinansKalemSeeds(): FinansKalemSeed[] {
  const out: FinansKalemSeed[] = [...SISTEM_FINANS_KALEMLERI];
  let sira = 10;
  for (const g of VARSAYILAN_GELIR_KALEMLERI) {
    out.push({ tur: "GELIR", ad: g.ad, kod: g.kod, sistemMi: false, sira });
    sira += 1;
  }
  sira = 10;
  for (const g of VARSAYILAN_GIDER_KALEMLERI) {
    out.push({ tur: "GIDER", ad: g.ad, kod: g.kod, sistemMi: false, sira });
    sira += 1;
  }
  return out;
}

export function isDigerGelirKalemAd(ad: string): boolean {
  return normalizeFinansKalemAd(ad) === normalizeFinansKalemAd("Diğer gelir");
}

export function isDigerGiderKalemAd(ad: string): boolean {
  const n = normalizeFinansKalemAd(ad);
  return (
    n === normalizeFinansKalemAd("Diğer gider") ||
    n === normalizeFinansKalemAd("Diğer") ||
    n === normalizeFinansKalemAd("Diğer masraf")
  );
}

export function isPersonelMaasKalem(kod: string | null | undefined, ad: string): boolean {
  if (kod === "PERSONEL_MAAS") return true;
  return normalizeFinansKalemAd(ad) === normalizeFinansKalemAd("Personel maaşı");
}
