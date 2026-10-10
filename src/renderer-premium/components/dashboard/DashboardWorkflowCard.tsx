import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

export type WorkflowTone = "approval" | "overdue" | "unpaid" | "smm";

type Props = {
  title: string;
  value: number;
  hint: string;
  tone: WorkflowTone;
  loading?: boolean;
  to?: string;
  icon?: ReactNode;
  staggerIndex?: number;
  emptyLabel?: string;
};

export function DashboardWorkflowCard({
  title,
  value,
  hint,
  tone,
  loading,
  to,
  icon,
  staggerIndex = 0,
  emptyLabel = "Kayıt yok",
}: Props) {
  const isEmpty = !loading && value === 0;
  const body = (
    <>
      <span className="pm-dash-workflow-accent" aria-hidden />
      <div className="pm-dash-workflow-top">
        {icon ? (
          <span className="pm-dash-workflow-icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="pm-dash-workflow-title">{title}</span>
      </div>
      {loading ? (
        <span className="pm-skeleton pm-skeleton--value" aria-hidden />
      ) : isEmpty ? (
        <span className="pm-dash-workflow-empty">{emptyLabel}</span>
      ) : (
        <span className="pm-dash-workflow-value">{value}</span>
      )}
      <span className="pm-dash-workflow-hint">{hint}</span>
    </>
  );

  const cls = `pm-dash-workflow-card pm-dash-workflow-card--${tone} pm-stagger-item${isEmpty ? " pm-dash-workflow-card--empty" : ""}`;
  const style = { "--pm-stagger-i": staggerIndex } as CSSProperties;

  if (to) {
    return (
      <Link to={to} className={cls} style={style}>
        {body}
      </Link>
    );
  }

  return (
    <article className={cls} style={style}>
      {body}
    </article>
  );
}
