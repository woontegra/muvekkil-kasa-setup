import type { OfisKasaDuzeltmeYon, OfisKasaHareket } from "./types/ofisKasa";

export type DuzeltmeTurEtiket = "Gider azaltma" | "Gider artırma" | "Gelir azaltma" | "Gelir artırma";

export function duzeltmeTurEtiketi(refTip: "GELIR" | "GIDER", yon: OfisKasaDuzeltmeYon): DuzeltmeTurEtiket {
  if (refTip === "GIDER") return yon === "AZALT" ? "Gider azaltma" : "Gider artırma";
  return yon === "AZALT" ? "Gelir azaltma" : "Gelir artırma";
}

export function hesaplaOfisKasaDuzeltme(
  refTip: "GELIR" | "GIDER",
  orijinalTutar: number,
  dogruTutar: number
):
  | { ok: true; yon: OfisKasaDuzeltmeYon; farkTutar: number; kasaEtkisi: number; turEtiket: DuzeltmeTurEtiket }
  | { ok: false; error: string } {
  if (!Number.isFinite(dogruTutar) || dogruTutar < 0) {
    return { ok: false, error: "Doğru tutar geçerli ve sıfırdan büyük veya eşit olmalıdır." };
  }
  if (!Number.isFinite(orijinalTutar) || orijinalTutar <= 0) {
    return { ok: false, error: "Orijinal tutar geçersiz." };
  }
  const farkTutar = Math.abs(dogruTutar - orijinalTutar);
  if (farkTutar === 0) {
    return { ok: false, error: "Doğru tutar orijinal tutarla aynı; düzeltme gerekmez." };
  }
  const yon: OfisKasaDuzeltmeYon = dogruTutar > orijinalTutar ? "ARTIR" : "AZALT";
  let kasaEtkisi: number;
  if (refTip === "GIDER") {
    kasaEtkisi = yon === "AZALT" ? farkTutar : -farkTutar;
  } else {
    kasaEtkisi = yon === "ARTIR" ? farkTutar : -farkTutar;
  }
  return { ok: true, yon, farkTutar, kasaEtkisi, turEtiket: duzeltmeTurEtiketi(refTip, yon) };
}

/** Eski kayıtlarda tutar işaretli kasa etkisi olarak saklanmış olabilir */
export function duzeltmeKasaEtkisiFromRow(h: Pick<OfisKasaHareket, "tutar" | "duzeltmeKasaEtkisi">): number {
  if (h.duzeltmeKasaEtkisi != null && Number.isFinite(h.duzeltmeKasaEtkisi)) return h.duzeltmeKasaEtkisi;
  return h.tutar;
}

export function duzeltmeFarkTutarFromRow(
  h: Pick<OfisKasaHareket, "tutar" | "duzeltmeFarkTutar" | "duzeltmeKasaEtkisi">
): number {
  if (h.duzeltmeFarkTutar != null && Number.isFinite(h.duzeltmeFarkTutar)) return h.duzeltmeFarkTutar;
  if (h.duzeltmeKasaEtkisi != null && Number.isFinite(h.duzeltmeKasaEtkisi)) {
    return Math.abs(h.duzeltmeKasaEtkisi);
  }
  return Math.abs(h.tutar);
}

export function duzeltmeYonFromRow(
  h: Pick<OfisKasaHareket, "duzeltmeYonu" | "duzeltmeKasaEtkisi" | "tutar">,
  refTip: "GELIR" | "GIDER"
): OfisKasaDuzeltmeYon | null {
  if (h.duzeltmeYonu === "ARTIR" || h.duzeltmeYonu === "AZALT") return h.duzeltmeYonu;
  const etki = duzeltmeKasaEtkisiFromRow(h);
  if (refTip === "GIDER") return etki > 0 ? "AZALT" : "ARTIR";
  return etki > 0 ? "ARTIR" : "AZALT";
}
