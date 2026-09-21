export type VekaletTaksitUyariOzet = {
  vadesiGecmis: number;
  bugunOdenecek: number;
  odenmemis: number;
};

export type VekaletTaksitUyariSinif = "vadesiGecmis" | "bugunOdenecek" | "odenmemis";

export type VekaletTaksitUyariSatir = {
  taksitId: number;
  dosyaId: number;
  muvekkilId: number;
  muvekkilAdi: string;
  dosyaKonu: string;
  taksitNo: number;
  vadeTarihi: string | null;
  tutar: number;
  odenen: number;
  kalan: number;
  durum: "GECIKTI";
};

export type VekaletTaksitUyariSonuc = {
  ozet: VekaletTaksitUyariOzet;
  vadesiGecmisListe: VekaletTaksitUyariSatir[];
};

/** Yerel takvim günü (YYYY-MM-DD) — saat dilimi kayması olmadan karşılaştırma için. */
export function bugunYmdLocal(ref = new Date()): string {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const g = String(ref.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

/**
 * Açık vekalet taksitini uyarı kategorisine ayırır.
 * kalanTutar <= 0 ise null (sayılmaz).
 */
export function siniflaVekaletTaksitUyari(
  vadeTarihi: string | null | undefined,
  kalanTutar: number,
  bugun: string = bugunYmdLocal(),
): VekaletTaksitUyariSinif | null {
  if (!Number.isFinite(kalanTutar) || kalanTutar <= 0.001) return null;

  const v = (vadeTarihi ?? "").trim().slice(0, 10);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "odenmemis";

  if (v < bugun) return "vadesiGecmis";
  if (v === bugun) return "bugunOdenecek";
  return "odenmemis";
}

export function bosVekaletTaksitUyariOzet(): VekaletTaksitUyariOzet {
  return { vadesiGecmis: 0, bugunOdenecek: 0, odenmemis: 0 };
}

export function vekaletTaksitUyariOzetFromSiniflar(
  siniflar: Array<VekaletTaksitUyariSinif | null>,
): VekaletTaksitUyariOzet {
  const ozet = bosVekaletTaksitUyariOzet();
  for (const s of siniflar) {
    if (s === "vadesiGecmis") ozet.vadesiGecmis += 1;
    else if (s === "bugunOdenecek") ozet.bugunOdenecek += 1;
    else if (s === "odenmemis") ozet.odenmemis += 1;
  }
  return ozet;
}

export function vekaletTaksitUyariSonucFromKayitlar(
  kayitlar: Array<{ sinif: VekaletTaksitUyariSinif | null; satir: VekaletTaksitUyariSatir | null }>,
): VekaletTaksitUyariSonuc {
  const siniflar = kayitlar.map((k) => k.sinif);
  const vadesiGecmisListe = kayitlar
    .filter((k): k is { sinif: "vadesiGecmis"; satir: VekaletTaksitUyariSatir } => k.sinif === "vadesiGecmis" && k.satir != null)
    .map((k) => k.satir)
    .sort((a, b) => {
      const va = a.vadeTarihi ?? "";
      const vb = b.vadeTarihi ?? "";
      if (va !== vb) return va.localeCompare(vb);
      return a.taksitNo - b.taksitNo;
    });
  return {
    ozet: vekaletTaksitUyariOzetFromSiniflar(siniflar),
    vadesiGecmisListe,
  };
}
