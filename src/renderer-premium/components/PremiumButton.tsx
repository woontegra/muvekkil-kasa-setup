import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export function PremiumButton({ variant = "primary", className = "", children, type = "button", ...rest }: Props & { type?: "button" | "submit" | "reset" }) {
  const cls = `pm-btn pm-btn--${variant}${className ? ` ${className}` : ""}`;
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  );
}
