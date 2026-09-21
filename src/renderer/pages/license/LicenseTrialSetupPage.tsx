import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GUVENLIK_SORULARI, GUVENLIK_SORU_KODLARI } from "@shared/types/auth";
import { requireTrialEmail, requireTurkishMobile, TRIAL_ALREADY_USED_MESSAGE } from "@shared/lib/trialContact";
import { AuthShell } from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export function LicenseTrialSetupPage() {
  const { setupFirst } = useAuth();
  const navigate = useNavigate();
  const [adSoyad, setAdSoyad] = useState("");
  const [eposta, setEposta] = useState("");
  const [telefon, setTelefon] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [guvenlikSorusuKodu, setGuvenlikSorusuKodu] = useState("G1");
  const [guvenlikCevabi, setGuvenlikCevabi] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!adSoyad.trim() || !sifre || !sifre2 || !guvenlikCevabi.trim()) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (sifre !== sifre2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    let email: string;
    let phone: string;
    try {
      email = requireTrialEmail(eposta);
      phone = requireTurkishMobile(telefon);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İletişim bilgileri geçersiz.");
      return;
    }
    setBusy(true);
    try {
      const trial = await window.api.licenseStartTrial({ email, phone });
      if (!trial.ok) {
        setError(trial.code === "TRIAL_ALREADY_USED" ? TRIAL_ALREADY_USED_MESSAGE : (trial.error ?? "Deneme başlatılamadı."));
        return;
      }
      const setup = await setupFirst({
        adSoyad: adSoyad.trim(),
        sifre,
        guvenlikSorusuKodu,
        guvenlikCevabi: guvenlikCevabi.trim(),
        eposta: email,
        telefon: phone,
      });
      if (!setup.ok) {
        setError(setup.error ?? "Hesap oluşturulamadı. Deneme kaydınız duruyor; tekrar deneyebilirsiniz.");
        return;
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hesap oluşturulamadı. Deneme kaydınız duruyor; tekrar deneyebilirsiniz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      card={
        <div className="auth-card auth-card--enter">
          <h1 className="auth-title">7 Gün Ücretsiz Dene</h1>
          <form className="auth-form" onSubmit={(e) => void onSubmit(e)}>
            {error ? <div className="auth-alert auth-alert--error">{error}</div> : null}
            <label className="auth-field"><span>Ad soyad</span><input className="auth-input" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} disabled={busy} /></label>
            <label className="auth-field"><span>E-posta</span><input className="auth-input" value={eposta} onChange={(e) => setEposta(e.target.value)} disabled={busy} placeholder="ornek@mail.com" /></label>
            <label className="auth-field"><span>Telefon</span><input className="auth-input" value={telefon} onChange={(e) => setTelefon(e.target.value)} disabled={busy} placeholder="05xx xxx xx xx" /></label>
            <div className="auth-form-row">
            <label className="auth-field"><span>Şifre</span><input className="auth-input" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} disabled={busy} /></label>
            <label className="auth-field"><span>Şifre tekrar</span><input className="auth-input" type="password" value={sifre2} onChange={(e) => setSifre2(e.target.value)} disabled={busy} /></label>
            </div>
            <label className="auth-field">
              <span>Güvenlik sorusu</span>
              <select className="auth-input" value={guvenlikSorusuKodu} onChange={(e) => setGuvenlikSorusuKodu(e.target.value)} disabled={busy}>
                {GUVENLIK_SORU_KODLARI.map((k) => (
                  <option key={k} value={k}>{GUVENLIK_SORULARI[k]}</option>
                ))}
              </select>
            </label>
            <label className="auth-field"><span>Güvenlik cevabı</span><input className="auth-input" value={guvenlikCevabi} onChange={(e) => setGuvenlikCevabi(e.target.value)} disabled={busy} /></label>
            <button type="submit" className="auth-submit" disabled={busy}>{busy ? "Hazırlanıyor…" : "Denemeyi Başlat"}</button>
            <Link to="/lisans">Geri</Link>
          </form>
        </div>
      }
    />
  );
}
