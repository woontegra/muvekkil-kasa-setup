import { Navigate, Route, Routes } from "react-router-dom";
import { PremiumLicenseGate, PremiumLicenseGuestRoute } from "./PremiumLicenseGate";
import {
  PremiumGuestAuthRoute,
  PremiumProtectedRoute,
  PremiumSetupOnlyRoute,
} from "./PremiumProtectedRoute";
import { LicenseActivatePage } from "../pages/license/LicenseActivatePage";
import { LicenseChoicePage } from "../pages/license/LicenseChoicePage";
import { LicenseTrialSetupPage } from "../pages/license/LicenseTrialSetupPage";
import { SetupPage } from "../pages/auth/SetupPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { ForgotPasswordPage } from "../pages/auth/ForgotPasswordPage";

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
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
