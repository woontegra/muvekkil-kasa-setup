import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export function LoginPage() {
  const { needsSetup, login } = useAuth();
  const navigate = useNavigate();
  const idUser = useId();
  const idPass = useId();
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      card={
        <div className="auth-card auth-card--enter">
          <h2 className="auth-card-title">Giriş Yap</h2>
          <p className="auth-card-sub">Hesabınızla oturum açın.</p>
          {error ? (
            <div className="auth-alert auth-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="auth-field">
              <label htmlFor={idUser}>E-posta veya Kullanıcı Adı</label>
              <input
                id={idUser}
                className="auth-input"
                autoComplete="username"
                value={kullaniciAdi}
                onChange={(e) => setKullaniciAdi(e.target.value)}
                disabled={busy}
                placeholder="E-posta veya kullanıcı adınızı girin"
              />
            </div>
            <div className="auth-field">
              <label htmlFor={idPass}>Şifre</label>
              <div className="auth-input-row">
                <input
                  id={idPass}
                  className="auth-input auth-input--grow"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button type="button" className="auth-btn-eye" onClick={() => setShowPass((v) => !v)}>
                  {showPass ? "Gizle" : "Göster"}
                </button>
              </div>
            </div>
            <label className="auth-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} />
              Beni hatırla
            </label>
            <button type="submit" className="auth-btn-primary" disabled={busy}>
              {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>
          <div className="auth-card-footer">
            <Link to="/forgot-password" className="auth-link-btn">
              Şifremi unuttum
            </Link>
          </div>
        </div>
      }
    />
  );
}
