export function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

export function formatDateTr(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  const d = s.length >= 10 ? s.slice(0, 10) : s;
  const [y, m, g] = d.split("-");
  if (!y || !m || !g) return s;
  return `${g}.${m}.${y}`;
}

export function bugunYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

export function parsePosTutar(raw: string): number | null {
  const t = raw.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
