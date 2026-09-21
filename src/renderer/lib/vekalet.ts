import type { TaksitDurum, TaksitSmmDurum } from "@shared/types/vekalet";
import type { VekaletOzet, VekaletTaksit } from "@shared/types/vekalet";

export function taksitDurumEtiket(d: TaksitDurum): string {
  switch (d) {
    case "ODENMEDI":
      return "Ödenmedi";
    case "KISMI_ODENDI":
      return "Kısmi ödendi";
    case "ODENDI":
      return "Ödendi";
    case "GECIKTI":
      return "Gecikti";
    default:
      return d;
  }
}

export function taksitDurumBadgeClass(d: TaksitDurum): string {
  switch (d) {
    case "ODENDI":
      return "badge-taksit-yaklasiyor";
    case "GECIKTI":
      return "badge-taksit-gecmis";
    case "KISMI_ODENDI":
      return "badge-taksit-bugun";
    default:
      return "badge-taksit-odenmedi";
  }
}

export function vekaletOzetFromTaksitler(anlasilanTutar: number, taksitler: VekaletTaksit[]): VekaletOzet {
  const odenenToplam = taksitler.reduce((s, t) => s + t.odenenToplam, 0);
  return {
    anlasilanTutar,
    odenenToplam,
    kalanVekalet: Math.max(0, anlasilanTutar - odenenToplam),
  };
}

export function taksitSmmHucre(smm: TaksitSmmDurum): { label: string; className: string; blink: boolean } {
  if (smm === "BEKLIYOR") {
    return { label: "SMM bekliyor", className: "desk-blink-warning", blink: true };
  }
  if (smm === "KESILDI") {
    return { label: "SMM kesildi", className: "desk-smm-ok-badge", blink: false };
  }
  return { label: "—", className: "", blink: false };
}

/** Sabit tutarlı taksit planı: her taksit aynı tutarda. */
export function hesaplaSabitTaksitPlani(taksitTutari: number, adet: number): number[] | null {
  if (!Number.isFinite(taksitTutari) || taksitTutari <= 0) return null;
  if (!Number.isFinite(adet) || adet < 1 || adet > 120) return null;
  const tutar = Math.round(taksitTutari * 100) / 100;
  return Array.from({ length: adet }, () => tutar);
}

export const TAKSIT_PLANI_TOLERANS = 0.005;

export function yuvarlaTaksitToplam(tutarlar: number[]): number {
  return Math.round(tutarlar.reduce((s, t) => s + t, 0) * 100) / 100;
}

export type TaksitPlaniToplamDurum = "UYGUN" | "ASIYOR" | "EKSIK" | "GECERSIZ";

export function taksitPlaniToplamDurumu(kalan: number, toplam: number): TaksitPlaniToplamDurum {
  if (!Number.isFinite(toplam) || toplam <= 0) return "GECERSIZ";
  const fark = Math.round((toplam - kalan) * 100) / 100;
  if (fark > TAKSIT_PLANI_TOLERANS) return "ASIYOR";
  if (fark < -TAKSIT_PLANI_TOLERANS) return "EKSIK";
  return "UYGUN";
}

export function taksitPlaniToplamMesaj(durum: TaksitPlaniToplamDurum): string | null {
  switch (durum) {
    case "ASIYOR":
      return "Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz.";
    case "EKSIK":
      return "Taksit toplamı kalan vekalet tutarından eksik.";
    case "GECERSIZ":
      return "Taksit toplamı kalan vekalet tutarıyla eşleşmiyor.";
    default:
      return null;
  }
}

export function vekaletAcikTaksitVarMi(taksitler: VekaletTaksit[]): boolean {
  return taksitler.some((t) => t.kalanTutar > TAKSIT_PLANI_TOLERANS);
}

/** Kalan tutarı eşit taksitlere böler; yuvarlama farkı son taksite eklenir. */
export function bolKalanTaksitlereEsit(kalanTutar: number, adet: number): number[] | null {
  if (!Number.isFinite(kalanTutar) || kalanTutar <= 0) return null;
  if (!Number.isFinite(adet) || adet < 1 || adet > 120) return null;
  const baz = Math.floor((kalanTutar / adet) * 100) / 100;
  const tutarlar = Array.from({ length: adet }, () => baz);
  const farkKurus = Math.round((kalanTutar - yuvarlaTaksitToplam(tutarlar)) * 100) / 100;
  if (tutarlar.length > 0) {
    tutarlar[tutarlar.length - 1] = Math.round((tutarlar[tutarlar.length - 1] + farkKurus) * 100) / 100;
  }
  return tutarlar;
}

/** Vade tarihine göre artan; aynı vadede taksit_no, sonra id. ID'leri değiştirmez. */
export function siralaVekaletTaksitleriVadeAsc<T extends { vadeTarihi: string | null; taksitNo: number; id: number }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const va = (a.vadeTarihi ?? "").slice(0, 10);
    const vb = (b.vadeTarihi ?? "").slice(0, 10);
    if (va && vb && va !== vb) return va < vb ? -1 : 1;
    if (va && !vb) return -1;
    if (!va && vb) return 1;
    if (a.taksitNo !== b.taksitNo) return a.taksitNo - b.taksitNo;
    return a.id - b.id;
  });
}
