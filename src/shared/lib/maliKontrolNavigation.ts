import type {
  MaliKontrolActionPayload,
  MaliKontrolActionTarget,
  MaliKontrolDosyaTab,
  MaliKontrolUyari,
} from "../types/maliKontrol";

export type DosyaFocusKind = "taksit" | "odeme" | "kasa";

/** SaaS maliKontrolNavigation paritesi — DOM id: dosya-focus-{kind}-{id} */
export function dosyaFocusElementId(kind: DosyaFocusKind, id: number | string): string {
  return `dosya-focus-${kind}-${id}`;
}

export function buildDosyaFocusParam(kind: DosyaFocusKind, id: number | string): string {
  return `${kind}:${id}`;
}

export function parseDosyaFocusParam(focus: string): { kind: DosyaFocusKind; id: string } | null {
  const m = /^(taksit|odeme|kasa):(.+)$/.exec((focus ?? "").trim());
  if (!m) return null;
  const id = m[2];
  if (!id) return null;
  return { kind: m[1] as DosyaFocusKind, id };
}

/**
 * Desktop dosya detayında SaaS'taki kasa/vekalet/smm/makbuz sekmeleri "genel"
 * sekmesindeki panellerde yer alır; mali özet ayrı sekmededir.
 */
export const ACTION_TARGET_TAB: Record<MaliKontrolActionTarget, MaliKontrolDosyaTab> = {
  VEKALET_TAKSIT: "genel",
  DOSYA_VEKALET: "genel",
  SMM_ODEME: "genel",
  MAKBUZ_ODEME: "genel",
  KASA_HAREKET: "genel",
  DOSYA_MALI: "maliOzet",
  DOSYA_GENEL: "genel",
};

export function canNavigateMaliKontrolUyari(
  u: MaliKontrolUyari,
): u is MaliKontrolUyari & { actionPayload: MaliKontrolActionPayload } {
  const p = u.actionPayload;
  return Boolean(p && Number.isFinite(p.muvekkilId) && Number.isFinite(p.dosyaId));
}

/** `/muvekkil/{muvekkilId}/dosya/{dosyaId}?tab=…&focus=…` */
export function buildMaliKontrolNavigateUrl(payload: MaliKontrolActionPayload): string {
  const params = new URLSearchParams();
  params.set("tab", payload.tab);
  if (payload.taksitId != null) {
    params.set("focus", buildDosyaFocusParam("taksit", payload.taksitId));
  } else if (payload.odemeId != null) {
    params.set("focus", buildDosyaFocusParam("odeme", payload.odemeId));
  } else if (payload.kasaHareketiId != null) {
    params.set("focus", buildDosyaFocusParam("kasa", payload.kasaHareketiId));
  }
  if (payload.kasaFilter) params.set("kasaFilter", payload.kasaFilter);
  return `/muvekkil/${payload.muvekkilId}/dosya/${payload.dosyaId}?${params.toString()}`;
}
