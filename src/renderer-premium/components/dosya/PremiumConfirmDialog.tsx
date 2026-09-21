import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PremiumConfirmDialog({
  open,
  title,
  message,
  variant = "primary",
  confirmLabel = "Onayla",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <PremiumModal
      open={open}
      title={title}
      onClose={onCancel}
      disabled={busy}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            İptal
          </PremiumButton>
          <PremiumButton
            type="button"
            className={variant === "danger" ? "pm-btn--danger" : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "İşleniyor…" : confirmLabel}
          </PremiumButton>
        </>
      }
    >
      <p className="pm-confirm-message">{message}</p>
    </PremiumModal>
  );
}
