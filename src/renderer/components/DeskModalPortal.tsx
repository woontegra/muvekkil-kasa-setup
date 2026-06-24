import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Modal katmanını sayfa layout'undan ayırır; input odak/yazım sorunlarını önler. */
export function DeskModalPortal({ children }: Props) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
