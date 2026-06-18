/** Türk lirası gösterimi: 1.500,00 ₺ (sembol sağda, TL yazısı yok) */
export function formatTry(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const formatted = Math.abs(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${formatted} ₺`;
}

/** İşaretli tutar: +1.500,00 ₺ / -3.000,00 ₺ */
export function formatSignedTry(n: number): string {
  if (n > 0) return `+${formatTry(n)}`;
  return formatTry(n);
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
  let t = raw.trim();
  if (!t) return null;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}(?:\.|$)/.test(t)) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
