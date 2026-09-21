import type { Muvekkil, MuvekkilTuru } from "@shared/types/muvekkil";

export function muvekkilTurEtiket(t: MuvekkilTuru | string): string {
  return t === "TUZEL_KISI" ? "Tüzel kişi" : "Gerçek kişi";
}

export function muvekkilGorunenAd(m: Pick<Muvekkil, "muvekkilTuru" | "sirketUnvani" | "adSoyad">): string {
  if (m.muvekkilTuru === "TUZEL_KISI") {
    const u = (m.sirketUnvani ?? "").trim();
    if (u) return u;
  }
  return (m.adSoyad ?? "").trim() || "—";
}

export function muvekkilBasHarfleri(m: Pick<Muvekkil, "muvekkilTuru" | "sirketUnvani" | "adSoyad">): string {
  const ad = muvekkilGorunenAd(m);
  if (ad === "—") return "?";
  const parts = ad.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return ad.slice(0, 2).toUpperCase();
}

export function muvekkilAlanDegeri(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t || "—";
}

export function muvekkilListeTelefonu(m: Muvekkil): string {
  if (m.muvekkilTuru === "TUZEL_KISI") {
    const y = (m.yetkiliTelefon ?? "").trim();
    const mh = (m.muhasebeTelefon ?? "").trim();
    return y || mh || "—";
  }
  return (m.telefon ?? "").trim() || "—";
}

export function muvekkilListeEposta(m: Muvekkil): string {
  return (m.eposta ?? "").trim() || "—";
}

export const MUVEKKIL_PAGE_SIZES = [20, 50, 100] as const;

export function muvekkilListeSayfaNumaralari(current: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const maxBtns = 7;
  let start = Math.max(1, current - 3);
  let end = Math.min(totalPages, start + maxBtns - 1);
  start = Math.max(1, end - maxBtns + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
