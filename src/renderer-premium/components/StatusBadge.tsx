import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  tone?: "default" | "success" | "info" | "warning";
};

export function StatusBadge({ children, tone = "default" }: Props) {
  const cls = tone === "default" ? "pm-status-badge" : `pm-status-badge pm-status-badge--${tone}`;
  return <span className={cls}>{children}</span>;
}
