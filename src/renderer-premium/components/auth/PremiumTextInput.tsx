import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function PremiumTextInput({ className = "", ...rest }: Props) {
  return <input className={`pm-input${className ? ` ${className}` : ""}`} {...rest} />;
}
