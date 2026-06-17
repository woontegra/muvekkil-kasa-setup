import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, needsSetup, loading } = useAuth();
  if (loading) return null;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function GuestAuthRoute() {
  const { user, needsSetup, loading } = useAuth();
  if (loading) return null;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function SetupOnlyRoute() {
  const { needsSetup, loading } = useAuth();
  if (loading) return null;
  if (!needsSetup) return <Navigate to="/login" replace />;
  return <Outlet />;
}
