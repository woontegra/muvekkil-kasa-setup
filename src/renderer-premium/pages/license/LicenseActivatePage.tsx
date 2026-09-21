import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DESKTOP_LICENSE_UPDATED_EVENT } from "@shared/lib/licenseExpiry";
import { PremiumAuthLayout } from "../../components/auth/PremiumAuthLayout";
import { PremiumAlert } from "../../components/auth/PremiumAlert";
import { PremiumFormField } from "../../components/auth/PremiumFormField";
import { PremiumTextInput } from "../../components/auth/PremiumTextInput";
import { PremiumPasswordInput } from "../../components/auth/PremiumPasswordInput";
import { PremiumButton } from "../../components/PremiumButton";
import { usePremiumAuth } from "../../context/PremiumAuthContext";

const FALLBACK_ERROR = "Lisans aktivasyonu başarısız. Bilgileri kontrol edip tekrar deneyin.";
const SUCCESS_REDIRECT_MS = 1500;

export function LicenseActivatePage() {
  const { needsSetup } = usePremiumAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [licenseKey, setLicenseKey] = useState("");
  const [activationPassword, setActivationPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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
      const nextPath = needsSetup ? "/setup" : location.pathname.includes("yukselt") ? "/ayarlar" : "/login";
      window.setTimeout(() => {
        navigate(nextPath, { replace: true });
      }, SUCCESS_REDIRECT_MS);
    } finally {
      if (!activated) setBusy(false);
    }
  }

  const formLocked = busy || !!success;

  return (
    <PremiumAuthLayout>
      <div className="pm-auth-card pm-auth-card--enter">
        <h2 className="pm-auth-card-title">Lisans aktivasyonu</h2>
        <p className="pm-auth-card-sub">
          Satın alma sonrası e-postanıza gönderilen lisans anahtarı ve aktivasyon şifresini girin.
        </p>
        <form className="pm-auth-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          {error ? <PremiumAlert tone="error">{error}</PremiumAlert> : null}
          {success ? <PremiumAlert tone="success">{success}</PremiumAlert> : null}
          <PremiumFormField label="Lisans anahtarı" htmlFor="pm-license-key">
            <PremiumTextInput
              id="pm-license-key"
              value={licenseKey}
              onChange={(e) => {
                setLicenseKey(e.target.value);
                if (error) setError(null);
              }}
              placeholder="WTG-XXXX-XXXX-XXXX"
              autoComplete="off"
              disabled={formLocked}
            />
          </PremiumFormField>
          <PremiumFormField label="Aktivasyon şifresi" htmlFor="pm-activation-pass">
            <PremiumPasswordInput
              id="pm-activation-pass"
              value={activationPassword}
              onChange={(e) => {
                setActivationPassword(e.target.value);
                if (error) setError(null);
              }}
              autoComplete="off"
              disabled={formLocked}
              showPassword={showPass}
              onToggleVisibility={() => setShowPass((v) => !v)}
            />
          </PremiumFormField>
          <PremiumButton type="submit" className="pm-auth-submit" disabled={formLocked}>
            {busy ? "Aktifleştiriliyor…" : success ? "Yönlendiriliyor…" : "Aktifleştir"}
          </PremiumButton>
        </form>
      </div>
    </PremiumAuthLayout>
  );
}
