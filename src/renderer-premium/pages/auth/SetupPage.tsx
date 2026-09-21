import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GUVENLIK_SORULARI, GUVENLIK_SORU_KODLARI } from "@shared/types/auth";
import { PremiumAuthLayout } from "../../components/auth/PremiumAuthLayout";
import { PremiumAlert } from "../../components/auth/PremiumAlert";
import { PremiumFormField } from "../../components/auth/PremiumFormField";
import { PremiumTextInput } from "../../components/auth/PremiumTextInput";
import { PremiumPasswordInput } from "../../components/auth/PremiumPasswordInput";
import { PremiumButton } from "../../components/PremiumButton";
import { requireTrialEmail, requireTurkishMobile } from "@shared/lib/trialContact";
import { usePremiumAuth } from "../../context/PremiumAuthContext";

export function SetupPage() {
  const { needsSetup, setupFirst } = usePremiumAuth();
  const navigate = useNavigate();
  const idAd = useId();
  const idEmail = useId();
  const idPhone = useId();
  const idPass = useId();
  const idPass2 = useId();
  const idGuvenlikSoru = useId();
  const idGuvenlikCevap = useId();
  const [adSoyad, setAdSoyad] = useState("");
  const [eposta, setEposta] = useState("");
  const [telefon, setTelefon] = useState("");
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
      const r = await setupFirst({
        adSoyad: adSoyad.trim(),
        sifre,
        guvenlikSorusuKodu,
        guvenlikCevabi: guvenlikCevabi.trim(),
        eposta: email,
        telefon: phone,
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
    <PremiumAuthLayout variant="setup">
      <div className="pm-auth-card pm-auth-card--enter pm-auth-card--wide">
        <h2 className="pm-auth-card-title">İlk Kurulum</h2>
        <p className="pm-auth-card-sub">Yönetici hesabınızı oluşturun.</p>
        {error ? <PremiumAlert tone="error">{error}</PremiumAlert> : null}
        <form className="pm-auth-form" onSubmit={(e) => void onSubmit(e)}>
          <PremiumFormField label="Ad soyad" htmlFor={idAd}>
            <PremiumTextInput
              id={idAd}
              autoComplete="name"
              value={adSoyad}
              onChange={(e) => setAdSoyad(e.target.value)}
              disabled={busy}
            />
          </PremiumFormField>
          <PremiumFormField label="E-posta" htmlFor={idEmail}>
            <PremiumTextInput
              id={idEmail}
              autoComplete="email"
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              disabled={busy}
              placeholder="ornek@mail.com"
            />
          </PremiumFormField>
          <PremiumFormField label="Telefon" htmlFor={idPhone}>
            <PremiumTextInput
              id={idPhone}
              autoComplete="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              disabled={busy}
              placeholder="05xx xxx xx xx"
            />
          </PremiumFormField>
          <div className="pm-auth-form-row">
          <PremiumFormField label="Şifre" htmlFor={idPass}>
            <PremiumPasswordInput
              id={idPass}
              autoComplete="new-password"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              disabled={busy}
              showPassword={showPass}
              onToggleVisibility={() => setShowPass((v) => !v)}
            />
          </PremiumFormField>
          <PremiumFormField label="Şifre tekrar" htmlFor={idPass2}>
            <PremiumTextInput
              id={idPass2}
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              value={sifre2}
              onChange={(e) => setSifre2(e.target.value)}
              disabled={busy}
            />
          </PremiumFormField>
          </div>
          <PremiumFormField label="Güvenlik sorusu" htmlFor={idGuvenlikSoru}>
            <select
              id={idGuvenlikSoru}
              className="pm-input pm-select"
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
          </PremiumFormField>
          <PremiumFormField label="Güvenlik cevabı" htmlFor={idGuvenlikCevap}>
            <PremiumTextInput
              id={idGuvenlikCevap}
              value={guvenlikCevabi}
              onChange={(e) => setGuvenlikCevabi(e.target.value)}
              disabled={busy}
            />
          </PremiumFormField>
          <PremiumButton type="submit" className="pm-auth-submit" disabled={busy}>
            {busy ? "Oluşturuluyor…" : "Hesabı Oluştur"}
          </PremiumButton>
        </form>
      </div>
    </PremiumAuthLayout>
  );
}
