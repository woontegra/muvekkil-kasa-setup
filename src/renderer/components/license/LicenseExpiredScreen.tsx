type Props = {
  busy?: boolean;
  title?: string;
  message?: string | null;
  onRenew: () => void;
  onCheck: () => void;
  onQuit: () => void;
  renewLabel?: string;
};

export function LicenseExpiredScreen({
  busy,
  title = "Lisans süreniz sona erdi",
  message,
  onRenew,
  onCheck,
  onQuit,
  renewLabel = "Lisansı Yenile",
}: Props) {
  return (
    <div className="license-expired-page">
      <div className="license-expired-card">
        <div className="license-expired-icon" aria-hidden>
          !
        </div>
        <h1>{title}</h1>
        <p>
          {message ??
            "Müvekkil Kasa Defteri programını kullanmaya devam etmek için lisansınızı yenilemeniz gerekir."}
        </p>
        <p className="license-expired-note">
          Kayıtlı verileriniz silinmedi. Lisans yenilendikten sonra Lisansı Kontrol Et ile programa devam
          edebilirsiniz.
        </p>
        <div className="license-expired-actions">
          <button type="button" className="btn btn-primary" onClick={onRenew} disabled={busy}>
            {renewLabel}
          </button>
          <button type="button" className="btn btn-outline-primary" onClick={onCheck} disabled={busy}>
            Lisansı Kontrol Et
          </button>
          <button type="button" className="btn btn-ghost" onClick={onQuit} disabled={busy}>
            Programı Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
