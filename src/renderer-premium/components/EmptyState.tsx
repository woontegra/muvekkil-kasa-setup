import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div className="pm-empty-state">
      <div className="pm-empty-state-icon" aria-hidden>
        {icon ?? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M4 7h16M4 12h10M4 17h14" />
          </svg>
        )}
      </div>
      <h2 className="pm-empty-state-title">{title}</h2>
      <p className="pm-empty-state-desc">{description}</p>
      {action ? <div className="pm-empty-state-action">{action}</div> : null}
    </div>
  );
}
