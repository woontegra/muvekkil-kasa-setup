import type { ReactElement } from "react";

type Props = {
  value: string | null | undefined;
  unavailable?: boolean;
  className?: string;
};

/** SaaS BugunkuTlKarsilikCell — yaklaşık TRY hücresi. */
export function BugunkuTlKarsilikCell(props: Props): ReactElement {
  const text = props.unavailable ? "Hesaplanamadı" : props.value?.trim() || "—";
  return (
    <span
      className={["pm-bugunku-tl", props.unavailable ? "pm-bugunku-tl--warn" : "", props.className ?? ""]
        .filter(Boolean)
        .join(" ")}
      data-testid="bugunku-tl-karsilik"
    >
      {text}
    </span>
  );
}

export const BUGUNKU_TL_KUR_HINT =
  "Ekranın açıldığı günün TCMB Döviz Alış kuruna göre hesaplanır.";
