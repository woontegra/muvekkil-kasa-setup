import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppShell } from "./components/AppShell";
import { GuestAuthRoute, ProtectedRoute, SetupOnlyRoute } from "./components/ProtectedRoute";
import { SetupPage } from "./pages/auth/SetupPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { MuvekkillerPage } from "./pages/MuvekkillerPage";
import { MuvekkilDetailPage } from "./pages/MuvekkilDetailPage";
import { DosyaDetailPage } from "./pages/DosyaDetailPage";
import { OfisKasaPage } from "./pages/OfisKasaPage";
import { OfficeSettingsPage } from "./pages/settings/OfficeSettingsPage";
import { OfisKasaRaporuPrintPage } from "./pages/print/OfisKasaRaporuPrintPage";
import { BelgeYazdirmaOnizlemePage } from "./pages/print/BelgeYazdirmaOnizlemePage";

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route element={<SetupOnlyRoute />}>
            <Route path="/setup" element={<SetupPage />} />
          </Route>
          <Route element={<GuestAuthRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/muvekkiller" element={<MuvekkillerPage />} />
              <Route path="/muvekkil/:id" element={<MuvekkilDetailPage />} />
              <Route path="/muvekkil/:muvekkilId/dosya/:dosyaId" element={<DosyaDetailPage />} />
              <Route path="/ofis-kasasi" element={<OfisKasaPage />} />
              <Route path="/ayarlar/ofis" element={<OfficeSettingsPage />} />
              <Route path="/print/ofis-kasa-raporu" element={<OfisKasaRaporuPrintPage />} />
              <Route path="/print/hesap-ozeti/:dosyaId" element={<BelgeYazdirmaOnizlemePage />} />
              <Route path="/print/makbuz/kasa/:hareketId" element={<BelgeYazdirmaOnizlemePage />} />
              <Route path="/print/makbuz/vekalet/:odemeId" element={<BelgeYazdirmaOnizlemePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
