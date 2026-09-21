import { Navigate, Outlet } from "react-router-dom";
import { usePremiumAuth } from "../context/PremiumAuthContext";
import { PremiumLoadingScreen } from "../components/auth/PremiumLoadingScreen";

export function PremiumProtectedRoute() {
  const { user, needsSetup, loading } = usePremiumAuth();
  if (loading) return <PremiumLoadingScreen message="Oturum kontrol ediliyor…" />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function PremiumGuestAuthRoute() {
  const { user, needsSetup, loading } = usePremiumAuth();
  if (loading) return <PremiumLoadingScreen message="Oturum kontrol ediliyor…" />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function PremiumSetupOnlyRoute() {
  const { needsSetup, loading } = usePremiumAuth();
  if (loading) return <PremiumLoadingScreen message="Kurulum durumu kontrol ediliyor…" />;
  if (!needsSetup) return <Navigate to="/login" replace />;
  return <Outlet />;
}
