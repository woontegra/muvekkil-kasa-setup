type Props = {
  busy?: boolean;
  title?: string;
  message?: string | null;
  onRenew: () => void;
  onCheck: () => void;
  onQuit: () => void;
  renewLabel?: string;
};

export function PremiumLicenseExpiredScreen({
  busy,
  title = "Lisans süreniz sona erdi",
  message,
  onRenew,
  onCheck,
  onQuit,
  renewLabel = "Lisansı Yenile",
}: Props) {
  return (
    <div className="pm-license-lock">
      <div className="pm-license-lock-card pm-auth-card--enter">
        <div className="pm-license-lock-icon" aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="pm-license-lock-title">{title}</h1>
        <p className="pm-license-lock-message">
          {message ??
            "Müvekkil Kasa Defteri programını kullanmaya devam etmek için lisansınızı yenilemeniz gerekir."}
        </p>
        <p className="pm-license-lock-note">
          Kayıtlı verileriniz silinmedi. Lisans yenilendikten sonra Lisansı Kontrol Et ile programa devam
          edebilirsiniz.
        </p>
        <div className="pm-license-lock-actions">
          <button type="button" className="pm-btn pm-btn--primary" onClick={onRenew} disabled={busy}>
            {renewLabel}
          </button>
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onCheck} disabled={busy}>
            {busy ? "Kontrol ediliyor…" : "Lisansı Kontrol Et"}
          </button>
          <button type="button" className="pm-btn pm-btn--ghost pm-btn--muted" onClick={onQuit} disabled={busy}>
            Programı Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
