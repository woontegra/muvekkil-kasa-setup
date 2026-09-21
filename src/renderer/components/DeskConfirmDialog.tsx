import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalPortal } from "./DeskModalPortal";
import { DeskModalHead } from "./DeskModalHead";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeskConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Onayla",
  cancelLabel = "İptal",
  variant = "primary",
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onCancel}>
        <div
          className="modal modal-desk modal-desk--confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="desk-confirm-title"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DeskModalHead title={title} onClose={onCancel} closeDisabled={busy} titleId="desk-confirm-title" />
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${variant === "danger" ? "btn-danger" : "btn-primary"}`}
              disabled={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
