import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
};

export function PremiumFormField({ label, htmlFor, hint, error, children }: Props) {
  return (
    <div className="pm-form-field">
      <label className="pm-form-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="pm-form-hint">{hint}</p> : null}
      {error ? (
        <p className="pm-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
