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

export function vekaletOzetFromTaksitler(anlasilanTutar: number, taksitler: VekaletTaksit[]): VekaletOzet {
  const odenenToplam = taksitler.reduce((s, t) => s + t.odenenToplam, 0);
  return {
    anlasilanTutar,
    odenenToplam,
    kalanVekalet: Math.max(0, anlasilanTutar - odenenToplam),
  };
}

export function taksitSmmHucre(smm: TaksitSmmDurum): { label: string; tone: "warning" | "success" | "default" } {
  if (smm === "BEKLIYOR") return { label: "SMM bekliyor", tone: "warning" };
  if (smm === "KESILDI") return { label: "SMM kesildi", tone: "success" };
  return { label: "—", tone: "default" };
}

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

export function vadeEkleAy(ymd: string, ay: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + ay, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function taksitDurumTone(d: TaksitDurum): "default" | "success" | "info" | "warning" {
  switch (d) {
    case "ODENDI":
      return "success";
    case "GECIKTI":
      return "warning";
    case "KISMI_ODENDI":
      return "info";
    default:
      return "default";
  }
}

export function taksitMaxTutar(
  anlasilan: number,
  taksitler: VekaletTaksit[],
  duzenlenenId?: number,
): number {
  const digerToplam = yuvarlaTaksitToplam(
    taksitler.filter((t) => t.id !== duzenlenenId).map((t) => t.tutar),
  );
  return Math.max(0, Math.round((anlasilan - digerToplam) * 100) / 100);
}
