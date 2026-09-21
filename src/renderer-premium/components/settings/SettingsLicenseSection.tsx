import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { desktopLicenseActionCta, desktopLicenseKindLabel } from "@shared/lib/licenseExpiry";
import { PremiumButton } from "../PremiumButton";
import { usePremiumLicense } from "../../context/PremiumLicenseContext";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

function licenseStatusLabel(state: ReturnType<typeof usePremiumLicense>["state"]): string {
  if (!state) return "—";
  if (state.locked) return state.isExpired ? "Süresi doldu" : "Kilitli";
  if (!state.valid) return "Geçersiz";
  if (state.offlineDegraded) return "Çevrimdışı (geçerli)";
  return "Aktif";
}

export function SettingsLicenseSection() {
  const { state, loading, checkLicense, openRenewal } = usePremiumLicense();
  const { showToast } = usePremiumToast();
  const navigate = useNavigate();
  const [checkBusy, setCheckBusy] = useState(false);
  const checkBusyRef = useRef(false);

  async function lisansKontrol() {
    if (checkBusyRef.current) return;
    checkBusyRef.current = true;
    setCheckBusy(true);
    try {
      const result = await checkLicense();
      if (result.ok) {
        showToast("success", "Lisans durumu güncellendi.");
      } else {
        showToast("error", result.error?.trim() || "Lisans doğrulanamadı.");
      }
    } finally {
      setCheckBusy(false);
      checkBusyRef.current = false;
    }
  }

  const record = state?.record;
  const kindLabel = desktopLicenseKindLabel(record?.kind);
  const actionCta = desktopLicenseActionCta(record?.kind);
  const statusTone = state?.valid && !state.locked ? "ok" : state?.offlineDegraded ? "warn" : "err";
  const description =
    record?.kind === "trial"
      ? "Deneme lisansınızın süresini ve durumunu görüntüleyin."
      : "Lisans durumunuzu görüntüleyin ve yenileme işlemlerini yönetin.";

  return (
    <SettingsSectionFrame
      title="Lisans"
      description={description}
      loading={loading && !state}
    >
      <div className="pm-settings-license-panel">
        <div className={`pm-settings-license-status pm-settings-license-status--${statusTone} pm-stagger-item`}>
          <span className="pm-settings-license-status-dot" aria-hidden />
          <div>
            <span className="pm-settings-license-status-label">Durum</span>
            <strong>{licenseStatusLabel(state)}</strong>
          </div>
        </div>

        <dl className="pm-settings-license-grid pm-stagger-item" style={{ animationDelay: "60ms" }}>
          <div>
            <dt>Lisans türü</dt>
            <dd>{kindLabel ?? "—"}</dd>
          </div>
          <div>
            <dt>Lisans sahibi</dt>
            <dd>{record?.productName?.trim() || "—"}</dd>
          </div>
          <div>
            <dt>Son geçerlilik</dt>
            <dd>{state?.expiryLabel?.trim() || state?.expiresAt?.trim() || "—"}</dd>
          </div>
          <div>
            <dt>Kalan gün</dt>
            <dd>{state?.daysRemaining != null ? `${state.daysRemaining} gün` : "—"}</dd>
          </div>
          <div>
            <dt>Cihaz durumu</dt>
            <dd>{record?.status === "ACTIVE" ? "Kayıtlı" : record?.status === "LOCKED" ? "Kilitli" : "—"}</dd>
          </div>
        </dl>

        {state?.message && !state.valid ? (
          <p className="pm-settings-license-message pm-stagger-item" role="status">
            {state.message}
          </p>
        ) : null}

        <div className="pm-settings-license-actions pm-stagger-item" style={{ animationDelay: "120ms" }}>
          <PremiumButton type="button" onClick={() => void lisansKontrol()} disabled={checkBusy || loading}>
            {checkBusy ? "Kontrol ediliyor…" : "Lisansı kontrol et"}
          </PremiumButton>
          {actionCta === "renew" ? (
            <PremiumButton type="button" variant="ghost" onClick={() => void openRenewal()}>
              Lisansı yenile
            </PremiumButton>
          ) : null}
          {actionCta === "upgrade" ? (
            <PremiumButton type="button" variant="ghost" onClick={() => navigate("/lisans/yukselt")}>
              Tam Sürüme Geç
            </PremiumButton>
          ) : null}
        </div>
      </div>
    </SettingsSectionFrame>
  );
}
