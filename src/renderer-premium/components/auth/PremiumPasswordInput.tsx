import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  showPassword: boolean;
  onToggleVisibility: () => void;
};

function EyeIcon({ open }: { open: boolean }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75 };
  if (open) {
    return (
      <svg {...p} aria-hidden>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg {...p} aria-hidden>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function PremiumPasswordInput({ showPassword, onToggleVisibility, className = "", ...rest }: Props) {
  return (
    <div className="pm-input-row pm-input-row--password">
      <input
        className={`pm-input pm-input--grow pm-input--password${className ? ` ${className}` : ""}`}
        type={showPassword ? "text" : "password"}
        {...rest}
      />
      <button
        type="button"
        className={`pm-input-eye${showPassword ? " pm-input-eye--visible" : ""}`}
        onClick={onToggleVisibility}
        disabled={rest.disabled}
        aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        <EyeIcon open={showPassword} />
      </button>
    </div>
  );
}
