import { IPC } from "@shared/ipc";
import type { KullaniciRolu } from "@shared/types/auth";
import { ALL_IPC_CHANNELS, classifyLicenseIpcChannel } from "./licenseAuthorization.policy";

/**
 * SaaS modül yetki matrisi paritesi.
 *
 * - PUBLIC        : rol gerektirmez (auth/lisans/güncelleme/uygulama kanalları).
 *                   Lisans katmanı bu kanalları oturumsuz da geçirdiği için burada da serbest kalır.
 * - ALL_ROLES     : büro sahibi + avukat/yönetici + kâtip/personel
 * - YONETICI      : büro sahibi + avukat/yönetici
 * - BURO_SAHIBI   : yalnız büro sahibi
 *
 * Sınıflanmamış kanal DENY olur (fail-closed).
 */
export type ModuleIpcClass = "PUBLIC" | "ALL_ROLES" | "YONETICI" | "BURO_SAHIBI";

export const MODULE_FORBIDDEN_ERROR = "FORBIDDEN_ROLE";

/** Üç rolün de çağırabildiği okuma + kayıt oluşturma kanalları. */
const ALL_ROLES_CHANNELS = new Set<string>([
  IPC.auth.guvenlikBilgisi,
  IPC.auth.guvenlikGuncelle,
  IPC.auth.sifreGuncelle,

  IPC.office.get,
  IPC.office.logoDataUrl,
  IPC.appSettings.getAccountingPeriodMode,

  IPC.ofisKasa.list,
  IPC.ofisKasa.ustOzet,
  IPC.ofisKasa.anaSayfaOzet,
  IPC.ofisKasa.raporPaketi,
  IPC.ofisKasa.ekle,

  IPC.kurlar.tcmb,
  IPC.kurlar.tcmbCapraz,
  IPC.kurlar.yaklasikTry,

  IPC.muvekkil.ara,
  IPC.muvekkil.araPaged,
  IPC.muvekkil.get,
  IPC.muvekkil.ekle,
  IPC.muvekkil.karlilik,
  IPC.muvekkil.ofisGelirleri,

  IPC.dosya.list,
  IPC.dosya.listAll,
  IPC.dosya.get,
  IPC.dosya.ekle,
  IPC.dosya.hesapOzetPaketi,
  IPC.dosya.maliOzet,
  IPC.dosya.muvekkilEkstre,

  IPC.kasa.list,
  IPC.kasa.ozet,
  IPC.kasa.ekle,
  IPC.masrafTurleri,

  IPC.tahsilatMerkezi.ozet,
  IPC.tahsilatMerkezi.list,

  IPC.icraTahsilat.ustOzet,
  IPC.icraTahsilat.list,
  IPC.icraTahsilat.alacakOlustur,
  IPC.icraTahsilat.taksitList,
  IPC.icraTahsilat.taksitOdemeAl,
  IPC.icraTahsilat.taksitOdemeGecmisi,
  IPC.icraTahsilat.smmKesildi,

  IPC.randevu.list,
  IPC.randevu.get,
  IPC.randevu.olustur,
  IPC.randevu.guncelle,
  IPC.randevu.sil,
  IPC.randevu.kullanicilar,

  IPC.vekalet.getOrCreate,
  IPC.vekalet.byDosya,
  IPC.vekalet.taksitList,
  IPC.vekalet.taksitEkle,
  IPC.vekalet.taksitOdemeAl,
  IPC.vekalet.taksitOdemeGuncelle,
  IPC.vekalet.taksitOdemeGecmisi,
  IPC.vekalet.smmBekleyenler,
  IPC.vekalet.smmKesildi,
  IPC.vekalet.taksitUyariOzet,

  IPC.print.getPrinters,
  IPC.print.document,
  IPC.print.htmlToPdf,
  IPC.print.pdf,
  IPC.makbuz.ensureReceiptNumber,
  IPC.makbuz.getReceiptData,
  IPC.makbuz.yazdirmaPaketi,
  IPC.vekaletMakbuz.ensureReceiptNumber,
  IPC.vekaletMakbuz.getPrintPackage,
  IPC.vekaletMakbuz.getPrintPackageByOdemeId,

  IPC.finansKalemi.list,
]);

/** Büro sahibi + avukat/yönetici: düzenleme, onay, silme, mali kontrol, yönetim görünümleri. */
const YONETICI_CHANNELS = new Set<string>([
  IPC.office.save,
  IPC.office.pickLogo,
  IPC.appSettings.setAccountingPeriodMode,

  IPC.muvekkil.guncelle,
  IPC.dosya.guncelle,

  IPC.kasa.guncelle,
  IPC.kasa.sil,
  IPC.kasa.onayla,

  IPC.ofisKasa.guncelle,
  IPC.ofisKasa.sil,
  IPC.ofisKasa.onayla,
  IPC.ofisKasa.duzeltmeEkle,
  IPC.ofisKasa.dovizDonusum,
  IPC.ofisKasa.dovizDonusumSil,

  IPC.vekalet.kaydet,
  IPC.vekalet.guncelle,
  IPC.vekalet.taksitGuncelle,
  IPC.vekalet.taksitSil,
  IPC.vekalet.taksitleriTopluSil,

  IPC.icraTahsilat.taksitGuncelle,
  IPC.icraTahsilat.taksitSil,
  IPC.icraTahsilat.alacakIptal,

  IPC.audit.list,
  IPC.kullaniciYonetim.list,

  IPC.maliKontrol.uyarilar,
]);

/** Yalnız büro sahibi: güvenli sil, kullanıcı yönetimi, kalem mutasyonu, yedekleme. */
const BURO_SAHIBI_CHANNELS = new Set<string>([
  IPC.kasa.guvenliSil,
  IPC.ofisKasa.guvenliSil,
  IPC.vekalet.guvenliSilTaksit,
  IPC.vekalet.guvenliSilTahsilat,

  IPC.kullaniciYonetim.create,
  IPC.kullaniciYonetim.setAktif,
  IPC.kullaniciYonetim.resetSifre,

  IPC.finansKalemi.create,
  IPC.finansKalemi.update,
  IPC.finansKalemi.archive,
  IPC.finansKalemi.activate,
  IPC.finansKalemi.reorder,

  IPC.backup.al,
  IPC.backup.geriYukle,
]);

export function classifyModuleIpcChannel(channel: string): ModuleIpcClass | "UNKNOWN" {
  if (BURO_SAHIBI_CHANNELS.has(channel)) return "BURO_SAHIBI";
  if (YONETICI_CHANNELS.has(channel)) return "YONETICI";
  if (ALL_ROLES_CHANNELS.has(channel)) return "ALL_ROLES";
  // Lisans katmanının oturumsuz geçirdiği kanallar rol de istemez.
  if (classifyLicenseIpcChannel(channel) === "PUBLIC") return "PUBLIC";
  if (classifyLicenseIpcChannel(channel) === "SETUP") return "PUBLIC";
  return "UNKNOWN";
}

/** Matriste yeri olmayan kanallar — regresyon testi için. */
export function listUnclassifiedModuleIpcChannels(): string[] {
  return ALL_IPC_CHANNELS.filter((ch) => classifyModuleIpcChannel(ch) === "UNKNOWN");
}

export function decideModuleIpcAccess(
  channel: string,
  ctx: { rol: KullaniciRolu | null },
): "ALLOW" | "DENY" {
  const cls = classifyModuleIpcChannel(channel);
  if (cls === "PUBLIC") return "ALLOW";
  if (cls === "UNKNOWN") return "DENY";
  const rol = ctx.rol;
  if (rol == null) return "DENY";
  if (cls === "BURO_SAHIBI") return rol === "BURO_SAHIBI" ? "ALLOW" : "DENY";
  if (cls === "YONETICI") {
    return rol === "BURO_SAHIBI" || rol === "AVUKAT_YONETICI" ? "ALLOW" : "DENY";
  }
  return rol === "BURO_SAHIBI" || rol === "AVUKAT_YONETICI" || rol === "KATIP_PERSONEL"
    ? "ALLOW"
    : "DENY";
}
