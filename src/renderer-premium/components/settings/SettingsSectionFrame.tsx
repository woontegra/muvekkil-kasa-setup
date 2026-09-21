import type { ReactNode } from "react";
import { PremiumButton } from "../PremiumButton";

type Props = {
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function SettingsSectionFrame({ title, description, loading, error, onRetry, children, footer }: Props) {
  return (
    <section className="pm-settings-section">
      <header className="pm-settings-section-head pm-stagger-item">
        <h2 className="pm-settings-section-title">{title}</h2>
        {description ? <p className="pm-settings-section-desc">{description}</p> : null}
      </header>

      {error ? (
        <div className="pm-settings-error-bar pm-stagger-item" role="alert">
          <span>{error}</span>
          {onRetry ? (
            <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={onRetry}>
              Yeniden dene
            </PremiumButton>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="pm-settings-skeleton-grid" aria-busy="true" aria-label="Yükleniyor">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="pm-skeleton pm-skeleton--block" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : (
        <div className="pm-settings-section-body">{children}</div>
      )}

      {footer && !loading ? <footer className="pm-settings-section-foot">{footer}</footer> : null}
    </section>
  );
}
