import type { ParaBirimi } from "../lib/paraBirimi";

export type UyariSeviyesi = "KRITIK" | "UYARI" | "BILGI";

export type UyariTuru =
  | "VADESI_GECMIS_TAKSIT"
  | "KISMI_ODEME_KALAN"
  | "VAKLASAN_VADE"
  | "NEGATIF_AVANS"
  | "KAPALI_DOSYA_AVANS"
  | "KAPALI_DOSYA_ALACAK"
  | "SMM_KESILMEMIS"
  | "ONAY_BEKLEYEN_KASA"
  | "MAKBUZ_EKSIK"
  | "HAREKETSIZ_DOSYA";

export type MaliKontrolActionTarget =
  | "VEKALET_TAKSIT"
  | "DOSYA_VEKALET"
  | "SMM_ODEME"
  | "MAKBUZ_ODEME"
  | "KASA_HAREKET"
  | "DOSYA_MALI"
  | "DOSYA_GENEL";

/** Desktop dosya detay sekmeleri (DosyaDetailTabBar ile aynı anahtarlar). */
export type MaliKontrolDosyaTab = "genel" | "maliOzet" | "ekstre";

export type MaliKontrolActionPayload = {
  muvekkilId: number;
  dosyaId: number;
  tab: MaliKontrolDosyaTab;
  taksitId?: number;
  odemeId?: number;
  kasaHareketiId?: number;
  kasaFilter?: "onaysiz";
};

export type MaliKontrolUyari = {
  id: string;
  tur: UyariTuru;
  seviye: UyariSeviyesi;
  muvekkilId: number | null;
  muvekkilAd: string;
  dosyaId: number | null;
  dosyaBaslik: string;
  tutar: string | null;
  paraBirimi: ParaBirimi | null;
  tarih: string | null;
  aciklama: string;
  actionTarget: MaliKontrolActionTarget | null;
  actionPayload: MaliKontrolActionPayload | null;
};

export type MaliKontrolResponse = {
  toplamUyari: number;
  kritikUyari: number;
  uyariUyari: number;
  bilgiUyari: number;
  uyarilar: MaliKontrolUyari[];
};

export type MaliKontrolSonuc =
  | { ok: true; data: MaliKontrolResponse }
  | { ok: false; error: "YETKISIZ" | "OTURUM_YOK" | "HATA"; mesaj: string };

export const UYARI_TUR_ETIKET: Record<UyariTuru, string> = {
  VADESI_GECMIS_TAKSIT: "Vadesi geçmiş taksit",
  KISMI_ODEME_KALAN: "Kısmi ödeme bakiyesi",
  VAKLASAN_VADE: "Yaklaşan vade",
  NEGATIF_AVANS: "Negatif avans",
  KAPALI_DOSYA_AVANS: "Kapalı dosya avansı",
  KAPALI_DOSYA_ALACAK: "Kapalı dosya alacağı",
  SMM_KESILMEMIS: "SMM kesilmemiş",
  ONAY_BEKLEYEN_KASA: "Onay bekleyen",
  MAKBUZ_EKSIK: "Makbuz eksik",
  HAREKETSIZ_DOSYA: "Hareketsiz dosya",
};

export const UYARI_SEVIYE_ETIKET: Record<UyariSeviyesi, string> = {
  KRITIK: "Kritik",
  UYARI: "Uyarı",
  BILGI: "Bilgi",
};

/** Mali Kontrol Merkezi yalnızca büro sahibi ve yönetici avukat içindir. */
export const MALI_KONTROL_YETKILI_ROLLER = ["BURO_SAHIBI", "AVUKAT_YONETICI"] as const;

export function maliKontrolYetkiliMi(rol: string | null | undefined): boolean {
  const r = (rol ?? "").trim();
  return (MALI_KONTROL_YETKILI_ROLLER as readonly string[]).includes(r);
}
