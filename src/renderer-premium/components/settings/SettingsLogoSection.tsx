import { useCallback, useEffect, useRef, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { officeFormFromRow, officeFormToInput } from "../../lib/settingsOffice";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

export function SettingsLogoSection() {
  const { showToast } = usePremiumToast();
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [officeSnapshot, setOfficeSnapshot] = useState<ReturnType<typeof officeFormFromRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const yukleLogoOnizleme = useCallback(async (path: string | null) => {
    const p = (path ?? "").trim();
    if (!p) {
      setLogoSrc(null);
      return;
    }
    try {
      const url = await window.api.officeLogoDataUrl(p);
      setLogoSrc(url);
    } catch {
      setLogoSrc(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await window.api.officeGet();
      const f = officeFormFromRow(row);
      setOfficeSnapshot(f);
      setLogoPath(f.logoPath);
      await yukleLogoOnizleme(f.logoPath);
    } catch {
      setError("Logo bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [yukleLogoOnizleme]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistLogo(path: string | null, successToast: string) {
    if (!officeSnapshot || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await window.api.officeSave({
        ...officeFormToInput(officeSnapshot),
        logoPath: path,
      });
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      const f = officeFormFromRow(r.row);
      setOfficeSnapshot(f);
      setLogoPath(f.logoPath);
      await yukleLogoOnizleme(f.logoPath);
      showToast("success", successToast);
    } catch {
      showToast("error", "Logo kaydedilemedi.");
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  async function logoSec() {
    if (busyRef.current) return;
    try {
      const r = await window.api.officePickLogo();
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          showToast("error", r.error);
        }
        return;
      }
      await persistLogo(r.path, "Ofis logosu güncellendi.");
    } catch {
      showToast("error", "Logo seçilemedi.");
    }
  }

  async function logoKaldir() {
    if (!logoPath || busyRef.current) return;
    await persistLogo(null, "Ofis logosu kaldırıldı.");
  }

  const logoEtiket = (logoPath ?? "").trim() ? logoPath!.replace(/^.*[\\/]/, "") : "Seçilmedi";

  return (
    <SettingsSectionFrame
      title="Logo ve Görünüm"
      description="Makbuz ve belgelerde görünecek ofis logosunu yönetin. PNG, JPG, JPEG veya WEBP formatları desteklenir."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="pm-settings-logo-panel">
        <div className={`pm-settings-logo-preview${logoSrc ? " pm-settings-logo-preview--has" : ""}`}>
          {logoSrc ? (
            <img key={logoSrc} src={logoSrc} alt="Ofis logosu önizlemesi" className="pm-settings-logo-img" />
          ) : (
            <div className="pm-settings-logo-empty">
              <span>Logo seçilmedi</span>
            </div>
          )}
        </div>
        <div className="pm-settings-logo-meta pm-stagger-item">
          <p className="pm-settings-logo-file" title={logoPath ?? undefined}>
            <span className="pm-settings-logo-file-label">Dosya:</span> {logoEtiket}
          </p>
          <div className="pm-settings-logo-actions">
            <PremiumButton type="button" className="pm-btn--sm" onClick={() => void logoSec()} disabled={busy}>
              Logo seç
            </PremiumButton>
            <PremiumButton
              type="button"
              variant="ghost"
              className="pm-btn--sm"
              onClick={() => void logoKaldir()}
              disabled={busy || !logoPath}
            >
              Logoyu kaldır
            </PremiumButton>
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
}
