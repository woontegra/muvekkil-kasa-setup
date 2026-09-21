export type DosyaMaliOzetPayload = {
  kararlastirilanVekalet: string;
  tahsilEdilenVekalet: string;
  kalanVekalet: string;
  tahsilatOrani: number;
  alinanMasrafAvansi: string;
  toplamMasraf: string;
  duzeltmeEtkisi: string;
  masrafAvansiIadesi: string;
  kalanMasrafAvansi: string;
  buroKarsiladigiGider: string;
  netKazanc: string;
};

export type DosyaMaliOzetResponse = {
  tumZamanlar: DosyaMaliOzetPayload;
  buDonem: DosyaMaliOzetPayload | null;
  donemEtiketi: string | null;
};

export type DosyaMaliOzetSonuc =
  | { ok: true; data: DosyaMaliOzetResponse }
  | { ok: false; error: string; mesaj?: string };
