import type { ParaBirimi } from "../lib/paraBirimi";

export type MuvekkilEkstreDurumLabel =
  | "Tam Ödendi"
  | "Kısmi Ödendi"
  | "Gecikmiş"
  | "Bekliyor"
  | "İptal";

export type MuvekkilEkstrePayload = {
  belgeRef: string;
  ekstreTarihi: string;
  itibariyleTarih: string;
  itibariyleAciklama: string;
  buro: {
    buroAdi: string;
    telefon: string | null;
    eposta: string | null;
    adres: string | null;
  };
  muvekkil: {
    id: number;
    gorunenAd: string;
    telefonVar: boolean;
  };
  dosya: {
    id: number;
    konuBasligi: string;
    dosyaNo: string | null;
    mahkeme: string | null;
    icraDairesi: string | null;
  };
  vekaletOzeti: {
    paraBirimi: ParaBirimi;
    kararlastirilanToplam: string;
    tahsilEdilenToplam: string;
    kalanToplam: string;
    tahsilatOrani: number;
    gecikmisToplam: string;
    sonrakiTaksitVade: string | null;
    sonrakiTaksitTutar: string | null;
  };
  taksitler: Array<{
    id: number;
    taksitNo: number;
    vadeTarihi: string;
    taksitTutari: string;
    odenenToplam: string;
    kalanTutar: string;
    durum: MuvekkilEkstreDurumLabel;
    iptalMi: boolean;
    odemeler: Array<{
      id: number;
      odemeTarihi: string;
      tutar: string;
      alacakParaBirimi: ParaBirimi;
      odemeParaBirimi: ParaBirimi;
      kasaTutari: string;
      kur: string | null;
      kurOzeti: string | null;
      caprazOzet: string | null;
      odemeYontemi: string;
      makbuzNo: string;
      aciklama: string | null;
    }>;
  }>;
  masrafAvansiOzeti: {
    toplamAlinanAvans: string;
    toplamMasraf: string;
    pozitifDuzeltme: string;
    negatifDuzeltme: string;
    muvekkileIade: string;
    guncelBakiye: string;
  };
  masrafHareketleri: Array<{
    id: number;
    tarih: string;
    belgeNo: string;
    islemTuru: string;
    aciklama: string | null;
    giris: string;
    cikis: string;
    bakiyeSonrasi: string;
  }>;
  dosyaDisiOfisGelirleri: {
    toplam: string;
    byCurrency: Record<
      ParaBirimi,
      {
        toplam: string;
        hareketler: Array<{
          id: number;
          tarih: string;
          belgeNo: string;
          kategori: string;
          aciklama: string | null;
          odemeYontemi: string;
          personelAd: string | null;
          tutar: string;
          paraBirimi: ParaBirimi;
        }>;
      }
    >;
    hareketler: Array<{
      id: number;
      tarih: string;
      belgeNo: string;
      kategori: string;
      aciklama: string | null;
      odemeYontemi: string;
      personelAd: string | null;
      tutar: string;
      paraBirimi: ParaBirimi;
    }>;
  };
  dipnot: string;
};

export type MuvekkilEkstreSonuc =
  | { ok: true; data: MuvekkilEkstrePayload }
  | { ok: false; error: string; mesaj?: string };
