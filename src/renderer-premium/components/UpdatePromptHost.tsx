import { useCallback, useState } from "react";
import type { UpdateStatusSnapshot } from "@shared/types/update";
import { PremiumButton } from "./PremiumButton";
import { PremiumModal } from "./modal/PremiumModal";
import { useUpdateStatus } from "../context/UpdateStatusContext";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(n / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  return `${formatBytes(bps)}/sn`;
}

function canDismissModal(state: UpdateStatusSnapshot["state"]): boolean {
  return state !== "downloading" && state !== "installing";
}

export function UpdatePromptHost() {
  const { status } = useUpdateStatus();
  const [busy, setBusy] = useState(false);

  const onDismiss = useCallback(async () => {
    await window.api.updateDismiss();
  }, []);

  if (!status) return null;

  const showModal =
    status.showPrompt &&
    (status.state === "available" ||
      status.state === "downloading" ||
      status.state === "downloaded" ||
      status.state === "installing" ||
      (status.state === "error" && Boolean(status.errorMessage)));

  const showInfo =
    !showModal && Boolean(status.infoMessage) && status.lastCheckSource === "manual";

  async function onDownload() {
    if (busy || status.state === "downloading") return;
    setBusy(true);
    try {
      await window.api.updateDownload();
    } finally {
      setBusy(false);
    }
  }

  async function onInstall() {
    if (busy || status.state === "installing") return;
    setBusy(true);
    try {
      await window.api.updateInstall();
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    if (busy) return;
    setBusy(true);
    try {
      if (status.availableVersion && (status.state === "error" || status.state === "available")) {
        await window.api.updateDownload();
      } else {
        await window.api.updateCheck("manual");
      }
    } finally {
      setBusy(false);
    }
  }

  if (showInfo && status.infoMessage) {
    return (
      <PremiumModal
        open
        title="Programınız güncel"
        onClose={() => void onDismiss()}
        footer={
          <PremiumButton type="button" onClick={() => void onDismiss()}>
            Tamam
          </PremiumButton>
        }
      >
        <p className="pm-update-modal-text">En güncel Müvekkil Kasa Defteri sürümünü kullanıyorsunuz.</p>
        <p className="pm-update-modal-version">
          Mevcut sürüm: <strong>{status.currentVersion}</strong>
        </p>
      </PremiumModal>
    );
  }

  if (!showModal) return null;

  const downloading = status.state === "downloading";
  const downloaded = status.state === "downloaded" || status.state === "installing";
  const isError = status.state === "error";
  const pct = status.progress ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : 0;
  const closeAllowed = canDismissModal(status.state);

  let title = "Yeni güncelleme hazır";
  if (downloading) title = "Güncelleme indiriliyor";
  else if (downloaded) title = "Güncelleme indirildi";
  else if (isError) title = "Güncelleme tamamlanamadı";

  return (
    <PremiumModal
      open
      title={title}
      onClose={() => void onDismiss()}
      disabled={!closeAllowed || busy}
      footer={
        downloaded ? (
          <>
            <PremiumButton type="button" variant="ghost" disabled={busy || status.state === "installing"} onClick={() => void onDismiss()}>
              Daha sonra
            </PremiumButton>
            <PremiumButton type="button" disabled={busy || status.state === "installing"} onClick={() => void onInstall()}>
              {status.state === "installing" ? "Güncelleme hazırlanıyor…" : "Yeniden başlat ve güncelle"}
            </PremiumButton>
          </>
        ) : isError ? (
          <>
            <PremiumButton type="button" variant="ghost" onClick={() => void onDismiss()}>
              Kapat
            </PremiumButton>
            <PremiumButton type="button" disabled={busy} onClick={() => void onRetry()}>
              Tekrar dene
            </PremiumButton>
          </>
        ) : downloading ? null : (
          <>
            <PremiumButton type="button" variant="ghost" disabled={downloading} onClick={() => void onDismiss()}>
              Daha sonra
            </PremiumButton>
            <PremiumButton type="button" disabled={busy || downloading} onClick={() => void onDownload()}>
              Şimdi güncelle
            </PremiumButton>
          </>
        )
      }
    >
      {downloading ? (
        <div className="pm-settings-update-progress">
          <div className="pm-settings-update-progress-head">
            <span>İndirme ilerlemesi</span>
            <strong>%{pct}</strong>
          </div>
          <div className="pm-settings-update-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="pm-settings-update-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="pm-settings-update-progress-meta">
            <span>
              {formatBytes(status.progress?.transferred ?? NaN)} / {formatBytes(status.progress?.total ?? NaN)}
            </span>
            <span>{formatSpeed(status.progress?.bytesPerSecond ?? NaN)}</span>
          </div>
        </div>
      ) : isError ? (
        <p className="pm-update-modal-error">{status.errorMessage}</p>
      ) : (
        <>
          <p className="pm-update-modal-version">
            Mevcut: <strong>{status.currentVersion}</strong>
            {status.availableVersion ? (
              <>
                {" "}
                → Yeni: <strong className="pm-settings-update-new">{status.availableVersion}</strong>
              </>
            ) : null}
          </p>
          {status.releaseNotes?.trim() ? (
            <div className="pm-update-modal-notes">
              <h3>Bu sürümde neler değişti?</h3>
              <ul>
                {status.releaseNotes
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => (
                    <li key={line}>{line.replace(/^[-*•]\s*/, "")}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </PremiumModal>
  );
}
