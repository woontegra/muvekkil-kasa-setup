import { Navigate, Route, Routes } from "react-router-dom";
import { PremiumLicenseGate, PremiumLicenseGuestRoute } from "./PremiumLicenseGate";
import {
  PremiumGuestAuthRoute,
  PremiumProtectedRoute,
  PremiumSetupOnlyRoute,
} from "./PremiumProtectedRoute";
import { PremiumShell } from "./PremiumShell";
import { LicenseActivatePage } from "../pages/license/LicenseActivatePage";
import { LicenseChoicePage } from "../pages/license/LicenseChoicePage";
import { LicenseTrialSetupPage } from "../pages/license/LicenseTrialSetupPage";
import { SetupPage } from "../pages/auth/SetupPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";
import { OverviewPage } from "../pages/OverviewPage";
import { MuvekkillerPage } from "../pages/MuvekkillerPage";
import { OfisKasaPage } from "../pages/OfisKasaPage";
import { IcraTahsilatPage } from "../pages/IcraTahsilatPage";
import { TahsilatMerkeziPage } from "../pages/TahsilatMerkeziPage";
import { DosyalarPage } from "../pages/DosyalarPage";
import { RandevularPage } from "../pages/RandevularPage";
import { RaporlarPage } from "../pages/RaporlarPage";
import { AyarlarPage } from "../pages/AyarlarPage";
import { MuvekkilDetailPage } from "../pages/MuvekkilDetailPage";
import { DosyaDetailPage } from "../pages/DosyaDetailPage";
import { PremiumBelgePrintPage } from "../pages/print/PremiumBelgePrintPage";
import { PremiumOfisKasaRaporPrintPage } from "../pages/print/PremiumOfisKasaRaporPrintPage";
import { PremiumIcraTahsilatRaporPrintPage } from "../pages/print/PremiumIcraTahsilatRaporPrintPage";
import { PremiumMuvekkilEkstrePrintPage } from "../pages/print/PremiumMuvekkilEkstrePrintPage";

export function PremiumRouter() {
  return (
    <Routes>
      <Route element={<PremiumLicenseGuestRoute />}>
        <Route path="/lisans" element={<LicenseChoicePage />} />
        <Route path="/lisans/dene" element={<LicenseTrialSetupPage />} />
        <Route path="/lisans/aktiflestir" element={<LicenseActivatePage />} />
      </Route>
      <Route element={<PremiumLicenseGate />}>
        <Route element={<PremiumSetupOnlyRoute />}>
          <Route path="/setup" element={<SetupPage />} />
        </Route>
        <Route element={<PremiumGuestAuthRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route element={<PremiumProtectedRoute />}>
          <Route path="/lisans/yukselt" element={<LicenseActivatePage />} />
          <Route path="/print/hesap-ozeti/:dosyaId" element={<PremiumBelgePrintPage />} />
          <Route path="/print/makbuz/kasa/:hareketId" element={<PremiumBelgePrintPage />} />
          <Route path="/print/makbuz/vekalet/:odemeId" element={<PremiumBelgePrintPage />} />
          <Route path="/print/ofis-kasa-raporu" element={<PremiumOfisKasaRaporPrintPage />} />
          <Route path="/print/icra-tahsilat-raporu" element={<PremiumIcraTahsilatRaporPrintPage />} />
          <Route path="/print/muvekkil-ekstre/:dosyaId" element={<PremiumMuvekkilEkstrePrintPage />} />
          <Route element={<PremiumShell />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/randevular" element={<RandevularPage />} />
            <Route path="/muvekkiller" element={<MuvekkillerPage />} />
            <Route path="/dosyalar" element={<DosyalarPage />} />
            <Route path="/muvekkil/:id" element={<MuvekkilDetailPage />} />
            <Route path="/muvekkil/:muvekkilId/dosya/:dosyaId" element={<DosyaDetailPage />} />
            <Route path="/ofis-kasasi" element={<OfisKasaPage />} />
            <Route path="/icra-tahsilat" element={<IcraTahsilatPage />} />
            <Route path="/tahsilat-merkezi" element={<TahsilatMerkeziPage />} />
            <Route path="/raporlar" element={<RaporlarPage />} />
            <Route path="/ayarlar" element={<AyarlarPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
