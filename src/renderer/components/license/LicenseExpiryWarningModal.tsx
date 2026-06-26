type Props = {
  daysRemaining: number;
  busy?: boolean;
  onRenew: () => void;
  onDismiss: () => void;
  onCheck: () => void;
};

export function LicenseExpiryWarningModal({ daysRemaining, busy, onRenew, onDismiss, onCheck }: Props) {
  const urgent = daysRemaining <= 3;

  return (
    <div className="license-modal-backdrop" role="presentation">
      <div
        className={`license-modal license-modal--warning${urgent ? " license-modal--urgent" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-warning-title"
      >
        <div className="license-modal__head">
          <h2 id="license-warning-title">Lisans yenileme hatırlatması</h2>
        </div>
        <div className="license-modal__body">
          <p>
            Lisansınızın bitmesine <strong>{daysRemaining}</strong> gün kaldı. Programı kesintisiz kullanmaya devam
            etmek için lisansınızı yenileyin.
          </p>
        </div>
        <div className="license-modal__actions">
          <button type="button" className="btn btn-primary" onClick={onRenew} disabled={busy}>
            Lisansı Yenile
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={onCheck} disabled={busy}>
            Lisansı Kontrol Et
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
            Daha Sonra
          </button>
        </div>
      </div>
    </div>
  );
}
