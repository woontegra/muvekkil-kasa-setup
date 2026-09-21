import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function PremiumCard({ children, className = "" }: Props) {
  return <div className={`pm-card${className ? ` ${className}` : ""}`}>{children}</div>;
}
