import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
  wide?: boolean;
  panelClassName?: string;
};

export function PremiumModal({ open, title, subtitle, onClose, children, footer, disabled, wide, panelClassName }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, disabled]);

  if (!open) return null;

  return createPortal(
    <div
      className="pm-modal-backdrop pm-modal-backdrop--enter"
      role="presentation"
      onClick={(e) => {
        if (disabled) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`pm-modal-panel pm-modal-panel--enter${wide ? " pm-modal-panel--wide" : ""}${panelClassName ? ` ${panelClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pm-modal-header">
          <div>
            <h2 id="pm-modal-title" className="pm-modal-title">
              {title}
            </h2>
            {subtitle ? <p className="pm-modal-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="pm-modal-close"
            onClick={onClose}
            disabled={disabled}
            aria-label="Kapat"
          >
            ×
          </button>
        </header>
        <div className="pm-modal-body">{children}</div>
        {footer ? <footer className="pm-modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
