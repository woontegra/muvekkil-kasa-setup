export function ofisKasaRaporUrl(bas: string, bit: string): string {
  return `/print/ofis-kasa-raporu?bas=${encodeURIComponent(bas)}&bit=${encodeURIComponent(bit)}`;
}

export type RaporPrintNavState = { autoPrint?: boolean };

export function icraTahsilatRaporUrl(filtre: {
  tarihBas: string;
  tarihBit: string;
  alacakTuru: string;
  durum: string;
  q: string;
}): string {
  const qs = new URLSearchParams({
    bas: filtre.tarihBas,
    bit: filtre.tarihBit,
    tur: filtre.alacakTuru,
    durum: filtre.durum,
    q: filtre.q,
  });
  return `/print/icra-tahsilat-raporu?${qs.toString()}`;
}

export function hesapOzetUrl(dosyaId: number): string {
  return `/print/hesap-ozeti/${dosyaId}`;
}

export function kasaMakbuzUrl(hareketId: number): string {
  return `/print/makbuz/kasa/${hareketId}`;
}

export function vekaletMakbuzUrl(odemeId: number): string {
  return `/print/makbuz/vekalet/${odemeId}`;
}
