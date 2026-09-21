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

/**
 * Türk para girişi → sayı.
 * "100000" | "100.000" | "100.000,50" | "100000,50" | "100,50"
 * Boş / geçersiz → null (input kilitlenmez; validation kaydetmede yapılır).
 */
export function parseCurrencyInputTR(raw: string): number | null {
  let t = raw.trim();
  if (!t) return null;

  t = t.replace(/\s/g, "").replace(/₺/g, "").replace(/TL/gi, "");
  if (!t || t === "-" || t === "," || t === ".") return null;

  const negative = t.startsWith("-");
  if (negative) t = t.slice(1);

  if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$|^\d+(\.\d{1,2})?$/.test(t) && !/^\d[\d.,]*$/.test(t)) {
    return null;
  }

  let normalized: string;
  if (t.includes(",")) {
    // TR: nokta binlik, virgül ondalık
    normalized = t.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}(\.|$)/.test(t) || (t.match(/\./g) ?? []).length > 1) {
    // 100.000 veya 1.000.000
    normalized = t.replace(/\./g, "");
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    // Yazım sırasında 100.5 gibi (ondalık nokta)
    normalized = t;
  } else {
    normalized = t.replace(/\./g, "");
  }

  if (!normalized || normalized === ".") return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return negative ? -rounded : rounded;
}

/** Blur / kayıt gösterimi: 100000 → "100.000,00" (₺ yok) */
export function formatCurrencyInputTR(n: number): string {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** İmleç koruması: caret önündeki anlamlı karakter (rakam + virgül) sayısı. */
export function moneySignificantCount(s: string, caret: number): number {
  let n = 0;
  const end = Math.max(0, Math.min(caret, s.length));
  for (let i = 0; i < end; i++) {
    const c = s[i];
    if ((c >= "0" && c <= "9") || c === ",") n += 1;
  }
  return n;
}

/** Anlamlı karakter sayısına göre caret konumu (binlik noktaları atlanır). */
export function moneyCaretFromSignificant(s: string, significant: number): number {
  if (significant <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c >= "0" && c <= "9") || c === ",") {
      seen += 1;
      if (seen === significant) return i + 1;
    }
  }
  return s.length;
}

/**
 * Yazarken canlı TR para formatı (₺ yok).
 * 500000000 → 500.000.000
 * 100000,5 → 100.000,5
 * Boş string korunur.
 */
export function formatMoneyTypingTR(raw: string): string {
  let t = raw.replace(/\s/g, "").replace(/₺/g, "").replace(/TL/gi, "");
  if (!t) return "";

  let integerRaw: string;
  let decimalDigits: string | null = null;
  let trailingComma = false;

  if (t.includes(",")) {
    const idx = t.indexOf(",");
    integerRaw = t.slice(0, idx);
    decimalDigits = t
      .slice(idx + 1)
      .replace(/[^\d]/g, "")
      .slice(0, 2);
    trailingComma = t.endsWith(",") && decimalDigits.length === 0;
  } else if (/^[\d.]*\.\d{1,2}$/.test(t) && !/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // Yapıştırma: 100000.50 veya 12.5 (binlik grubu değil)
    const lastDot = t.lastIndexOf(".");
    integerRaw = t.slice(0, lastDot);
    decimalDigits = t
      .slice(lastDot + 1)
      .replace(/[^\d]/g, "")
      .slice(0, 2);
  } else {
    integerRaw = t;
  }

  const intDigits = integerRaw.replace(/[^\d]/g, "");

  if (!intDigits) {
    if (trailingComma) return "0,";
    if (decimalDigits != null && decimalDigits.length > 0) return `0,${decimalDigits}`;
    return "";
  }

  const formattedInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (trailingComma) return `${formattedInt},`;
  if (decimalDigits != null) return `${formattedInt},${decimalDigits}`;
  return formattedInt;
}

/** @deprecated formatMoneyTypingTR kullanın */
export function normalizeMoneyInput(raw: string): string {
  return formatMoneyTypingTR(raw);
}

/** Pozitif tutar (kaydetme). Boş veya ≤0 → null. */
export function parsePosTutar(raw: string): number | null {
  const n = parseCurrencyInputTR(raw);
  if (n == null || n <= 0) return null;
  return n;
}
