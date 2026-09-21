import { useEffect, useRef, useState } from "react";
import type { UpdateStatusSnapshot } from "@shared/types/update";
import { PremiumButton } from "../PremiumButton";
import { useUpdateStatus } from "../../context/UpdateStatusContext";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(n / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function stateLabel(state: UpdateStatusSnapshot["state"]): string {
  switch (state) {
    case "checking":
      return "Kontrol ediliyor…";
    case "available":
      return "Yeni sürüm mevcut";
    case "not-available":
      return "Güncel";
    case "downloading":
      return "İndiriliyor…";
    case "downloaded":
      return "Kuruluma hazır";
    case "installing":
      return "Kuruluyor…";
    case "error":
      return "Hata";
    default:
      return "Hazır";
  }
}

export function SettingsUpdateSection() {
  const { showToast } = usePremiumToast();
  const { status, refresh } = useUpdateStatus();
  const [loading, setLoading] = useState(!status);
  const [error, setError] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const checkBusyRef = useRef(false);
  const actionBusyRef = useRef(false);
  const prevStateRef = useRef<UpdateStatusSnapshot["state"] | null>(status?.state ?? null);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch {
        setError("Güncelleme durumu okunamadı.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!status) return;
    const prev = prevStateRef.current;
    prevStateRef.current = status.state;

    if (status.lastCheckSource === "manual") {
      if (status.state === "not-available" && prev === "checking") {
        showToast("success", "Programın en güncel sürümünü kullanıyorsunuz.");
      } else if (status.state === "available" && prev !== "available") {
        showToast("info", "Yeni sürüm bulundu.");
      } else if (status.state === "downloaded" && prev !== "downloaded") {
        showToast("success", "Güncelleme indirildi ve kuruluma hazır.");
      } else if (status.state === "error" && status.errorMessage && prev !== "error") {
        showToast("error", status.errorMessage);
      }
    }
  }, [status, showToast]);

  async function kontrolEt() {
    if (checkBusyRef.current) return;
    if (status && !status.packaged) {
      showToast("info", "Geliştirme modunda otomatik güncelleme kullanılamaz.");
      return;
    }
    checkBusyRef.current = true;
    setCheckBusy(true);
    showToast("info", "Güncellemeler kontrol ediliyor.");
    try {
      const r = await window.api.updateCheck("manual");
      if (!r.ok) {
        showToast("error", r.error);
      }
    } catch {
      showToast("error", "Güncelleme kontrolü başarısız.");
    } finally {
      setCheckBusy(false);
      checkBusyRef.current = false;
    }
  }

  async function indir() {
    if (actionBusyRef.current || status?.state === "downloading") return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      await window.api.updateDownload();
    } catch {
      showToast("error", "Güncelleme indirilemedi.");
    } finally {
      setActionBusy(false);
      actionBusyRef.current = false;
    }
  }

  async function kur() {
    if (actionBusyRef.current || status?.state === "installing") return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      await window.api.updateInstall();
    } catch {
      showToast("error", "Güncelleme kurulamadı.");
    } finally {
      setActionBusy(false);
      actionBusyRef.current = false;
    }
  }

  const pct =
    status?.progress != null ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : 0;

  return (
    <SettingsSectionFrame
      title="Uygulama ve Güncelleme"
      description="Müvekkil Kasa Defteri sürüm bilgisi ve otomatik güncelleme yönetimi."
      loading={loading}
      error={error}
      onRetry={() => void refresh()}
    >
      <div className="pm-settings-update-panel">
        <div className="pm-settings-update-status pm-stagger-item">
          <div className="pm-settings-update-row">
            <span className="pm-settings-update-label">Mevcut sürüm</span>
            <strong>{status?.currentVersion ?? "—"}</strong>
          </div>
          <div className="pm-settings-update-row">
            <span className="pm-settings-update-label">Durum</span>
            <span className={`pm-settings-update-badge pm-settings-update-badge--${status?.state ?? "idle"}`}>
              {stateLabel(status?.state ?? "idle")}
            </span>
          </div>
          {status?.availableVersion ? (
            <div className="pm-settings-update-row">
              <span className="pm-settings-update-label">Yeni sürüm</span>
              <strong className="pm-settings-update-new">{status.availableVersion}</strong>
            </div>
          ) : null}
          {status && !status.packaged ? (
            <p className="pm-settings-update-dev-note">Geliştirme modunda otomatik güncelleme devre dışıdır.</p>
          ) : (
            <p className="pm-settings-update-dev-note pm-settings-update-dev-note--ok">Otomatik güncelleme: Etkin</p>
          )}
        </div>

        {status?.state === "downloading" ? (
          <div className="pm-settings-update-progress pm-stagger-item">
            <div className="pm-settings-update-progress-head">
              <span>İndirme ilerlemesi</span>
              <strong>%{pct}</strong>
            </div>
            <div
              className="pm-settings-update-progress-bar"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="pm-settings-update-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="pm-settings-update-progress-meta">
              <span>
                {formatBytes(status.progress?.transferred ?? NaN)} / {formatBytes(status.progress?.total ?? NaN)}
              </span>
            </div>
          </div>
        ) : null}

        <div className="pm-settings-update-actions pm-stagger-item">
          <PremiumButton type="button" onClick={() => void kontrolEt()} disabled={checkBusy || actionBusy}>
            {checkBusy ? "Kontrol ediliyor…" : "Güncellemeleri kontrol et"}
          </PremiumButton>
          {status?.state === "available" ? (
            <PremiumButton type="button" variant="ghost" onClick={() => void indir()} disabled={actionBusy}>
              Güncellemeyi indir
            </PremiumButton>
          ) : null}
          {status?.state === "downloaded" || status?.state === "installing" ? (
            <PremiumButton type="button" onClick={() => void kur()} disabled={actionBusy}>
              {status.state === "installing" ? "Kuruluyor…" : "Yeniden başlat ve güncelle"}
            </PremiumButton>
          ) : null}
        </div>

        {status?.errorMessage ? (
          <p className="pm-settings-update-error" role="alert">
            {status.errorMessage}
          </p>
        ) : null}
      </div>
    </SettingsSectionFrame>
  );
}
