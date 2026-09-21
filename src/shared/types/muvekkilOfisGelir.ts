export type MuvekkilOfisGelirSatir = {
  id: number;
  tarih: string;
  belgeNo: string | null;
  kategori: string;
  ozelKategoriAdi: string | null;
  aciklama: string | null;
  odemeYontemi: string;
  tahsilatiYapanKullaniciAdi: string | null;
  tutar: number;
  paraBirimi: string;
  islemTipi: string;
  kaynakTipi: string | null;
};

export type MuvekkilOfisGelirListe = {
  items: MuvekkilOfisGelirSatir[];
  total: number;
  page: number;
  pageSize: number;
};
