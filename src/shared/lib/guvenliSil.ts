import { OFIS_KASA_KAYNAK_VEKALET_TAHSILATI } from "@shared/constants/ofisKasa";
import type { KasaHareket } from "@shared/types/kasa";
import type { OfisKasaHareketListeSatir } from "@shared/types/ofisKasa";

export type DosyaKasaGuvenliSilMode = "MASRAF_SIL" | "AVANS_SIL";
export type OfisGuvenliSilMode = "GIDER_SIL" | "GELIR_SIL" | "TAHSILAT_IPTAL";

export function canShowDosyaKasaGuvenliSil(h: KasaHareket): DosyaKasaGuvenliSilMode | null {
  if (h.onayDurumu !== "ONAYLI" || h.duzeltmeMi) return null;
  if (h.islemTipi === "MASRAF") return "MASRAF_SIL";
  if (h.islemTipi === "AVANS_GIRISI") return "AVANS_SIL";
  return null;
}

export function dosyaKasaGuvenliSilModalTitle(mode: DosyaKasaGuvenliSilMode): string {
  return mode === "AVANS_SIL" ? "Avansı sil" : "Masrafı sil";
}

/** Ofis kasasından iptal edilebilen bağlı tahsilat kaynakları. */
export const OFIS_TAHSILAT_IPTAL_KAYNAKLARI: readonly string[] = [OFIS_KASA_KAYNAK_VEKALET_TAHSILATI];

/**
 * Manuel gelir/gider ve bağlı vekalet tahsilatı.
 * Bağlı tahsilat gelirinde mod TAHSILAT_IPTAL olur; kaskad vekalet tahsilat iptaliyle aynıdır.
 */
export function canShowOfisGuvenliSil(h: OfisKasaHareketListeSatir & { kaynakTipi?: string | null }): OfisGuvenliSilMode | null {
  if (h.onayDurumu !== "ONAYLI" || h.duzeltmeMi || h.hasCorrection) return null;
  if (h.islemTipi === "GIDER") return "GIDER_SIL";
  if (h.islemTipi === "GELIR") {
    const kt = h.kaynakTipi?.trim();
    if (!kt) return "GELIR_SIL";
    if (OFIS_TAHSILAT_IPTAL_KAYNAKLARI.includes(kt)) return "TAHSILAT_IPTAL";
    return null;
  }
  return null;
}

export function ofisGuvenliSilModalTitle(mode: OfisGuvenliSilMode): string {
  if (mode === "TAHSILAT_IPTAL") return "Tahsilatı iptal et";
  return mode === "GELIR_SIL" ? "Geliri sil" : "Gideri sil";
}
