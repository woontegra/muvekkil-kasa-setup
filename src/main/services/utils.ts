export function trimOrNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}
