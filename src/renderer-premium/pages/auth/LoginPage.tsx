import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PremiumAuthLayout } from "../../components/auth/PremiumAuthLayout";
import { PremiumAlert } from "../../components/auth/PremiumAlert";
import { PremiumFormField } from "../../components/auth/PremiumFormField";
import { PremiumTextInput } from "../../components/auth/PremiumTextInput";
import { PremiumPasswordInput } from "../../components/auth/PremiumPasswordInput";
import { PremiumButton } from "../../components/PremiumButton";
import { usePremiumAuth } from "../../context/PremiumAuthContext";

export function LoginPage() {
  const { needsSetup, login } = usePremiumAuth();
  const navigate = useNavigate();
  const idUser = useId();
  const idPass = useId();
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [successExit, setSuccessExit] = useState(false);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (needsSetup) navigate("/setup", { replace: true });
  }, [needsSetup, navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const row = await window.api.getRememberedLogin();
        if (row?.kullaniciAdi) {
          setKullaniciAdi(row.kullaniciAdi);
          setRemember(row.rememberMe !== false);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!error) return;
    setShake(true);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(false), 520);
    return () => {
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    };
  }, [error]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await login({ kullaniciAdi, password, rememberMe: remember });
      if (!r.ok) {
        setError(r.error ?? "Giriş başarısız.");
        return;
      }
      if (remember) {
        await window.api.saveRememberedLogin(kullaniciAdi.trim());
      } else {
        await window.api.clearRememberedLogin();
      }
      setSuccessExit(true);
      window.setTimeout(() => navigate("/", { replace: true }), 380);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumAuthLayout>
      <div
        className={[
          "pm-login-panel",
          "pm-login-panel--enter",
          shake ? "pm-login-panel--shake" : "",
          successExit ? "pm-login-panel--success" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="pm-login-panel-head">
          <h2 className="pm-login-panel-title">Hoş geldiniz</h2>
          <p className="pm-login-panel-sub">Hesabınızla güvenli oturum açın</p>
        </header>

        {error ? <PremiumAlert tone="error">{error}</PremiumAlert> : null}

        <form className="pm-login-form" onSubmit={(e) => void onSubmit(e)}>
          <PremiumFormField label="E-posta" htmlFor={idUser}>
            <PremiumTextInput
              id={idUser}
              className="pm-login-input"
              autoComplete="email"
              value={kullaniciAdi}
              onChange={(e) => setKullaniciAdi(e.target.value)}
              disabled={busy}
              placeholder="ornek@mail.com"
            />
          </PremiumFormField>

          <PremiumFormField label="Şifre" htmlFor={idPass}>
            <PremiumPasswordInput
              id={idPass}
              className="pm-login-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              placeholder="••••••••"
              showPassword={showPass}
              onToggleVisibility={() => setShowPass((v) => !v)}
            />
          </PremiumFormField>

          <label className="pm-login-remember">
            <input
              type="checkbox"
              className="pm-login-remember-input"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />
            <span className="pm-login-remember-box" aria-hidden />
            <span>Beni hatırla</span>
          </label>

          <PremiumButton type="submit" className="pm-login-submit" disabled={busy}>
            {busy ? (
              <span className="pm-login-submit-inner">
                <span className="pm-login-spinner" aria-hidden />
                Giriş yapılıyor…
              </span>
            ) : (
              "Giriş Yap"
            )}
          </PremiumButton>
        </form>

        <footer className="pm-login-panel-footer">
          <Link to="/forgot-password" className="pm-auth-link">
            Şifremi unuttum
          </Link>
        </footer>
      </div>
    </PremiumAuthLayout>
  );
}
