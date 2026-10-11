import { useEffect, useState, type FormEvent } from "react";
import { PremiumButton } from "../PremiumButton";
import { PremiumModal } from "../modal/PremiumModal";

export function RestoreSecretModal({
  open,
  fileName,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  fileName: string | null;
  busy: boolean;
  error: string | null;
  onSubmit: (secret: { password: string } | { recoveryKey: string }) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      setMode("password");
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    onSubmit(mode === "password" ? { password: value } : { recoveryKey: value });
  }

  return (
    <PremiumModal
      open={open}
      title="Şifreli yedeği aç"
      subtitle={fileName ?? undefined}
      onClose={onCancel}
      disabled={busy}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            İptal
          </PremiumButton>
          <PremiumButton
            type="submit"
            form="pm-restore-secret-form"
            className="pm-btn--danger"
            disabled={!value.trim() || busy}
          >
            {busy ? "Geri yükleniyor…" : "Geri yükle"}
          </PremiumButton>
        </>
      }
    >
      <form id="pm-restore-secret-form" className="pm-backup-secret-form" onSubmit={submit} autoComplete="off">
        {error ? (
          <p className="pm-form-error--modal" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pm-field">
          <label htmlFor="pm-restore-secret">{mode === "password" ? "Yedek parolası" : "Kurtarma anahtarı"}</label>
          <input
            id="pm-restore-secret"
            className="pm-input"
            type={mode === "password" ? "password" : "text"}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder={mode === "recovery" ? "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
          />
        </div>
        <button
          type="button"
          className="pm-backup-mode-link"
          onClick={() => {
            setMode(mode === "password" ? "recovery" : "password");
            setValue("");
          }}
          disabled={busy}
        >
          {mode === "password" ? "Parolayı unuttum, kurtarma anahtarı kullan" : "Parola ile aç"}
        </button>
        <p className="pm-backup-secret-note">
          Mevcut veritabanı, yedek doğrulanıp hazırlanmadan değiştirilmez; işlem öncesi otomatik yedeği alınır.
        </p>
      </form>
    </PremiumModal>
  );
}
