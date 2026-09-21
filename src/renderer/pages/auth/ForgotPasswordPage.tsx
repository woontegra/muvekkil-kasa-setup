import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";

export function ForgotPasswordPage() {
  const idUser = useId();
  const idCevap = useId();
  const idPass = useId();
  const idPass2 = useId();
  const [step, setStep] = useState<"user" | "reset">("user");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [soruMetni, setSoruMetni] = useState("");
  const [guvenlikCevabi, setGuvenlikCevabi] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifre2, setYeniSifre2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function soruGetir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await window.api.authForgotPasswordGetQuestion(kullaniciAdi.trim());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSoruMetni(r.soruMetni);
      setStep("reset");
    } finally {
      setBusy(false);
    }
  }

  async function sifreYenile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (yeniSifre !== yeniSifre2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const r = await window.api.authForgotPasswordSubmit({
        kullaniciAdi: kullaniciAdi.trim(),
        guvenlikCevabi,
        yeniSifre,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSuccess("Şifreniz güncellendi. Giriş yapabilirsiniz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      card={
        <div className="auth-card auth-card--enter">
          <h2 className="auth-card-title">Şifremi Unuttum</h2>
          {step === "user" ? (
            <>
              <p className="auth-card-sub">E-posta veya kullanıcı adınızı girin.</p>
              {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
              <form className="auth-form" onSubmit={(e) => void soruGetir(e)}>
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
                <button type="submit" className="auth-btn-primary" disabled={busy}>
                  Devam
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="auth-card-sub">{soruMetni}</p>
              {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
              {success ? <div className="auth-alert auth-alert--success">{success}</div> : null}
              {!success ? (
                <form className="auth-form" onSubmit={(e) => void sifreYenile(e)}>
                  <div className="auth-field">
                    <label htmlFor={idCevap}>Güvenlik cevabı</label>
                    <input
                      id={idCevap}
                      className="auth-input"
                      value={guvenlikCevabi}
                      onChange={(e) => setGuvenlikCevabi(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor={idPass}>Yeni şifre</label>
                    <input
                      id={idPass}
                      className="auth-input"
                      type="password"
                      value={yeniSifre}
                      onChange={(e) => setYeniSifre(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="auth-field">
                    <label htmlFor={idPass2}>Yeni şifre tekrar</label>
                    <input
                      id={idPass2}
                      className="auth-input"
                      type="password"
                      value={yeniSifre2}
                      onChange={(e) => setYeniSifre2(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <button type="submit" className="auth-btn-primary" disabled={busy}>
                    Şifreyi yenile
                  </button>
                </form>
              ) : null}
            </>
          )}
          <div className="auth-card-footer auth-card-footer--solo">
            <Link to="/login" className="auth-link-btn">
              Giriş ekranına dön
            </Link>
          </div>
        </div>
      }
    />
  );
}
