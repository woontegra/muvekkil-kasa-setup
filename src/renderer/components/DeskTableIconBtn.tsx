import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "default" | "primary" | "danger" | "warning";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: Variant;
  children: ReactNode;
};

export function DeskTableIconBtn({ title, variant = "default", className = "", children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`desk-table-icon-btn desk-table-icon-btn--${variant}${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkProps2 = Omit<LinkProps, "to"> & {
  title: string;
  to: string;
  variant?: Variant;
  children: ReactNode;
};

export function DeskTableIconLink({ title, to, variant = "primary", className = "", children, ...rest }: LinkProps2) {
  return (
    <Link
      to={to}
      className={`desk-table-icon-btn desk-table-icon-btn--${variant}${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={title}
      {...rest}
    >
      {children}
    </Link>
  );
}
