import type { TahsilatMerkeziGorunumFilter } from "../types/tahsilatMerkezi";

export const TAKSILAT_MERKEZI_GORUNUM_LABEL: Record<TahsilatMerkeziGorunumFilter, string> = {
  GECIKENLER: "Gecikenler",
  BUGUN: "Bugün",
  YAKLASANLAR: "Yaklaşanlar",
  KISMI_ODENENLER: "Kısmi ödenenler",
  TUMU: "Tümü",
};

export const TAKSILAT_MERKEZI_GORUNUMLER: TahsilatMerkeziGorunumFilter[] = [
  "GECIKENLER",
  "BUGUN",
  "YAKLASANLAR",
  "KISMI_ODENENLER",
  "TUMU",
];
