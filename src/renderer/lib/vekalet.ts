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
