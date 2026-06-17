import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";
import { GUVENLIK_SORULARI, GUVENLIK_SORU_KODLARI } from "@shared/types/auth";

export function SetupPage() {
  const { needsSetup, setupFirst } = useAuth();
  const navigate = useNavigate();
  const idAd = useId();
  const idUser = useId();
  const idPass = useId();
  const idPass2 = useId();
  const idGuvenlikSoru = useId();
  const idGuvenlikCevap = useId();
  const [adSoyad, setAdSoyad] = useState("");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [guvenlikSorusuKodu, setGuvenlikSorusuKodu] = useState("G1");
  const [guvenlikCevabi, setGuvenlikCevabi] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!needsSetup) navigate("/login", { replace: true });
  }, [needsSetup, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!adSoyad.trim() || !kullaniciAdi.trim() || !sifre || !sifre2 || !guvenlikCevabi.trim()) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (sifre !== sifre2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setBusy(true);
    try {
      const r = await setupFirst({
        adSoyad: adSoyad.trim(),
        kullaniciAdi: kullaniciAdi.trim(),
        sifre,
        guvenlikSorusuKodu,
        guvenlikCevabi: guvenlikCevabi.trim(),
      });
      if (!r.ok) {
        setError(r.error ?? "Hesap oluşturulamadı.");
        return;
      }
      navigate("/", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      variant="setup"
      card={
        <div className="auth-card auth-card--enter auth-card--setup">
          <div className="auth-card-lock" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <h2 className="auth-card-title">İlk Kurulum</h2>
          <p className="auth-card-sub">Yönetici hesabınızı oluşturun.</p>
          {error ? (
            <div className="auth-alert auth-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <form className="auth-form auth-form--setup" onSubmit={(e) => void onSubmit(e)}>
            <div className="auth-field">
              <label htmlFor={idAd}>Ad soyad</label>
              <input
                id={idAd}
                className="auth-input"
                autoComplete="name"
                value={adSoyad}
                onChange={(e) => setAdSoyad(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <label htmlFor={idUser}>Kullanıcı adı</label>
              <input
                id={idUser}
                className="auth-input"
                autoComplete="username"
                value={kullaniciAdi}
                onChange={(e) => setKullaniciAdi(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <label htmlFor={idPass}>Şifre</label>
              <div className="auth-input-row">
                <input
                  id={idPass}
                  className="auth-input auth-input--grow"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  disabled={busy}
                />
                <button type="button" className="auth-btn-eye" onClick={() => setShowPass((v) => !v)}>
                  {showPass ? "Gizle" : "Göster"}
                </button>
              </div>
            </div>
            <div className="auth-field">
              <label htmlFor={idPass2}>Şifre tekrar</label>
              <input
                id={idPass2}
                className="auth-input"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                value={sifre2}
                onChange={(e) => setSifre2(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <label htmlFor={idGuvenlikSoru}>Güvenlik sorusu</label>
              <select
                id={idGuvenlikSoru}
                className="auth-input"
                value={guvenlikSorusuKodu}
                onChange={(e) => setGuvenlikSorusuKodu(e.target.value)}
                disabled={busy}
              >
                {GUVENLIK_SORU_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {GUVENLIK_SORULARI[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="auth-field">
              <label htmlFor={idGuvenlikCevap}>Güvenlik cevabı</label>
              <input
                id={idGuvenlikCevap}
                className="auth-input"
                value={guvenlikCevabi}
                onChange={(e) => setGuvenlikCevabi(e.target.value)}
                disabled={busy}
              />
            </div>
            <button type="submit" className="auth-btn-primary" disabled={busy}>
              {busy ? "Oluşturuluyor…" : "Hesabı Oluştur"}
            </button>
          </form>
        </div>
      }
    />
  );
}
