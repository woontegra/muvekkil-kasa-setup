import type { DosyaDurum } from "@shared/types/dosya";

export function dosyaDurumEtiket(d: DosyaDurum | string): string {
  if (d === "PASIF") return "Pasif";
  if (d === "KAPANDI") return "Kapandı";
  return "Aktif";
}
