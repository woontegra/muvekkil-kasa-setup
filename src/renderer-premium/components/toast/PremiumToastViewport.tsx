import { usePremiumToast } from "../../context/PremiumToastContext";

export function PremiumToastViewport() {
  const { toasts, dismissToast } = usePremiumToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pm-toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className={`pm-toast pm-toast--${t.tone} pm-toast--enter`} role="status">
          <p className="pm-toast-message">{t.message}</p>
          <button
            type="button"
            className="pm-toast-close"
            onClick={() => dismissToast(t.id)}
            aria-label="Bildirimi kapat"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
