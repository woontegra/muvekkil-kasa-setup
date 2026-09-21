/** Kuruş (integer) cinsinden güvenli para karşılaştırması */

export function toKurus(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromKurus(k: number): number {
  return k / 100;
}

/** a > b (kuruş) */
export function kurusBuyuktur(a: number, b: number): boolean {
  return toKurus(a) > toKurus(b);
}

/** max(0, a - b) TL */
export function kurusFarkTl(a: number, b: number): number {
  return fromKurus(Math.max(0, toKurus(a) - toKurus(b)));
}
