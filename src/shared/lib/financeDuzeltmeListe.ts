import { duzeltmeKasaEtkisiFromRow } from "../ofisKasaDuzeltme";
import type { KasaHareket } from "../types/kasa";
import type { OfisKasaHareketListeSatir } from "../types/ofisKasa";
import {
  flattenGroupedFinanceRows,
  groupDuzeltmeWithParents,
  type DuzeltmeGroupable,
  type GroupedFinanceRow,
} from "./duzeltmeGrouping";

export const BAGLI_ISLEM_UYARI = "Bağlı işlem bulunamadı";

function ymdFromLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseFinanceInstant(iso: string | null | undefined): Date {
  const s = (iso ?? "").trim();
  if (!s) return new Date(0);
  const d = s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : new Date(0);
}

export function kasaEconomicYmd(
  h: Pick<KasaHareket, "islemTipi" | "tarih" | "duzeltilenIslemId">,
  parentTarih: string | null | undefined,
): string {
  if (h.islemTipi === "DUZELTME") return (parentTarih ?? h.tarih).slice(0, 10);
  return h.tarih.slice(0, 10);
}

export function ofisEconomicYmd(
  h: Pick<OfisKasaHareketListeSatir, "islemTipi" | "tarih" | "orijinalHareketId">,
  parentTarih: string | null | undefined,
): string {
  if (h.islemTipi === "DUZELTME") return (parentTarih ?? h.tarih).slice(0, 10);
  return h.tarih.slice(0, 10);
}

type KasaGroupRow = KasaHareket & DuzeltmeGroupable;

export function groupKasaHareketListe(rows: KasaHareket[]): KasaHareket[] {
  if (rows.length === 0) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groupables: KasaGroupRow[] = rows.map((h) => {
    const parent = h.duzeltilenIslemId != null ? byId.get(h.duzeltilenIslemId) : undefined;
    const economicYmd = kasaEconomicYmd(h, parent?.tarih ?? null);
    const isDuz = h.islemTipi === "DUZELTME";
    return {
      ...h,
      id: String(h.id),
      isDuzeltme: isDuz,
      orijinalHareketId: h.duzeltilenIslemId != null ? String(h.duzeltilenIslemId) : null,
      economicAt: parseFinanceInstant(economicYmd),
      createdAt: parseFinanceInstant(h.kayitTarihi),
      duzeltmeAt: isDuz ? parseFinanceInstant(h.kayitTarihi) : null,
    };
  });

  const groups = groupDuzeltmeWithParents(groupables);
  applyKasaGroupMeta(groups, byId);
  return flattenGroupedFinanceRows(groups).map(restoreKasaId);
}

function restoreKasaId(h: KasaGroupRow): KasaHareket {
  const { id: _id, isDuzeltme: _d, orijinalHareketId: _o, economicAt: _e, createdAt: _c, duzeltmeAt: _da, ...rest } =
    h;
  return { ...rest, id: Number(h.id) };
}

function applyKasaGroupMeta(groups: GroupedFinanceRow<KasaGroupRow>[], byId: Map<number, KasaHareket>) {
  for (const g of groups) {
    const economicYmd = ymdFromLocalDate(g.economicAt);
    if (g.parent) {
      g.parent.duzeltildi = g.corrections.length > 0;
      g.parent.hasCorrection = g.corrections.length > 0;
      g.parent.economicTarih = economicYmd;
      g.parent.orphanWarning = false;
      g.parent.bagliIslemUyari = null;
    }
    for (const c of g.corrections) {
      const orphan = g.orphanWarning || c.orijinalHareketId == null;
      c.economicTarih = economicYmd;
      c.orphanWarning = orphan;
      c.bagliIslemUyari = orphan ? BAGLI_ISLEM_UYARI : null;
      c.bakiyeEtkisi = c.tutar;
      const parent = c.orijinalHareketId ? byId.get(Number(c.orijinalHareketId)) : undefined;
      if (parent?.belgeNo?.trim()) c.orijinalBelgeNo = parent.belgeNo.trim();
      const user = c.olusturanKullaniciAdi?.trim();
      if (user) c.duzeltenUserAd = user;
    }
  }
}

/** Liste sırası: düzeltmeler, sonra parent — grupları bozmadan filtre. */
export function filterFinanceListePreservingGroups<T extends { id: number; islemTipi?: string }>(
  liste: T[],
  isCorrection: (h: T) => boolean,
  parentIdOf: (h: T) => number | null | undefined,
  matches: (h: T) => boolean,
): T[] {
  const out: T[] = [];
  let i = 0;
  while (i < liste.length) {
    if (isCorrection(liste[i])) {
      const pid = parentIdOf(liste[i]);
      const chunk: T[] = [];
      while (i < liste.length && isCorrection(liste[i]) && parentIdOf(liste[i]) === pid) {
        chunk.push(liste[i++]);
      }
      if (i < liste.length && pid != null && liste[i].id === pid) chunk.push(liste[i++]);
      if (chunk.some(matches)) out.push(...chunk);
    } else {
      const row = liste[i++];
      if (matches(row)) out.push(row);
    }
  }
  return out;
}

export function runDuzeltmeGroupingUnitSmoke(): void {
  type R = DuzeltmeGroupable & { label: string };
  const mk = (
    id: string,
    isDuz: boolean,
    orig: string | null,
    economic: string,
    created: string,
  ): R => ({
    id,
    label: id,
    isDuzeltme: isDuz,
    orijinalHareketId: orig,
    economicAt: parseFinanceInstant(economic),
    createdAt: parseFinanceInstant(created),
    duzeltmeAt: isDuz ? parseFinanceInstant(created) : null,
  });
  const groups = groupDuzeltmeWithParents([
    mk("p1", false, null, "2026-01-15", "2026-01-15"),
    mk("c1", true, "p1", "2026-01-15", "2026-02-01"),
    mk("p2", false, null, "2026-01-10", "2026-01-10"),
  ]);
  const flat = flattenGroupedFinanceRows(groups).map((r) => r.id);
  if (flat[0] !== "c1" || flat[1] !== "p1") {
    throw new Error(`group order expected c1,p1 first, got ${flat.join(",")}`);
  }
}

type OfisGroupRow = OfisKasaHareketListeSatir & DuzeltmeGroupable;

export function groupOfisKasaHareketListe(rows: OfisKasaHareketListeSatir[]): OfisKasaHareketListeSatir[] {
  if (rows.length === 0) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groupables: OfisGroupRow[] = rows.map((h) => {
    const parent = h.orijinalHareketId != null ? byId.get(h.orijinalHareketId) : undefined;
    const economicYmd = ofisEconomicYmd(h, parent?.tarih ?? null);
    const isDuz = h.islemTipi === "DUZELTME";
    return {
      ...h,
      id: String(h.id),
      isDuzeltme: isDuz,
      orijinalHareketId: h.orijinalHareketId != null ? String(h.orijinalHareketId) : null,
      economicAt: parseFinanceInstant(economicYmd),
      createdAt: parseFinanceInstant(h.olusturmaTarihi),
      duzeltmeAt: isDuz ? parseFinanceInstant(h.tarih) : null,
    };
  });

  const groups = groupDuzeltmeWithParents(groupables);
  applyOfisGroupMeta(groups, byId);
  return flattenGroupedFinanceRows(groups).map(restoreOfisId);
}

function restoreOfisId(h: OfisGroupRow): OfisKasaHareketListeSatir {
  const { id: _id, isDuzeltme: _d, orijinalHareketId: _o, economicAt: _e, createdAt: _c, duzeltmeAt: _da, ...rest } =
    h;
  return { ...rest, id: Number(h.id) };
}

function applyOfisGroupMeta(
  groups: GroupedFinanceRow<OfisGroupRow>[],
  byId: Map<number, OfisKasaHareketListeSatir>,
) {
  for (const g of groups) {
    const economicYmd = ymdFromLocalDate(g.economicAt);
    if (g.parent) {
      g.parent.duzeltildi = g.corrections.length > 0;
      g.parent.hasCorrection = g.corrections.length > 0;
      g.parent.economicTarih = economicYmd;
      g.parent.orphanWarning = false;
      g.parent.bagliIslemUyari = null;
    }
    for (const c of g.corrections) {
      const orphan = g.orphanWarning || c.orijinalHareketId == null;
      c.economicTarih = economicYmd;
      c.orphanWarning = orphan;
      c.bagliIslemUyari = orphan ? BAGLI_ISLEM_UYARI : null;
      c.bakiyeEtkisi = duzeltmeKasaEtkisiFromRow(c);
      const parent = c.orijinalHareketId ? byId.get(Number(c.orijinalHareketId)) : undefined;
      if (parent?.belgeNo?.trim()) c.orijinalBelgeNo = parent.belgeNo.trim();
      const user = c.olusturanKullaniciAdi?.trim();
      if (user) c.duzeltenUserAd = user;
    }
  }
}
