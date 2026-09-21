import { useCallback, useEffect, useRef, useState } from "react";
import { GUVENLIK_SORULARI, GUVENLIK_SORU_KODLARI } from "@shared/types/auth";
import { PremiumButton } from "../PremiumButton";
import { PremiumFormField } from "../auth/PremiumFormField";
import { PremiumPasswordInput } from "../auth/PremiumPasswordInput";
import { usePremiumAuth } from "../../context/PremiumAuthContext";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

export function SettingsSecuritySection() {
  const { user } = usePremiumAuth();
  const { showToast } = usePremiumToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mevcutSifre, setMevcutSifre] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const [showMevcut, setShowMevcut] = useState(false);
  const [showYeni, setShowYeni] = useState(false);
  const [showYeniTekrar, setShowYeniTekrar] = useState(false);
  const [sifreKaydediyor, setSifreKaydediyor] = useState(false);
  const sifreBusyRef = useRef(false);

  const [guvenlikMevcutSifre, setGuvenlikMevcutSifre] = useState("");
  const [guvenlikSorusuKodu, setGuvenlikSorusuKodu] = useState("G1");
  const [guvenlikCevabi, setGuvenlikCevabi] = useState("");
  const [showGuvenlikSifre, setShowGuvenlikSifre] = useState(false);
  const [guvenlikKaydediyor, setGuvenlikKaydediyor] = useState(false);
  const guvenlikBusyRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const guv = await window.api.authGuvenlikBilgisi();
      if (guv.ok && guv.guvenlikSorusuKodu && GUVENLIK_SORU_KODLARI.includes(guv.guvenlikSorusuKodu)) {
        setGuvenlikSorusuKodu(guv.guvenlikSorusuKodu);
      }
    } catch {
      setError("Güvenlik bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sifreGuncelle() {
    if (sifreBusyRef.current) return;
    if (!yeniSifre.trim()) {
      showToast("error", "Yeni şifre boş olamaz.");
      return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
      showToast("error", "Yeni şifre ve tekrarı aynı değil.");
      return;
    }
    sifreBusyRef.current = true;
    setSifreKaydediyor(true);
    try {
      const r = await window.api.authSifreGuncelle({ mevcutSifre, yeniSifre });
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      setMevcutSifre("");
      setYeniSifre("");
      setYeniSifreTekrar("");
      showToast("success", "Şifreniz başarıyla değiştirildi.");
    } catch {
      showToast("error", "Şifre güncellenemedi.");
    } finally {
      setSifreKaydediyor(false);
      sifreBusyRef.current = false;
    }
  }

  async function guvenlikGuncelle() {
    if (guvenlikBusyRef.current) return;
    guvenlikBusyRef.current = true;
    setGuvenlikKaydediyor(true);
    try {
      const r = await window.api.authGuvenlikGuncelle({
        mevcutSifre: guvenlikMevcutSifre,
        guvenlikSorusuKodu,
        guvenlikCevabi,
      });
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      setGuvenlikMevcutSifre("");
      setGuvenlikCevabi("");
      showToast("success", "Güvenlik bilgileri güncellendi.");
    } catch {
      showToast("error", "Güvenlik güncellenemedi.");
    } finally {
      setGuvenlikKaydediyor(false);
      guvenlikBusyRef.current = false;
    }
  }

  const hesapKimligi = user?.eposta?.trim() || user?.kullaniciAdi || "—";

  return (
    <SettingsSectionFrame
      title="Güvenlik"
      description="Giriş şifrenizi ve şifre sıfırlama için güvenlik sorusunu yönetin."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="pm-settings-security-blocks">
        <div className="pm-settings-security-block pm-stagger-item">
          <h3 className="pm-settings-subtitle">Hesap</h3>
          <PremiumFormField label="E-posta" htmlFor="pm-guvenlik-kullanici">
            <input id="pm-guvenlik-kullanici" className="pm-input" value={hesapKimligi} readOnly disabled />
          </PremiumFormField>
        </div>

        <div className="pm-settings-security-block pm-stagger-item" style={{ animationDelay: "80ms" }}>
          <h3 className="pm-settings-subtitle">Şifre değiştir</h3>
          <div className="pm-settings-form-grid pm-settings-form-grid--security">
            <PremiumFormField label="Mevcut şifre" htmlFor="pm-sifre-mevcut">
              <PremiumPasswordInput
                id="pm-sifre-mevcut"
                autoComplete="current-password"
                value={mevcutSifre}
                onChange={(e) => setMevcutSifre(e.target.value)}
                disabled={sifreKaydediyor}
                showPassword={showMevcut}
                onToggleVisibility={() => setShowMevcut((v) => !v)}
              />
            </PremiumFormField>
            <PremiumFormField label="Yeni şifre" htmlFor="pm-sifre-yeni">
              <PremiumPasswordInput
                id="pm-sifre-yeni"
                autoComplete="new-password"
                value={yeniSifre}
                onChange={(e) => setYeniSifre(e.target.value)}
                disabled={sifreKaydediyor}
                showPassword={showYeni}
                onToggleVisibility={() => setShowYeni((v) => !v)}
              />
            </PremiumFormField>
            <PremiumFormField label="Yeni şifre tekrar" htmlFor="pm-sifre-yeni-tekrar">
              <PremiumPasswordInput
                id="pm-sifre-yeni-tekrar"
                autoComplete="new-password"
                value={yeniSifreTekrar}
                onChange={(e) => setYeniSifreTekrar(e.target.value)}
                disabled={sifreKaydediyor}
                showPassword={showYeniTekrar}
                onToggleVisibility={() => setShowYeniTekrar((v) => !v)}
              />
            </PremiumFormField>
          </div>
          <div className="pm-settings-inline-actions">
            <PremiumButton type="button" onClick={() => void sifreGuncelle()} disabled={sifreKaydediyor}>
              {sifreKaydediyor ? "Güncelleniyor…" : "Şifreyi güncelle"}
            </PremiumButton>
          </div>
        </div>

        <div className="pm-settings-security-block pm-stagger-item" style={{ animationDelay: "160ms" }}>
          <h3 className="pm-settings-subtitle">Güvenlik sorusu</h3>
          <div className="pm-settings-form-grid pm-settings-form-grid--security">
            <PremiumFormField label="Mevcut şifre" htmlFor="pm-guvenlik-sifre">
              <PremiumPasswordInput
                id="pm-guvenlik-sifre"
                autoComplete="current-password"
                value={guvenlikMevcutSifre}
                onChange={(e) => setGuvenlikMevcutSifre(e.target.value)}
                disabled={guvenlikKaydediyor}
                showPassword={showGuvenlikSifre}
                onToggleVisibility={() => setShowGuvenlikSifre((v) => !v)}
              />
            </PremiumFormField>
            <PremiumFormField label="Güvenlik sorusu" htmlFor="pm-guvenlik-soru">
              <select
                id="pm-guvenlik-soru"
                className="pm-input"
                value={guvenlikSorusuKodu}
                onChange={(e) => setGuvenlikSorusuKodu(e.target.value)}
                disabled={guvenlikKaydediyor}
              >
                {GUVENLIK_SORU_KODLARI.map((k) => (
                  <option key={k} value={k}>
                    {GUVENLIK_SORULARI[k]}
                  </option>
                ))}
              </select>
            </PremiumFormField>
            <PremiumFormField label="Güvenlik cevabı" htmlFor="pm-guvenlik-cevap">
              <input
                id="pm-guvenlik-cevap"
                className="pm-input"
                value={guvenlikCevabi}
                onChange={(e) => setGuvenlikCevabi(e.target.value)}
                disabled={guvenlikKaydediyor}
              />
            </PremiumFormField>
          </div>
          <div className="pm-settings-inline-actions">
            <PremiumButton type="button" onClick={() => void guvenlikGuncelle()} disabled={guvenlikKaydediyor}>
              {guvenlikKaydediyor ? "Güncelleniyor…" : "Güvenliği güncelle"}
            </PremiumButton>
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
}
