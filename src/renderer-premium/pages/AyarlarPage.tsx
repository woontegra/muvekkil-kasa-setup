import { useState } from "react";
import { SettingsNav } from "../components/settings/SettingsNav";
import { SettingsBackupSection } from "../components/settings/SettingsBackupSection";
import { SettingsLicenseSection } from "../components/settings/SettingsLicenseSection";
import { SettingsLogoSection } from "../components/settings/SettingsLogoSection";
import { SettingsOfficeSection } from "../components/settings/SettingsOfficeSection";
import { SettingsPeriodSection } from "../components/settings/SettingsPeriodSection";
import { SettingsSecuritySection } from "../components/settings/SettingsSecuritySection";
import { SettingsUpdateSection } from "../components/settings/SettingsUpdateSection";
import { SettingsKalemleriSection } from "../components/settings/SettingsKalemleriSection";
import { SettingsDenetimSection } from "../components/settings/SettingsDenetimSection";
import { SettingsKullanicilarSection } from "../components/settings/SettingsKullanicilarSection";
import type { SettingsCategoryId } from "../components/settings/settingsTypes";

function renderSection(id: SettingsCategoryId) {
  switch (id) {
    case "office":
      return <SettingsOfficeSection />;
    case "period":
      return <SettingsPeriodSection />;
    case "logo":
      return <SettingsLogoSection />;
    case "kalemler":
      return <SettingsKalemleriSection />;
    case "kullanicilar":
      return <SettingsKullanicilarSection />;
    case "denetim":
      return <SettingsDenetimSection />;
    case "backup":
      return <SettingsBackupSection />;
    case "security":
      return <SettingsSecuritySection />;
    case "update":
      return <SettingsUpdateSection />;
    case "license":
      return <SettingsLicenseSection />;
    default:
      return null;
  }
}

export function AyarlarPage() {
  const [category, setCategory] = useState<SettingsCategoryId>("office");

  return (
    <div className="pm-settings-page pm-page-enter">
      <div className="pm-settings-layout">
        <SettingsNav active={category} onChange={setCategory} />
        <div key={category} className="pm-settings-content pm-settings-content--enter">
          {renderSection(category)}
        </div>
      </div>
    </div>
  );
}
