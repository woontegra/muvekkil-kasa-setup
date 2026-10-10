/**
 * Düzeltme ↔ parent gruplama / ekonomik tarih sıralaması.
 * Tahmin yok — yalnız orijinal parent id.
 */

export type DuzeltmeGroupable = {
  id: string;
  isDuzeltme: boolean;
  orijinalHareketId: string | null;
  /** Ekonomik dönem tarihi (parent.tarih veya self.tarih) */
  economicAt: Date;
  /** Deterministik: createdAt */
  createdAt: Date;
  /** Audit düzeltme zamanı */
  duzeltmeAt: Date | null;
};

export type GroupedFinanceRow<T extends DuzeltmeGroupable> = {
  groupKey: string;
  economicAt: Date;
  parent: T | null;
  corrections: T[];
  orphanWarning: boolean;
};

/**
 * Gruplar: parent id (veya orphan duzeltme kendi id).
 * Sıra: economicAt desc, groupKey desc; grup içinde corrections önce (üstte), sonra parent.
 */
export function groupDuzeltmeWithParents<T extends DuzeltmeGroupable>(
  rows: T[],
): GroupedFinanceRow<T>[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups = new Map<string, GroupedFinanceRow<T>>();

  function ensure(key: string, economicAt: Date): GroupedFinanceRow<T> {
    let g = groups.get(key);
    if (!g) {
      g = { groupKey: key, economicAt, parent: null, corrections: [], orphanWarning: false };
      groups.set(key, g);
    }
    return g;
  }

  for (const r of rows) {
    if (r.isDuzeltme) {
      if (r.orijinalHareketId) {
        const parent = byId.get(r.orijinalHareketId);
        const g = ensure(r.orijinalHareketId, parent?.economicAt ?? r.economicAt);
        g.corrections.push(r);
        if (parent && g.economicAt.getTime() !== parent.economicAt.getTime()) {
          g.economicAt = parent.economicAt;
        }
      } else {
        const g = ensure(r.id, r.economicAt);
        g.corrections.push(r);
        g.orphanWarning = true;
      }
    } else {
      const g = ensure(r.id, r.economicAt);
      g.parent = r;
      g.economicAt = r.economicAt;
    }
  }

  for (const g of groups.values()) {
    if (!g.parent && g.corrections.length > 0 && g.corrections.every((c) => c.orijinalHareketId)) {
      g.orphanWarning = true;
    }
  }

  const list = [...groups.values()];
  list.sort((a, b) => {
    const t = b.economicAt.getTime() - a.economicAt.getTime();
    if (t !== 0) return t;
    return b.groupKey.localeCompare(a.groupKey);
  });

  for (const g of list) {
    g.corrections.sort((a, b) => {
      const da = (a.duzeltmeAt ?? a.createdAt).getTime();
      const db = (b.duzeltmeAt ?? b.createdAt).getTime();
      if (db !== da) return db - da;
      return b.id.localeCompare(a.id);
    });
  }

  return list;
}

/** Düz grup → düz liste: her grupta önce düzeltmeler, sonra parent. */
export function flattenGroupedFinanceRows<T extends DuzeltmeGroupable>(groups: GroupedFinanceRow<T>[]): T[] {
  const out: T[] = [];
  for (const g of groups) {
    out.push(...g.corrections);
    if (g.parent) out.push(g.parent);
  }
  return out;
}
