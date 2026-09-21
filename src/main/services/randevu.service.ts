import { getDb, nowIso } from "../db/connection";
import { authGetSession } from "./auth.service";
import { trimOrNull } from "./utils";
import type {
  Randevu,
  RandevuIslemSonuc,
  RandevuKullanici,
  RandevuListFilter,
  RandevuWriteInput,
} from "@shared/types/randevu";

function muvekkilAdFromRow(r: {
  muvekkil_turu?: string | null;
  ad_soyad?: string | null;
  sirket_unvani?: string | null;
}): string | null {
  if (r.muvekkil_turu === "TUZEL_KISI") {
    const unvan = (r.sirket_unvani ?? "").trim();
    if (unvan) return unvan;
  }
  const ad = (r.ad_soyad ?? "").trim();
  return ad || null;
}

function dosyaBaslikFromRow(r: { konu_basligi?: string | null; dosya_numarasi?: string | null }): string | null {
  const konu = (r.konu_basligi ?? "").trim();
  if (konu) return konu;
  const no = (r.dosya_numarasi ?? "").trim();
  return no || null;
}

function rowRandevu(r: Record<string, unknown>): Randevu {
  return {
    id: Number(r.id),
    baslik: String(r.baslik ?? ""),
    baslangicAt: String(r.baslangic_at ?? ""),
    bitisAt: String(r.bitis_at ?? ""),
    muvekkilId: r.muvekkil_id == null ? null : Number(r.muvekkil_id),
    dosyaId: r.dosya_id == null ? null : Number(r.dosya_id),
    sorumluKullaniciId: r.sorumlu_kullanici_id == null ? null : Number(r.sorumlu_kullanici_id),
    konum: trimOrNull(String(r.konum ?? "")),
    aciklama: trimOrNull(String(r.aciklama ?? "")),
    aktifMi: Number(r.aktif_mi ?? 1) !== 0,
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
    muvekkilAd: r.muvekkil_ad == null ? null : String(r.muvekkil_ad),
    dosyaBaslik: r.dosya_baslik == null ? null : String(r.dosya_baslik),
    sorumluAdSoyad: r.sorumlu_ad_soyad == null ? null : String(r.sorumlu_ad_soyad),
  };
}

const SELECT_RANDEVU = `
  SELECT
    r.*,
    CASE
      WHEN m.muvekkil_turu = 'TUZEL_KISI' AND TRIM(COALESCE(m.sirket_unvani, '')) != ''
        THEN TRIM(m.sirket_unvani)
      ELSE TRIM(COALESCE(m.ad_soyad, ''))
    END AS muvekkil_ad,
    CASE
      WHEN TRIM(COALESCE(d.konu_basligi, '')) != '' THEN TRIM(d.konu_basligi)
      ELSE TRIM(COALESCE(d.dosya_numarasi, ''))
    END AS dosya_baslik,
    TRIM(COALESCE(u.ad_soyad, '')) AS sorumlu_ad_soyad
  FROM randevu r
  LEFT JOIN muvekkil m ON m.id = r.muvekkil_id
  LEFT JOIN dosya d ON d.id = r.dosya_id
  LEFT JOIN uygulama_kullanici u ON u.id = r.sorumlu_kullanici_id
`;

function validateDates(baslangicAt: string, bitisAt: string): string | null {
  const start = new Date(baslangicAt);
  const end = new Date(bitisAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Geçersiz tarih veya saat.";
  }
  if (end <= start) {
    return "Bitiş saati başlangıçtan sonra olmalıdır.";
  }
  return null;
}

function validateRelations(input: RandevuWriteInput): string | null {
  const d = getDb();
  if (input.muvekkilId != null) {
    const m = d.prepare(`SELECT id FROM muvekkil WHERE id = ? AND aktif_mi = 1`).get(input.muvekkilId);
    if (!m) return "Müvekkil bulunamadı.";
  }
  if (input.dosyaId != null) {
    const dosya = d
      .prepare(`SELECT id, muvekkil_id FROM dosya WHERE id = ?`)
      .get(input.dosyaId) as { id: number; muvekkil_id: number } | undefined;
    if (!dosya) return "Dosya bulunamadı.";
    if (input.muvekkilId != null && dosya.muvekkil_id !== input.muvekkilId) {
      return "Dosya seçilen müvekkile ait değil.";
    }
  }
  if (input.sorumluKullaniciId != null) {
    const u = d
      .prepare(`SELECT id FROM uygulama_kullanici WHERE id = ? AND aktif_mi = 1`)
      .get(input.sorumluKullaniciId);
    if (!u) return "Sorumlu kullanıcı bulunamadı.";
  }
  return null;
}

function getById(id: number): Randevu | null {
  const row = getDb()
    .prepare(`${SELECT_RANDEVU} WHERE r.id = ? AND r.aktif_mi = 1`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowRandevu(row) : null;
}

export function randevuList(filtre: RandevuListFilter): Randevu[] {
  const start = new Date(filtre.baslangic);
  const end = new Date(filtre.bitis);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return [];
  }

  const clauses = ["r.aktif_mi = 1", "r.baslangic_at < ?", "r.bitis_at > ?"];
  const params: unknown[] = [filtre.bitis, filtre.baslangic];

  if (filtre.muvekkilId != null) {
    clauses.push("r.muvekkil_id = ?");
    params.push(filtre.muvekkilId);
  }
  if (filtre.sorumluKullaniciId != null) {
    clauses.push("r.sorumlu_kullanici_id = ?");
    params.push(filtre.sorumluKullaniciId);
  }

  const rows = getDb()
    .prepare(
      `${SELECT_RANDEVU}
       WHERE ${clauses.join(" AND ")}
       ORDER BY r.baslangic_at ASC, r.baslik ASC`,
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map(rowRandevu);
}

export function randevuGet(id: number): Randevu | null {
  return getById(id);
}

export function randevuKullanicilar(): RandevuKullanici[] {
  const rows = getDb()
    .prepare(`SELECT id, ad_soyad FROM uygulama_kullanici WHERE aktif_mi = 1 ORDER BY ad_soyad ASC`)
    .all() as { id: number; ad_soyad: string }[];
  return rows.map((r) => ({ id: Number(r.id), adSoyad: String(r.ad_soyad ?? "").trim() || `Kullanıcı #${r.id}` }));
}

export function randevuOlustur(input: RandevuWriteInput): RandevuIslemSonuc {
  const baslik = input.baslik?.trim();
  if (!baslik) return { ok: false, error: "Başlık zorunludur." };

  const dateErr = validateDates(input.baslangicAt, input.bitisAt);
  if (dateErr) return { ok: false, error: dateErr };

  const relErr = validateRelations(input);
  if (relErr) return { ok: false, error: relErr };

  const session = authGetSession();
  const t = nowIso();
  const d = getDb();
  const info = d
    .prepare(
      `INSERT INTO randevu (
        baslik, baslangic_at, bitis_at, muvekkil_id, dosya_id, sorumlu_kullanici_id,
        konum, aciklama, aktif_mi, olusturan_kullanici_id, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`,
    )
    .run(
      baslik,
      input.baslangicAt,
      input.bitisAt,
      input.muvekkilId ?? null,
      input.dosyaId ?? null,
      input.sorumluKullaniciId ?? null,
      trimOrNull(input.konum ?? null),
      trimOrNull(input.aciklama ?? null),
      session?.id ?? null,
      t,
      t,
    );

  const created = getById(Number(info.lastInsertRowid));
  if (!created) return { ok: false, error: "Randevu oluşturulamadı." };
  return { ok: true, data: created };
}

export function randevuGuncelle(id: number, input: RandevuWriteInput): RandevuIslemSonuc {
  const existing = getById(id);
  if (!existing) return { ok: false, error: "Randevu bulunamadı." };

  const baslik = input.baslik?.trim();
  if (!baslik) return { ok: false, error: "Başlık zorunludur." };

  const dateErr = validateDates(input.baslangicAt, input.bitisAt);
  if (dateErr) return { ok: false, error: dateErr };

  const relErr = validateRelations(input);
  if (relErr) return { ok: false, error: relErr };

  const t = nowIso();
  getDb()
    .prepare(
      `UPDATE randevu SET
        baslik = ?, baslangic_at = ?, bitis_at = ?, muvekkil_id = ?, dosya_id = ?,
        sorumlu_kullanici_id = ?, konum = ?, aciklama = ?, updated_at = ?
       WHERE id = ? AND aktif_mi = 1`,
    )
    .run(
      baslik,
      input.baslangicAt,
      input.bitisAt,
      input.muvekkilId ?? null,
      input.dosyaId ?? null,
      input.sorumluKullaniciId ?? null,
      trimOrNull(input.konum ?? null),
      trimOrNull(input.aciklama ?? null),
      t,
      id,
    );

  const updated = getById(id);
  if (!updated) return { ok: false, error: "Randevu güncellenemedi." };
  return { ok: true, data: updated };
}

export function randevuSil(id: number): { ok: true } | { ok: false; error: string } {
  const existing = getById(id);
  if (!existing) return { ok: false, error: "Randevu bulunamadı." };
  getDb()
    .prepare(`UPDATE randevu SET aktif_mi = 0, updated_at = ? WHERE id = ?`)
    .run(nowIso(), id);
  return { ok: true };
}

export { muvekkilAdFromRow, dosyaBaslikFromRow };
