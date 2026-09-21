export type HtmlToPdfOpts = { page: "A4" | "A5"; landscape: boolean };

export type RaporCategoryId =
  | "ofis-kasa"
  | "icra-tahsilat"
  | "hesap-ozeti"
  | "kasa-makbuz"
  | "vekalet-makbuz";

export type RaporNavItem = {
  id: RaporCategoryId;
  label: string;
  description: string;
  icon: string;
};

export const RAPOR_NAV: RaporNavItem[] = [
  {
    id: "ofis-kasa",
    label: "Ofis Kasası Raporu",
    description: "Seçili tarih aralığındaki gelir, gider ve kasa hareketleri.",
    icon: "wallet",
  },
  {
    id: "icra-tahsilat",
    label: "İcra Tahsilat Raporu",
    description: "Alacak listesi, tahsilat durumu ve dönem özeti.",
    icon: "scale",
  },
  {
    id: "hesap-ozeti",
    label: "Dosya Hesap Özeti",
    description: "Müvekkil dosyası kasa özeti ve hareket ekstresi.",
    icon: "file",
  },
  {
    id: "kasa-makbuz",
    label: "Kasa Makbuzu",
    description: "Onaylı avans, masraf ve düzeltme tahsilat makbuzu.",
    icon: "receipt",
  },
  {
    id: "vekalet-makbuz",
    label: "Vekalet Ödeme Makbuzu",
    description: "Vekalet taksit ödeme kaydı tahsilat makbuzu.",
    icon: "stamp",
  },
];
