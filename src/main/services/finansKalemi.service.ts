import { getDb, nowIso } from "../db/connection";
import {
  isDigerGelirKalemAd,
  isDigerGiderKalemAd,
  isPersonelMaasKalem,
  normalizeFinansKalemAd,
  type FinansKalemTuru,
} from "./finansKalemi.defaults";
import { writeAuditLog } from "./auditLog.service";

export type FinansKalemi = {
  id: number;
  tur: FinansKalemTuru;
  kod: string | null;
  ad: string;
  aktif: boolean;
  sistemMi: boolean;
  sira: number;
  archivedAt: string | null;
  olusturmaTarihi: string;
  guncellemeTarihi: string;
};

type Row = {
  id: number;
  tur: string;
  kod: string | null;
  ad: string;
  aktif: number;
  sistem_mi: number;
  sira: number;
  archived_at: string | null;
  olusturma_tarihi: string;
  guncelleme_tarihi: string;
};

function mapRow(r: Row): FinansKalemi {
  return {
    id: r.id,
    tur: r.tur as FinansKalemTuru,
    kod: r.kod,
    ad: r.ad,
    aktif: r.aktif === 1,
    sistemMi: r.sistem_mi === 1,
    sira: r.sira,
    archivedAt: r.archived_at,
    olusturmaTarihi: r.olusturma_tarihi,
    guncellemeTarihi: r.guncelleme_tarihi,
  };
}

export type ListFinansKalemOpts = {
  tur?: FinansKalemTuru;
  aktif?: "true" | "false" | "all";
  includeSistem?: boolean;
};

export function listFinansKalemleri(opts: ListFinansKalemOpts = {}): FinansKalemi[] {
  const d = getDb();
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (opts.tur) {
    where.push("tur = ?");
    params.push(opts.tur);
  }
  if (opts.aktif === "true") where.push("aktif = 1");
  else if (opts.aktif === "false") where.push("aktif = 0");
  if (!opts.includeSistem) where.push("sistem_mi = 0");
  const rows = d
    .prepare(
      `SELECT * FROM finans_kalemi WHERE ${where.join(" AND ")} ORDER BY tur ASC, aktif DESC, sira ASC, id ASC`,
    )
    .all(...params) as Row[];
  return rows.map(mapRow);
}

export function getFinansKalemi(id: number): FinansKalemi | null {
  const r = getDb().prepare(`SELECT * FROM finans_kalemi WHERE id = ?`).get(id) as Row | undefined;
  return r ? mapRow(r) : null;
}

export function getFinansKalemiByKod(kod: string): FinansKalemi | null {
  const r = getDb()
    .prepare(`SELECT * FROM finans_kalemi WHERE kod = ? LIMIT 1`)
    .get(kod.trim()) as Row | undefined;
  return r ? mapRow(r) : null;
}

/** Ofis formu: aktif manuel kalemler (sistem hariç). */
export function listAktifManuelKalemler(tur: FinansKalemTuru): FinansKalemi[] {
  return listFinansKalemleri({ tur, aktif: "true", includeSistem: false });
}

export function resolveAktifManuelKalem(
  kalemId: number,
  tip: FinansKalemTuru,
): { ok: true; kalem: FinansKalemi } | { ok: false; error: string } {
  const k = getFinansKalemi(kalemId);
  if (!k) return { ok: false, error: "Kalem bulunamadı." };
  if (k.sistemMi) return { ok: false, error: "Sistem kalemi manuel hareket için seçilemez." };
  if (!k.aktif) return { ok: false, error: "Pasif kalem yeni kayıtta kullanılamaz." };
  if (k.tur !== tip) return { ok: false, error: "Kalem, işlem tipiyle uyuşmuyor." };
  return { ok: true, kalem: k };
}

export function kalemOzelAdGerekli(kalem: FinansKalemi): boolean {
  if (kalem.tur === "GELIR") return isDigerGelirKalemAd(kalem.ad);
  return isDigerGiderKalemAd(kalem.ad) || isPersonelMaasKalem(kalem.kod, kalem.ad);
}

export function createFinansKalemi(
  tur: FinansKalemTuru,
  ad: string,
  user?: { id: number; adSoyad: string } | null,
): { ok: true; row: FinansKalemi } | { ok: false; error: string } {
  const trimmed = ad.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return { ok: false, error: "Kalem adı en az 2 karakter olmalı." };
  const normalizeAd = normalizeFinansKalemAd(trimmed);
  const d = getDb();
  const exists = d
    .prepare(`SELECT id FROM finans_kalemi WHERE tur = ? AND normalize_ad = ?`)
    .get(tur, normalizeAd) as { id: number } | undefined;
  if (exists) return { ok: false, error: "Bu isimde bir kalem zaten var." };
  const maxSira = (
    d.prepare(`SELECT COALESCE(MAX(sira), 9) AS m FROM finans_kalemi WHERE tur = ? AND sistem_mi = 0`).get(tur) as {
      m: number;
    }
  ).m;
  const t = nowIso();
  const info = d
    .prepare(
      `INSERT INTO finans_kalemi (tur, kod, ad, normalize_ad, aktif, sistem_mi, sira, archived_at, olusturma_tarihi, guncelleme_tarihi)
       VALUES (?, NULL, ?, ?, 1, 0, ?, NULL, ?, ?)`,
    )
    .run(tur, trimmed, normalizeAd, maxSira + 1, t, t);
  const row = getFinansKalemi(Number(info.lastInsertRowid))!;
  writeAuditLog({
    kullaniciId: user?.id ?? null,
    kullaniciAdi: user?.adSoyad ?? null,
    eylem: "FINANS_KALEM_OLUSTUR",
    varlikTipi: "finans_kalemi",
    varlikId: String(row.id),
    ozet: `${tur} kalemi eklendi: ${trimmed}`,
  });
  return { ok: true, row };
}

export function updateFinansKalemi(
  id: number,
  ad: string,
  user?: { id: number; adSoyad: string } | null,
): { ok: true; row: FinansKalemi } | { ok: false; error: string } {
  const mevcut = getFinansKalemi(id);
  if (!mevcut) return { ok: false, error: "Kalem bulunamadı." };
  if (mevcut.sistemMi) return { ok: false, error: "Sistem kalemi düzenlenemez." };
  const trimmed = ad.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return { ok: false, error: "Kalem adı en az 2 karakter olmalı." };
  const normalizeAd = normalizeFinansKalemAd(trimmed);
  const conflict = getDb()
    .prepare(`SELECT id FROM finans_kalemi WHERE tur = ? AND normalize_ad = ? AND id != ?`)
    .get(mevcut.tur, normalizeAd, id) as { id: number } | undefined;
  if (conflict) return { ok: false, error: "Bu isimde bir kalem zaten var." };
  getDb()
    .prepare(`UPDATE finans_kalemi SET ad = ?, normalize_ad = ?, guncelleme_tarihi = ? WHERE id = ?`)
    .run(trimmed, normalizeAd, nowIso(), id);
  const row = getFinansKalemi(id)!;
  writeAuditLog({
    kullaniciId: user?.id ?? null,
    kullaniciAdi: user?.adSoyad ?? null,
    eylem: "FINANS_KALEM_GUNCELLE",
    varlikTipi: "finans_kalemi",
    varlikId: String(id),
    ozet: `Kalem güncellendi: ${trimmed}`,
  });
  return { ok: true, row };
}

export function archiveFinansKalemi(
  id: number,
  user?: { id: number; adSoyad: string } | null,
): { ok: true; row: FinansKalemi } | { ok: false; error: string } {
  const mevcut = getFinansKalemi(id);
  if (!mevcut) return { ok: false, error: "Kalem bulunamadı." };
  if (mevcut.sistemMi) return { ok: false, error: "Sistem kalemi kaldırılamaz." };
  if (!mevcut.aktif) return { ok: false, error: "Kalem zaten pasif." };
  const t = nowIso();
  getDb()
    .prepare(`UPDATE finans_kalemi SET aktif = 0, archived_at = ?, guncelleme_tarihi = ? WHERE id = ?`)
    .run(t, t, id);
  const row = getFinansKalemi(id)!;
  writeAuditLog({
    kullaniciId: user?.id ?? null,
    kullaniciAdi: user?.adSoyad ?? null,
    eylem: "FINANS_KALEM_ARSIV",
    varlikTipi: "finans_kalemi",
    varlikId: String(id),
    ozet: `Kalem kaldırıldı: ${mevcut.ad}`,
  });
  return { ok: true, row };
}

export function activateFinansKalemi(
  id: number,
  user?: { id: number; adSoyad: string } | null,
): { ok: true; row: FinansKalemi } | { ok: false; error: string } {
  const mevcut = getFinansKalemi(id);
  if (!mevcut) return { ok: false, error: "Kalem bulunamadı." };
  if (mevcut.sistemMi) return { ok: false, error: "Sistem kalemi değiştirilemez." };
  getDb()
    .prepare(`UPDATE finans_kalemi SET aktif = 1, archived_at = NULL, guncelleme_tarihi = ? WHERE id = ?`)
    .run(nowIso(), id);
  const row = getFinansKalemi(id)!;
  writeAuditLog({
    kullaniciId: user?.id ?? null,
    kullaniciAdi: user?.adSoyad ?? null,
    eylem: "FINANS_KALEM_AKTIF",
    varlikTipi: "finans_kalemi",
    varlikId: String(id),
    ozet: `Kalem yeniden etkinleştirildi: ${mevcut.ad}`,
  });
  return { ok: true, row };
}

export function reorderFinansKalemleri(
  tur: FinansKalemTuru,
  orderedIds: number[],
  user?: { id: number; adSoyad: string } | null,
): { ok: true } | { ok: false; error: string } {
  const aktif = listFinansKalemleri({ tur, aktif: "true", includeSistem: false });
  const aktifIds = new Set(aktif.map((k) => k.id));
  if (orderedIds.length !== aktifIds.size || orderedIds.some((id) => !aktifIds.has(id))) {
    return { ok: false, error: "Sıralama listesi aktif kalemlerle uyuşmuyor." };
  }
  const d = getDb();
  const upd = d.prepare(`UPDATE finans_kalemi SET sira = ?, guncelleme_tarihi = ? WHERE id = ? AND sistem_mi = 0`);
  const t = nowIso();
  const tx = d.transaction(() => {
    orderedIds.forEach((id, i) => upd.run(i + 10, t, id));
  });
  tx();
  writeAuditLog({
    kullaniciId: user?.id ?? null,
    kullaniciAdi: user?.adSoyad ?? null,
    eylem: "FINANS_KALEM_SIRALA",
    varlikTipi: "finans_kalemi",
    varlikId: tur,
    ozet: `${tur} kalemleri yeniden sıralandı`,
  });
  return { ok: true };
}
