import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { PremiumAuthLayout } from "../../components/auth/PremiumAuthLayout";
import { PremiumAlert } from "../../components/auth/PremiumAlert";
import { PremiumFormField } from "../../components/auth/PremiumFormField";
import { PremiumTextInput } from "../../components/auth/PremiumTextInput";
import { PremiumPasswordInput } from "../../components/auth/PremiumPasswordInput";
import { PremiumButton } from "../../components/PremiumButton";

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
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function soruGetir(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await window.api.authForgotPasswordGetQuestion(kullaniciAdi.trim());
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSoruMetni(r.soruMetni ?? "");
      setStep("reset");
    } finally {
      setBusy(false);
    }
  }

  async function sifreYenile(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
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
    <PremiumAuthLayout>
      <div className="pm-auth-card pm-auth-card--enter">
        <h2 className="pm-auth-card-title">Şifremi Unuttum</h2>
        {step === "user" ? (
          <>
            <p className="pm-auth-card-sub">E-posta adresinizi girin.</p>
            {error ? <PremiumAlert tone="error">{error}</PremiumAlert> : null}
            <form className="pm-auth-form" onSubmit={(e) => void soruGetir(e)}>
              <PremiumFormField label="E-posta" htmlFor={idUser}>
                <PremiumTextInput
                  id={idUser}
                  autoComplete="email"
                  value={kullaniciAdi}
                  onChange={(e) => setKullaniciAdi(e.target.value)}
                  disabled={busy}
                  placeholder="ornek@mail.com"
                />
              </PremiumFormField>
              <PremiumButton type="submit" className="pm-auth-submit" disabled={busy}>
                {busy ? "Kontrol ediliyor…" : "Devam"}
              </PremiumButton>
            </form>
          </>
        ) : (
          <>
            <p className="pm-auth-card-sub">{soruMetni}</p>
            {error ? <PremiumAlert tone="error">{error}</PremiumAlert> : null}
            {success ? <PremiumAlert tone="success">{success}</PremiumAlert> : null}
            {!success ? (
              <form className="pm-auth-form" onSubmit={(e) => void sifreYenile(e)}>
                <PremiumFormField label="Güvenlik cevabı" htmlFor={idCevap}>
                  <PremiumTextInput
                    id={idCevap}
                    value={guvenlikCevabi}
                    onChange={(e) => setGuvenlikCevabi(e.target.value)}
                    disabled={busy}
                  />
                </PremiumFormField>
                <PremiumFormField label="Yeni şifre" htmlFor={idPass}>
                  <PremiumPasswordInput
                    id={idPass}
                    value={yeniSifre}
                    onChange={(e) => setYeniSifre(e.target.value)}
                    disabled={busy}
                    showPassword={showPass}
                    onToggleVisibility={() => setShowPass((v) => !v)}
                  />
                </PremiumFormField>
                <PremiumFormField label="Yeni şifre tekrar" htmlFor={idPass2}>
                  <PremiumTextInput
                    id={idPass2}
                    type={showPass ? "text" : "password"}
                    value={yeniSifre2}
                    onChange={(e) => setYeniSifre2(e.target.value)}
                    disabled={busy}
                  />
                </PremiumFormField>
                <PremiumButton type="submit" className="pm-auth-submit" disabled={busy}>
                  {busy ? "Güncelleniyor…" : "Şifreyi yenile"}
                </PremiumButton>
              </form>
            ) : null}
          </>
        )}
        <div className="pm-auth-card-footer">
          <Link to="/login" className="pm-auth-link">
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    </PremiumAuthLayout>
  );
}
