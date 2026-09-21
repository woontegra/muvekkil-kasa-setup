export type SettingsCategoryId =
  | "office"
  | "period"
  | "logo"
  | "kalemler"
  | "kullanicilar"
  | "denetim"
  | "backup"
  | "security"
  | "update"
  | "license";

export type SettingsNavItem = {
  id: SettingsCategoryId;
  label: string;
  icon: string;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "office", label: "Ofis Bilgileri", icon: "building" },
  { id: "period", label: "Hesap Dönemi", icon: "calendar" },
  { id: "logo", label: "Logo ve Görünüm", icon: "image" },
  { id: "kalemler", label: "Gelir ve Gider Kalemleri", icon: "list" },
  { id: "kullanicilar", label: "Kullanıcılar", icon: "users" },
  { id: "denetim", label: "Denetim Kayıtları", icon: "shield" },
  { id: "backup", label: "Veri Yedekleme", icon: "database" },
  { id: "security", label: "Güvenlik", icon: "lock" },
  { id: "update", label: "Uygulama ve Güncelleme", icon: "refresh" },
  { id: "license", label: "Lisans", icon: "key" },
];
