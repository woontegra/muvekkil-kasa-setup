import type { ReactNode } from "react";
import { PremiumButton } from "../PremiumButton";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function RaporSectionFrame({ title, description, children }: Props) {
  return (
    <section className="pm-rapor-section">
      <header className="pm-rapor-section-head pm-stagger-item">
        <h2 className="pm-rapor-section-title">{title}</h2>
        {description ? <p className="pm-rapor-section-desc">{description}</p> : null}
      </header>
      <div className="pm-rapor-section-body">{children}</div>
    </section>
  );
}

type ActionProps = {
  busy?: boolean;
  disabled?: boolean;
  onPreview: () => void;
  onPdf: () => void;
  onPrint: () => void;
};

export function RaporActionButtons({ busy, disabled, onPreview, onPdf, onPrint }: ActionProps) {
  const block = busy || disabled;
  return (
    <div className="pm-rapor-actions pm-stagger-item">
      {busy ? (
        <div className="pm-rapor-progress" aria-live="polite">
          <div className="pm-rapor-progress-bar" />
          <span>Rapor hazırlanıyor…</span>
        </div>
      ) : null}
      <div className="pm-rapor-actions-row">
        <PremiumButton type="button" onClick={onPreview} disabled={block}>
          Önizle
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" onClick={onPdf} disabled={block}>
          PDF indir
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" onClick={onPrint} disabled={block}>
          Yazdır
        </PremiumButton>
      </div>
    </div>
  );
}
