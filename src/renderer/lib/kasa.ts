import { DIGER_MASRAF_ETIKETI, DIGER_ODEME_YONTEMI_ETIKETI, MASRAF_ODEME_YONTEMI_SECENEKLERI, ODEME_YONTEMI_ETIKET } from "@shared/constants/kasa";
import type { KasaHareket, KasaIslemTipi } from "@shared/types/kasa";
import { formatTry } from "./format";

export type KasaListeFiltre =
  | "tum"
  | "avans"
  | "masraf"
  | "onaysiz"
  | "onayli"
  | "reddedilen";

export function tipEtiket(tip: KasaIslemTipi): string {
  if (tip === "AVANS_GIRISI") return "Avans";
  if (tip === "MASRAF") return "Masraf";
  return "Düzeltme";
}

export function odemeEtiket(kod: string): string {
  return ODEME_YONTEMI_ETIKET[kod as keyof typeof ODEME_YONTEMI_ETIKET] ?? kod;
}

/** Masraf formunda kayıtlı ödeme yöntemini select + diğer alanına çöz. */
export function masrafOdemeFormFromKayit(stored: string | null | undefined): { select: string; diger: string } {
  const raw = String(stored ?? "").trim();
  if (!raw) return { select: "Nakit", diger: "" };
  if (raw === "NAKIT") return { select: "Nakit", diger: "" };
  const presets = MASRAF_ODEME_YONTEMI_SECENEKLERI as readonly string[];
  if (presets.includes(raw) && raw !== DIGER_ODEME_YONTEMI_ETIKETI) {
    return { select: raw, diger: "" };
  }
  const label = odemeEtiket(raw);
  if (label === DIGER_ODEME_YONTEMI_ETIKETI || raw === "DIGER") {
    return { select: DIGER_ODEME_YONTEMI_ETIKETI, diger: "" };
  }
  return { select: DIGER_ODEME_YONTEMI_ETIKETI, diger: label };
}

/** Select + diğer alanından kayda yazılacak ödeme yöntemi. */
export function masrafOdemeKayitDegeri(select: string, diger: string): string | null {
  if (select === DIGER_ODEME_YONTEMI_ETIKETI) {
    const t = diger.trim();
    return t || null;
  }
  const s = select.trim();
  return s || null;
}

export function onayBadgeClass(h: KasaHareket): string {
  if (h.onayDurumu === "ONAYSIZ") return "badge-onaysiz";
  if (h.onayDurumu === "REDDEDILDI") return "badge-reddedildi";
  if (h.otomatikOnayMi) return "badge-otomatik-onay";
  return "badge-onayli";
}

export function onayBadgeMetni(h: KasaHareket): string {
  if (h.onayDurumu === "ONAYSIZ") return "Onaysız";
  if (h.onayDurumu === "REDDEDILDI") return "Reddedildi";
  if (h.otomatikOnayMi) return "Otomatik onaylı";
  return "Onaylı";
}

export function kasaHareketSatirSinifi(h: KasaHareket): string {
  const parcalar: string[] = [];
  if (h.duzeltmeMi) parcalar.push("desk-row-correction");
  else if (h.hasCorrection) parcalar.push("desk-row-corrected");
  return parcalar.join(" ");
}

export function hareketAciklamaMasraf(h: KasaHareket): string {
  if (h.islemTipi === "MASRAF") {
    const tur = (h.masrafTuru ?? "").trim();
    const ac = (h.aciklama ?? "").trim();
    if (tur && ac) return `${tur} — ${ac}`;
    return tur || ac || "—";
  }
  if (h.islemTipi === "DUZELTME") return (h.aciklama ?? "").trim() || "—";
  return (h.aciklama ?? "").trim() || "—";
}

export function masrafKayitTuruFromForm(select: string, diger: string): string | null {
  if (!select.trim()) return null;
  if (select === DIGER_MASRAF_ETIKETI) {
    const t = diger.trim();
    return t || null;
  }
  return select.trim();
}

export function masrafDuzenlemeSelectDiger(
  kayitTuru: string | null | undefined,
  liste: string[]
): { select: string; diger: string } {
  const t = (kayitTuru ?? "").trim();
  if (!t) return { select: liste[0] ?? DIGER_MASRAF_ETIKETI, diger: "" };
  if (liste.includes(t)) return { select: t, diger: "" };
  return { select: DIGER_MASRAF_ETIKETI, diger: t };
}

export function kasaHareketleriFiltrele(
  liste: KasaHareket[],
  arama: string,
  filtre: KasaListeFiltre
): KasaHareket[] {
  let rows = [...liste];
  if (filtre === "avans") rows = rows.filter((h) => h.islemTipi === "AVANS_GIRISI");
  else if (filtre === "masraf") rows = rows.filter((h) => h.islemTipi === "MASRAF");
  else if (filtre === "onaysiz") rows = rows.filter((h) => h.onayDurumu === "ONAYSIZ");
  else if (filtre === "onayli") rows = rows.filter((h) => h.onayDurumu === "ONAYLI");
  else if (filtre === "reddedilen") rows = rows.filter((h) => h.onayDurumu === "REDDEDILDI");

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  if (!q) return rows;

  return rows.filter((h) => {
    const parcalar = [
      h.belgeNo ?? "",
      h.aciklama ?? "",
      h.masrafTuru ?? "",
      h.tarih ?? "",
      odemeEtiket(h.odemeYontemi),
      h.odemeYontemi,
      String(h.tutar),
      formatTry(h.tutar),
      tipEtiket(h.islemTipi),
    ];
    return parcalar.some((p) => p.toLocaleLowerCase("tr-TR").includes(q));
  });
}
