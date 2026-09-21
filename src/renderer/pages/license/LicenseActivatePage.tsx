import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DESKTOP_LICENSE_UPDATED_EVENT } from "@shared/lib/licenseExpiry";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

const FALLBACK_ERROR = "Lisans aktivasyonu başarısız. Bilgileri kontrol edip tekrar deneyin.";
const SUCCESS_REDIRECT_MS = 1500;

export function LicenseActivatePage() {
  const { needsSetup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [licenseKey, setLicenseKey] = useState("");
  const [activationPassword, setActivationPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || success) return;

    setError(null);
    setSuccess(null);

    const trimmedKey = licenseKey.trim();
    const trimmedPassword = activationPassword.trim();

    if (!trimmedKey) {
      setError("Lisans anahtarı boş bırakılamaz.");
      return;
    }
    if (!trimmedPassword) {
      setError("Aktivasyon şifresi boş bırakılamaz.");
      return;
    }

    setBusy(true);
    let activated = false;
    try {
      const r = await window.api.licenseActivate({
        licenseKey: trimmedKey,
        activationPassword: trimmedPassword,
      });
      if (!r.ok) {
        setError(r.error?.trim() || FALLBACK_ERROR);
        return;
      }

      activated = true;
      window.dispatchEvent(new Event(DESKTOP_LICENSE_UPDATED_EVENT));
      setSuccess(r.message?.trim() || "Lisans başarıyla aktifleştirildi.");
      const nextPath = needsSetup ? "/setup" : location.pathname.includes("yukselt") ? "/ayarlar/ofis" : "/login";
      window.setTimeout(() => {
        navigate(nextPath, { replace: true });
      }, SUCCESS_REDIRECT_MS);
    } finally {
      if (!activated) setBusy(false);
    }
  }

  const formLocked = busy || !!success;

  return (
    <AuthShell
      card={
        <div className="auth-card auth-card--enter">
          <h1 className="auth-title">Lisans aktivasyonu</h1>
          <p className="auth-subtitle">
            Satın alma sonrası e-postanıza gönderilen lisans anahtarı ve aktivasyon şifresini girin.
          </p>
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)} noValidate>
            {error ? (
              <div className="auth-alert auth-alert--error" role="alert">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="auth-alert auth-alert--success" role="status">
                {success}
              </div>
            ) : null}
            <label className="auth-field">
              <span>Lisans anahtarı</span>
              <input
                className="auth-input"
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="WTG-XXXX-XXXX-XXXX"
                autoComplete="off"
                disabled={formLocked}
              />
            </label>
            <label className="auth-field">
              <span>Aktivasyon şifresi</span>
              <input
                className="auth-input"
                type="password"
                value={activationPassword}
                onChange={(e) => {
                  setActivationPassword(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="off"
                disabled={formLocked}
              />
            </label>
            <button type="submit" className="auth-submit" disabled={formLocked}>
              {busy ? "Aktifleştiriliyor…" : success ? "Yönlendiriliyor…" : "Aktifleştir"}
            </button>
          </form>
        </div>
      }
    />
  );
}
