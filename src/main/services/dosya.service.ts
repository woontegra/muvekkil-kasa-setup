import { getDb, nowIso } from "../db/connection";
import type { Dosya, DosyaDurum, DosyaInput, DosyaUpdateInput } from "@shared/types/dosya";
import type {
  DosyaListeParams,
  DosyaListeSatir,
  DosyaListeSonuc,
} from "@shared/types/dosyaListe";
import { DOSYA_LISTE_PAGE_SIZES } from "@shared/types/dosyaListe";
import { trimOrNull } from "./utils";

function normalizeDurum(v: unknown): DosyaDurum {
  const s = String(v ?? "AKTIF").toUpperCase();
  if (s === "PASIF" || s === "KAPANDI") return s;
  return "AKTIF";
}

function rowDosya(r: Record<string, unknown>): Dosya {
  return {
    id: Number(r.id),
    muvekkilId: Number(r.muvekkil_id),
    konuBasligi: r.konu_basligi == null ? null : String(r.konu_basligi),
    mahkemeAdi: r.mahkeme_adi == null ? null : String(r.mahkeme_adi),
    dosyaNumarasi: r.dosya_numarasi == null ? null : String(r.dosya_numarasi),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    durum: normalizeDurum(r.durum),
    not: r.notu == null ? null : String(r.notu),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

export function dosyaListByMuvekkil(muvekkilId: number): Dosya[] {
  const files = getDb()
    .prepare(`SELECT * FROM dosya WHERE muvekkil_id = ? ORDER BY id ASC`)
    .all(muvekkilId) as Record<string, unknown>[];
  return files.map(rowDosya);
}

/** Müvekkil adı tüzel kişide şirket ünvanına düşer — muvekkil.service ile aynı kural. */
const MUVEKKIL_AD_SQL = `CASE
    WHEN COALESCE(m.muvekkil_turu, 'GERCEK_KISI') = 'TUZEL_KISI'
      AND NULLIF(TRIM(m.sirket_unvani), '') IS NOT NULL
    THEN TRIM(m.sirket_unvani)
    ELSE TRIM(COALESCE(m.ad_soyad, ''))
  END`;

function rowDosyaListe(r: Record<string, unknown>): DosyaListeSatir {
  const str = (key: string): string | null => {
    const v = r[key];
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return {
    id: Number(r.id),
    muvekkilId: Number(r.muvekkil_id),
    muvekkilAd: String(r.muvekkil_ad ?? "").trim() || "—",
    konuBasligi: str("konu_basligi"),
    mahkemeAdi: str("mahkeme_adi"),
    dosyaNumarasi: str("dosya_numarasi"),
    durum: normalizeDurum(r.durum),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

/**
 * Tüm büronun dosyaları — müvekkil adı tek SQL JOIN ile gelir (N+1 yok).
 * Sıralama: son güncellenen üstte.
 */
export function dosyaListAll(params: DosyaListeParams = {}): DosyaListeSonuc {
  const d = getDb();
  const allowed = new Set<number>(DOSYA_LISTE_PAGE_SIZES);
  const pageSize = allowed.has(Number(params.pageSize)) ? Number(params.pageSize) : 20;

  const clauses: string[] = [];
  const binds: unknown[] = [];

  const term = (params.q ?? "").trim();
  if (term) {
    const like = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    clauses.push(`(
      COALESCE(d.konu_basligi, '') LIKE ? ESCAPE '\\'
      OR COALESCE(d.dosya_numarasi, '') LIKE ? ESCAPE '\\'
      OR COALESCE(d.mahkeme_adi, '') LIKE ? ESCAPE '\\'
      OR COALESCE(d.aciklama, '') LIKE ? ESCAPE '\\'
      OR ${MUVEKKIL_AD_SQL} LIKE ? ESCAPE '\\'
      OR COALESCE(m.telefon, '') LIKE ? ESCAPE '\\'
    )`);
    binds.push(like, like, like, like, like, like);
  }

  const durum = params.durum ?? "TUMU";
  if (durum !== "TUMU") {
    clauses.push(`COALESCE(d.durum, 'AKTIF') = ?`);
    binds.push(normalizeDurum(durum));
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const fromSql = ` FROM dosya d LEFT JOIN muvekkil m ON m.id = d.muvekkil_id${whereSql}`;

  const total =
    Number((d.prepare(`SELECT COUNT(*) AS c${fromSql}`).get(...binds) as { c: number }).c) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  let page = Math.max(1, Math.floor(Number(params.page)) || 1);
  if (totalPages > 0 && page > totalPages) page = totalPages;
  const offset = total === 0 ? 0 : (page - 1) * pageSize;

  const rows = d
    .prepare(
      `SELECT d.id, d.muvekkil_id, d.konu_basligi, d.mahkeme_adi, d.dosya_numarasi, d.durum,
              d.kayit_tarihi, d.guncelleme_tarihi, ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       ${fromSql}
       ORDER BY d.guncelleme_tarihi DESC, d.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...binds, pageSize, offset) as Record<string, unknown>[];

  return { items: rows.map(rowDosyaListe), total, page, pageSize, totalPages };
}

export function dosyaGet(id: number): Dosya | null {
  const r = getDb().prepare(`SELECT * FROM dosya WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? rowDosya(r) : null;
}

export function dosyaEkle(input: DosyaInput): Dosya {
  const konu = (input.konuBasligi ?? "").trim();
  const mahkeme = (input.mahkemeAdi ?? "").trim();
  const no = (input.dosyaNumarasi ?? "").trim();
  if (!konu) throw new Error("Konu başlığı zorunludur");
  if (!mahkeme) throw new Error("Mahkeme adı zorunludur");
  if (!no) throw new Error("Dosya numarası zorunludur");
  const d = getDb();
  const t = nowIso();
  const r = d
    .prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, mahkeme_adi, dosya_numarasi, aciklama, durum, notu, kayit_tarihi, guncelleme_tarihi)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.muvekkilId,
      konu,
      mahkeme,
      no,
      trimOrNull(input.aciklama),
      normalizeDurum(input.durum ?? "AKTIF"),
      trimOrNull(input.not),
      t,
      t
    );
  const id = Number(r.lastInsertRowid);
  const row = dosyaGet(id);
  if (!row) throw new Error("Dosya kaydı oluşturuldu ancak doğrulanamadı.");
  return row;
}

export function dosyaGuncelle(id: number, input: DosyaUpdateInput): Dosya | null {
  const d = getDb();
  const t = nowIso();
  const cur = dosyaGet(id);
  if (!cur) return null;
  d.prepare(
    `UPDATE dosya SET konu_basligi = ?, mahkeme_adi = ?, dosya_numarasi = ?, aciklama = ?, durum = ?, notu = ?, guncelleme_tarihi = ? WHERE id = ?`
  ).run(
    input.konuBasligi ?? cur.konuBasligi,
    input.mahkemeAdi ?? cur.mahkemeAdi,
    input.dosyaNumarasi ?? cur.dosyaNumarasi,
    input.aciklama !== undefined ? trimOrNull(input.aciklama) : cur.aciklama,
    input.durum ? normalizeDurum(input.durum) : cur.durum,
    input.not !== undefined ? trimOrNull(input.not) : cur.not,
    t,
    id
  );
  return dosyaGet(id);
}
