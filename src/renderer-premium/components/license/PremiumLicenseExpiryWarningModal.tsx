type Props = {
  daysRemaining: number;
  busy?: boolean;
  onRenew: () => void;
  onDismiss: () => void;
  onCheck: () => void;
};

export function PremiumLicenseExpiryWarningModal({ daysRemaining, busy, onRenew, onDismiss, onCheck }: Props) {
  const urgent = daysRemaining <= 3;

  return (
    <div className="pm-license-modal-backdrop" role="presentation">
      <div
        className={`pm-license-modal${urgent ? " pm-license-modal--urgent" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-license-warning-title"
      >
        <div className="pm-license-modal-head">
          <h2 id="pm-license-warning-title">Lisans yenileme hatırlatması</h2>
        </div>
        <div className="pm-license-modal-body">
          <p>
            Lisansınızın bitmesine <strong>{daysRemaining}</strong> gün kaldı. Programı kesintisiz kullanmaya devam
            etmek için lisansınızı yenileyin.
          </p>
        </div>
        <div className="pm-license-modal-actions">
          <button type="button" className="pm-btn pm-btn--primary" onClick={onRenew} disabled={busy}>
            Lisansı Yenile
          </button>
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onCheck} disabled={busy}>
            Lisansı Kontrol Et
          </button>
          <button type="button" className="pm-btn pm-btn--ghost pm-btn--muted" onClick={onDismiss} disabled={busy}>
            Daha Sonra
          </button>
        </div>
      </div>
    </div>
  );
}
