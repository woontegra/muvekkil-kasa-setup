import type { ReactNode } from "react";
import { PremiumAuthHero } from "./PremiumAuthHero";

type Props = {
  children: ReactNode;
  variant?: "default" | "setup";
};

export function PremiumAuthLayout({ children, variant = "default" }: Props) {
  return (
    <div className={`pm-auth-page pm-auth-page--enter${variant === "setup" ? " pm-auth-page--setup" : ""}`}>
      <PremiumAuthHero />
      <div className="pm-auth-form-panel">
        <div className="pm-auth-form-wrap">{children}</div>
      </div>
    </div>
  );
}
