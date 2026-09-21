import type { KarlilikCurrency, MoneyByCurrency } from "../lib/karlilikParaBirimi";
import type { DosyaDurum } from "./dosya";

export type MuvekkilKarlilikDosya = {
  dosyaId: number;
  konuBasligi: string;
  dosyaNo: string | null;
  durum: DosyaDurum;
  paraBirimi: KarlilikCurrency;
  tahsilEdilenVekalet: string;
  buroKarsiladigiGider: string;
  netKazanc: string;
};

export type MuvekkilKarlilikDagilim = {
  enYuksekKazanc: MuvekkilKarlilikDosya | null;
  enDusukKazanc: MuvekkilKarlilikDosya | null;
};

export type MuvekkilKarlilikPayload = {
  toplamDosya: number;
  kararlastirilanVekalet: MoneyByCurrency;
  tahsilEdilenVekalet: MoneyByCurrency;
  kalanAlacak: MoneyByCurrency;
  /** Dosya kasası avans bakiyesi — yalnızca TRY. */
  toplamAvansBakiye: string;
  /** Dosya kasası masraf toplamı — yalnızca TRY. */
  toplamDosyaMasrafi: string;
  /** Negatif düzeltmelerin mutlak toplamı — müvekkile iade edilen avans (TRY). */
  toplamMasrafAvansiIadesi: string;
  /** Ofis kasası manuel onaylı gelir (kaynaksız) + bağlı düzeltme neti. */
  ofisGeliri: MoneyByCurrency;
  /** Dosya kasasında büronun karşıladığı (TRY) + müvekkile bağlı onaylı ofis gideri. */
  gider: MoneyByCurrency;
  /** Gelir − gider; para birimleri toplanmaz. */
  netKazanc: MoneyByCurrency;
  kazancDagilimi: Record<KarlilikCurrency, MuvekkilKarlilikDagilim | null>;
};

export type MuvekkilKarlilikResponse = {
  tumZamanlar: MuvekkilKarlilikPayload;
  buDonem: MuvekkilKarlilikPayload | null;
  donemEtiketi: string | null;
};

export type MuvekkilKarlilikSonuc =
  | { ok: true; data: MuvekkilKarlilikResponse }
  | { ok: false; error: string; mesaj?: string };
