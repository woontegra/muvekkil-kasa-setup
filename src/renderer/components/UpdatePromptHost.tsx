import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { UpdateStatusSnapshot } from "@shared/types/update";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import appIcon from "../assets/app-icon-DS-8UBWS.png";

const FALLBACK_RELEASE_NOTES = [
  "Performans ve kararlılık iyileştirmeleri",
  "Kullanıcı deneyimi geliştirmeleri",
  "Hata düzeltmeleri ve güvenlik güncellemeleri",
];

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

function formatReleaseDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
}

function parseReleaseNotes(notes: string | null): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, ""));
}

function canDismissModal(state: UpdateStatusSnapshot["state"]): boolean {
  return state !== "downloading" && state !== "installing";
}

type UpdateIconProps = { className?: string };

function IconClose({ className }: UpdateIconProps) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconArrowRight({ className }: UpdateIconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload({ className }: UpdateIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSuccess({ className }: UpdateIconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12.2 10.8 15 16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconError({ className }: UpdateIconProps) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.5v5M12 16.2h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VersionCompare({
  currentVersion,
  availableVersion,
  releaseDate,
  compact,
}: {
  currentVersion: string;
  availableVersion: string | null;
  releaseDate: string | null;
  compact?: boolean;
}) {
  const dateLabel = formatReleaseDate(releaseDate);
  return (
    <div className={`desk-update-version${compact ? " desk-update-version--compact" : ""}`}>
      <div className="desk-update-version__col">
        <span className="desk-update-version__label">Mevcut sürüm</span>
        <strong className="desk-update-version__value">{currentVersion}</strong>
      </div>
      <IconArrowRight className="desk-update-version__arrow" />
      <div className="desk-update-version__col desk-update-version__col--new">
        <span className="desk-update-version__label">
          Yeni sürüm
          <span className="desk-update-version__badge">Yeni</span>
        </span>
        <strong className="desk-update-version__value desk-update-version__value--new">{availableVersion ?? "—"}</strong>
      </div>
      {dateLabel ? (
        <p className="desk-update-version__date">
          Yayın tarihi: <span>{dateLabel}</span>
        </p>
      ) : null}
    </div>
  );
}

function ReleaseNotesList({ notes }: { notes: string | null }) {
  const items = parseReleaseNotes(notes);
  const list = items.length > 0 ? items : FALLBACK_RELEASE_NOTES;
  return (
    <section className="desk-update-changelog" aria-labelledby="desk-update-changelog-title">
      <h3 id="desk-update-changelog-title" className="desk-update-changelog__title">
        Bu sürümde neler değişti?
      </h3>
      <ul className="desk-update-changelog__list">
        {list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function UpdateModalShell({
  title,
  subtitle,
  iconVariant,
  canClose,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  iconVariant?: "default" | "success" | "error";
  canClose: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="modal modal-desk desk-update-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desk-update-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="desk-update-modal__head">
        <div className="desk-update-modal__head-main">
          <img src={appIcon} alt="" className="desk-update-modal__app-icon" width={44} height={44} />
          <div className="desk-update-modal__head-text">
            <div className="desk-update-modal__title-row">
              {iconVariant === "success" ? <IconSuccess className="desk-update-modal__state-icon desk-update-modal__state-icon--ok" /> : null}
              {iconVariant === "error" ? <IconError className="desk-update-modal__state-icon desk-update-modal__state-icon--err" /> : null}
              <h2 id="desk-update-modal-title" className="desk-update-modal__title">
                {title}
              </h2>
            </div>
            {subtitle ? <p className="desk-update-modal__subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {canClose ? (
          <button
            type="button"
            className="desk-update-modal__close"
            onClick={onClose}
            aria-label="Kapat"
            title="Kapat"
          >
            <IconClose />
          </button>
        ) : null}
      </header>
      <div className="desk-update-modal__body">{children}</div>
      <footer className="desk-update-modal__foot">{footer}</footer>
    </div>
  );
}

export function UpdatePromptHost() {
  const [status, setStatus] = useState<UpdateStatusSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      try {
        const s = await window.api.updateGetStatus();
        setStatus(s);
      } catch {
        /* ignore */
      }
      unsub = window.api.onUpdateStatusChanged((next) => setStatus(next));
    })();
    return () => {
      unsub?.();
    };
  }, []);

  const showModal =
    status?.showPrompt &&
    (status.state === "available" ||
      status.state === "downloading" ||
      status.state === "downloaded" ||
      status.state === "installing" ||
      (status.state === "error" && Boolean(status.errorMessage)));

  const showInfo =
    status && !showModal && Boolean(status.infoMessage) && status.lastCheckSource === "manual";

  const onDismiss = useCallback(async () => {
    await window.api.updateDismiss();
  }, []);

  // Escape ile kapatma yok — yanlışlıkla veri/işlem kaybını önlemek için
  // yalnızca X / Tamam / Daha sonra / Şimdi değil butonlarıyla kapanır.

  if (!status) return null;

  async function onDownload() {
    if (busy || status?.state === "downloading") return;
    setBusy(true);
    try {
      await window.api.updateDownload();
    } finally {
      setBusy(false);
    }
  }

  async function onInstall() {
    if (busy || status?.state === "installing") return;
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
      if (status?.availableVersion && (status.state === "error" || status.state === "available")) {
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
      <DeskModalBackdrop onClose={() => void onDismiss()} className="modal-backdrop desk-update-backdrop">
        <UpdateModalShell
          title="Programınız güncel"
          subtitle="En güncel Müvekkil Kasa Defteri sürümünü kullanıyorsunuz."
          canClose
          onClose={() => void onDismiss()}
          footer={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void onDismiss()}>
              Tamam
            </button>
          }
        >
          <p className="desk-update-current-only">
            Mevcut sürüm: <strong>{status.currentVersion}</strong>
          </p>
        </UpdateModalShell>
      </DeskModalBackdrop>
    );
  }

  if (!showModal) return null;

  const downloading = status.state === "downloading";
  const downloaded = status.state === "downloaded" || status.state === "installing";
  const isError = status.state === "error";
  const pct = status.progress ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : 0;
  const closeAllowed = canDismissModal(status.state);

  let title = "Yeni güncelleme hazır";
  let subtitle = "Daha kararlı, güvenli ve geliştirilmiş bir sürüm sizi bekliyor.";
  let iconVariant: "default" | "success" | "error" | undefined;

  if (downloading) {
    title = "Güncelleme indiriliyor";
    subtitle = "Lütfen programı kapatmayın. Güncelleme güvenli şekilde hazırlanıyor.";
  } else if (downloaded) {
    title = "Güncelleme indirildi";
    subtitle = "Yeni sürüm hazır. Güncellemeyi tamamlamak için program yeniden başlatılacaktır.";
    iconVariant = "success";
  } else if (isError) {
    title = "Güncelleme tamamlanamadı";
    subtitle = "Güncelleme sırasında bir sorun oluştu. İnternet bağlantınızı kontrol edip yeniden deneyebilirsiniz.";
    iconVariant = "error";
  }

  let body: ReactNode = null;
  if (downloading) {
    body = (
      <div className="desk-update-progress-panel">
        <div className="desk-update-progress-panel__pct" aria-hidden>
          %{pct}
        </div>
        <div
          className="desk-update-progress-bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="İndirme ilerlemesi"
        >
          <div className="desk-update-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="desk-update-progress-stats">
          <span>{formatBytes(status.progress?.transferred ?? NaN)} / {formatBytes(status.progress?.total ?? NaN)}</span>
          <span>{formatSpeed(status.progress?.bytesPerSecond ?? NaN)}</span>
        </div>
      </div>
    );
  } else if (downloaded) {
    body = (
      <>
        <VersionCompare
          compact
          currentVersion={status.currentVersion}
          availableVersion={status.availableVersion}
          releaseDate={status.releaseDate}
        />
      </>
    );
  } else if (isError) {
    body = null;
  } else {
    body = (
      <>
        <VersionCompare
          currentVersion={status.currentVersion}
          availableVersion={status.availableVersion}
          releaseDate={status.releaseDate}
        />
        <ReleaseNotesList notes={status.releaseNotes} />
      </>
    );
  }

  let footer: ReactNode;
  if (downloaded) {
    footer = (
      <>
        <button
          type="button"
          className="btn btn-sm desk-update-btn-secondary"
          disabled={busy || status.state === "installing"}
          onClick={() => void onDismiss()}
        >
          Daha sonra
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm desk-update-btn-primary"
          disabled={busy || status.state === "installing"}
          onClick={() => void onInstall()}
          title="Yeniden başlat ve güncelle"
          aria-label="Yeniden başlat ve güncelle"
        >
          {status.state === "installing" ? "Güncelleme hazırlanıyor…" : "Yeniden başlat ve güncelle"}
        </button>
      </>
    );
  } else if (isError) {
    footer = (
      <>
        <button type="button" className="btn btn-sm desk-update-btn-secondary" onClick={() => void onDismiss()}>
          Kapat
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm desk-update-btn-primary"
          disabled={busy}
          onClick={() => void onRetry()}
          title="Tekrar dene"
          aria-label="Tekrar dene"
        >
          Tekrar dene
        </button>
      </>
    );
  } else if (downloading) {
    footer = null;
  } else {
    footer = (
      <>
        <button
          type="button"
          className="btn btn-sm desk-update-btn-secondary"
          disabled={downloading}
          onClick={() => void onDismiss()}
        >
          Daha sonra
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm desk-update-btn-primary"
          disabled={busy || downloading}
          onClick={() => void onDownload()}
          title="Şimdi güncelle"
          aria-label="Şimdi güncelle"
        >
          <IconDownload className="desk-update-btn-icon" />
          Şimdi güncelle
        </button>
      </>
    );
  }

  return (
    <DeskModalBackdrop
      onClose={() => void onDismiss()}
      disabled={!closeAllowed}
      className="modal-backdrop desk-update-backdrop"
    >
      <UpdateModalShell
        title={title}
        subtitle={subtitle}
        iconVariant={iconVariant}
        canClose={closeAllowed}
        onClose={() => void onDismiss()}
        footer={footer}
      >
        {body}
      </UpdateModalShell>
    </DeskModalBackdrop>
  );
}
