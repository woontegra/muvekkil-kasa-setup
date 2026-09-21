/**
 * SaaS rol/yetki matrisi paritesi — tek kaynak.
 * IPC tarafı (src/main/ipc/moduleAuthorization.policy.ts) asıl yetki kapısıdır;
 * buradaki yardımcılar hem main hem renderer için aynı kararı üretir.
 */
import type { KullaniciRolu } from "@shared/types/auth";

export function isBuroSahibi(rol: KullaniciRolu | null | undefined): boolean {
  return rol === "BURO_SAHIBI";
}

export function isYonetici(rol: KullaniciRolu | null | undefined): boolean {
  return rol === "BURO_SAHIBI" || rol === "AVUKAT_YONETICI";
}

export function isKatip(rol: KullaniciRolu | null | undefined): boolean {
  return rol === "KATIP_PERSONEL";
}

/** Müvekkil/dosya üst bilgisi düzenleme — kâtip yapamaz. */
export function canEditMuvekkilDosya(rol: KullaniciRolu | null | undefined): boolean {
  return isYonetici(rol);
}

/** Kasa / ofis kasası onay ve silme. */
export function canOnaylaSil(rol: KullaniciRolu | null | undefined): boolean {
  return isYonetici(rol);
}

/** Vekalet ücreti kaydet/güncelle ve mali kontrol işlemleri. */
export function canMaliKontrol(rol: KullaniciRolu | null | undefined): boolean {
  return isYonetici(rol);
}

/** Hesap dönemi modu, denetim kayıtları, kullanıcı listesi. */
export function canYonetimGoruntule(rol: KullaniciRolu | null | undefined): boolean {
  return isYonetici(rol);
}

/** Güvenli sil (gerekçeli iptal) akışları — yalnız büro sahibi. */
export function canGuvenliSil(rol: KullaniciRolu | null | undefined): boolean {
  return isBuroSahibi(rol);
}

/** Kullanıcı oluştur/pasifleştir/şifre sıfırla — yalnız büro sahibi. */
export function canKullaniciYonet(rol: KullaniciRolu | null | undefined): boolean {
  return isBuroSahibi(rol);
}

/** Gelir/gider kalemi ekle-düzenle-arşivle — yalnız büro sahibi. */
export function canFinansKalemiYonet(rol: KullaniciRolu | null | undefined): boolean {
  return isBuroSahibi(rol);
}

/** Yedek al / geri yükle — yalnız büro sahibi. */
export function canYedekYonet(rol: KullaniciRolu | null | undefined): boolean {
  return isBuroSahibi(rol);
}

/** Müvekkil/dosya/kasa/randevu kaydı oluşturma — üç rol de yapabilir. */
export function canKayitOlustur(rol: KullaniciRolu | null | undefined): boolean {
  return rol != null;
}
