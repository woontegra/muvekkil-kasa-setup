import { useLicenseStatus } from "../../hooks/useLicenseStatus";

export function LicenseStatusBadge() {
  const { state } = useLicenseStatus();
  if (!state?.valid || !state.expiryLabel) return null;

  const days = state.daysRemaining;
  let tone: "ok" | "warn" | "danger" = "ok";
  if (days != null && days <= 0) tone = "danger";
  else if (days != null && days <= 30) tone = "warn";

  return (
    <span className={`license-status-badge license-status-badge--${tone}`} title="Lisans bitiş tarihi">
      Lisans: {state.expiryLabel} tarihine kadar aktif
    </span>
  );
}
