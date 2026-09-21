import {
  ICRA_ALACAK_DURUM_ETIKET,
  ICRA_ALACAK_TURU_ETIKET,
  type IcraAlacakDurumKodu,
  type IcraAlacakTuruKodu,
} from "@shared/constants/icraTahsilat";
import type { IcraTaksitDurum, IcraTaksitSmmDurum } from "@shared/types/icraTahsilat";

export function icraAlacakTuruEtiket(t: IcraAlacakTuruKodu): string {
  return ICRA_ALACAK_TURU_ETIKET[t] ?? t;
}

export function icraAlacakDurumEtiket(d: IcraAlacakDurumKodu): string {
  return ICRA_ALACAK_DURUM_ETIKET[d] ?? d;
}

export function icraAlacakDurumBadgeClass(d: IcraAlacakDurumKodu): string {
  switch (d) {
    case "ODENDI":
      return "badge-taksit-yaklasiyor";
    case "GECIKTI":
      return "badge-taksit-gecmis";
    case "KISMI_ODENDI":
      return "badge-taksit-bugun";
    case "IPTAL":
      return "desk-badge-duzeltildi";
    default:
      return "badge-taksit-odenmedi";
  }
}

export function icraTaksitDurumEtiket(d: IcraTaksitDurum): string {
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

export function icraTaksitDurumBadgeClass(d: IcraTaksitDurum): string {
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

export function icraTaksitSmmHucre(smm: IcraTaksitSmmDurum): { label: string; className: string; blink: boolean } {
  if (smm === "BEKLIYOR") {
    return { label: "SMM bekliyor", className: "desk-blink-warning", blink: true };
  }
  if (smm === "KESILDI") {
    return { label: "SMM kesildi", className: "desk-smm-ok-badge", blink: false };
  }
  return { label: "—", className: "", blink: false };
}

export function ilgiliMuvekkilDosyaMetni(
  muvekkilAdi: string | null,
  dosyaKonu: string | null,
): string {
  const m = (muvekkilAdi ?? "").trim();
  const d = (dosyaKonu ?? "").trim();
  if (m && d) return `${m} / ${d}`;
  if (m) return m;
  if (d) return d;
  return "—";
}
