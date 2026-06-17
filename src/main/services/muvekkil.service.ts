import { getDb, nowIso } from "../db/connection";
import type { Muvekkil, MuvekkilInput, MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import { trimOrNull } from "./utils";

function rowMuvekkil(r: Record<string, unknown>): Muvekkil {
  const tr = r.muvekkil_turu;
  const tur = tr === "TUZEL_KISI" ? "TUZEL_KISI" : "GERCEK_KISI";
  const strCol = (key: string): string | null => {
    const v = r[key];
    if (v == null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  return {
    id: Number(r.id),
    muvekkilTuru: tur,
    adSoyad: String(r.ad_soyad ?? ""),
    telefon: strCol("telefon"),
    eposta: strCol("eposta"),
    adres: strCol("adres"),
    sirketUnvani: strCol("sirket_unvani"),
    yetkiliAdSoyad: strCol("yetkili_ad_soyad"),
    yetkiliTelefon: strCol("yetkili_telefon"),
    mudurAdSoyad: strCol("mudur_ad_soyad"),
    mudurTelefon: strCol("mudur_telefon"),
    muhasebeAdSoyad: strCol("muhasebe_ad_soyad"),
    muhasebeTelefon: strCol("muhasebe_telefon"),
    vergiNo: strCol("vergi_no"),
    vergiDairesi: strCol("vergi_dairesi"),
    aktifMi: Number(r.aktif_mi ?? 1) !== 0,
    not: strCol("notu"),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function validateMuvekkilKayit(input: MuvekkilInput): string | null {
  const tur = input.muvekkilTuru === "TUZEL_KISI" ? "TUZEL_KISI" : "GERCEK_KISI";
  if (tur === "GERCEK_KISI") {
    if (!trimOrNull(input.adSoyad)) return "Ad soyad zorunludur.";
    if (!trimOrNull(input.telefon)) return "Telefon zorunludur.";
    return null;
  }
  if (!trimOrNull(input.sirketUnvani)) return "Şirket adı / ünvan zorunludur.";
  const yAd = trimOrNull(input.yetkiliAdSoyad);
  const yTel = trimOrNull(input.yetkiliTelefon);
  if (!yAd && !yTel) {
    return "Yetkili kişi adı soyadı veya yetkili telefon alanlarından en az biri zorunludur.";
  }
  return null;
}

function sqlMuvekkilGorunenAd(aliasDot: string): string {
  return `CASE WHEN COALESCE(${aliasDot}muvekkil_turu, 'GERCEK_KISI') = 'TUZEL_KISI' AND NULLIF(TRIM(${aliasDot}sirket_unvani), '') IS NOT NULL THEN TRIM(${aliasDot}sirket_unvani) ELSE TRIM(${aliasDot}ad_soyad) END`;
}

function muvekkilAramaWhereSqlBinds(q: string) {
  const term = q.trim();
  if (!term) return { whereSql: "", binds: [] as string[] };
  const like = `%${term.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const searchSql = `(
    COALESCE(ad_soyad,'') LIKE ? ESCAPE '\\'
    OR COALESCE(telefon,'') LIKE ? ESCAPE '\\'
    OR COALESCE(eposta,'') LIKE ? ESCAPE '\\'
    OR COALESCE(sirket_unvani,'') LIKE ? ESCAPE '\\'
    OR COALESCE(yetkili_ad_soyad,'') LIKE ? ESCAPE '\\'
    OR COALESCE(yetkili_telefon,'') LIKE ? ESCAPE '\\'
    OR COALESCE(mudur_ad_soyad,'') LIKE ? ESCAPE '\\'
    OR COALESCE(mudur_telefon,'') LIKE ? ESCAPE '\\'
    OR COALESCE(muhasebe_ad_soyad,'') LIKE ? ESCAPE '\\'
    OR COALESCE(muhasebe_telefon,'') LIKE ? ESCAPE '\\'
    OR COALESCE(vergi_no,'') LIKE ? ESCAPE '\\'
    OR COALESCE(adres,'') LIKE ? ESCAPE '\\'
  )`;
  return { whereSql: ` WHERE ${searchSql} `, binds: Array(12).fill(like) };
}

function aktifDosyaSayisi(muvekkilId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM dosya WHERE muvekkil_id = ? AND COALESCE(durum, 'AKTIF') = 'AKTIF'`
    )
    .get(muvekkilId) as { c: number };
  return Number(row.c) || 0;
}

function withDosyaCount(m: Muvekkil): MuvekkilListItem {
  return { ...m, aktifDosyaSayisi: aktifDosyaSayisi(m.id) };
}

export function muvekkilAra(q: string): MuvekkilListItem[] {
  const d = getDb();
  const { whereSql, binds } = muvekkilAramaWhereSqlBinds(q);
  const orderExpr = sqlMuvekkilGorunenAd("");
  const rows = d
    .prepare(`SELECT * FROM muvekkil${whereSql} ORDER BY ${orderExpr} COLLATE NOCASE LIMIT 200`)
    .all(...binds) as Record<string, unknown>[];
  return rows.map((r) => withDosyaCount(rowMuvekkil(r)));
}

export function muvekkilAraPaged(q: string, page: number, pageSize: number): MuvekkilPagedResult {
  const allowed = new Set([20, 50, 100]);
  const ps = allowed.has(pageSize) ? pageSize : 20;
  const d = getDb();
  const { whereSql, binds } = muvekkilAramaWhereSqlBinds(q);
  const orderExpr = sqlMuvekkilGorunenAd("");
  const countRow = d.prepare(`SELECT COUNT(*) AS c FROM muvekkil${whereSql}`).get(...binds) as { c: number };
  const total = Number(countRow.c) || 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / ps);
  let safePage = Math.max(1, Math.floor(Number(page)) || 1);
  if (totalPages > 0 && safePage > totalPages) safePage = totalPages;
  const offset = total === 0 ? 0 : (safePage - 1) * ps;
  const rows = d
    .prepare(`SELECT * FROM muvekkil${whereSql} ORDER BY ${orderExpr} COLLATE NOCASE LIMIT ? OFFSET ?`)
    .all(...binds, ps, offset) as Record<string, unknown>[];
  return {
    items: rows.map((r) => withDosyaCount(rowMuvekkil(r))),
    total,
    page: safePage,
    pageSize: ps,
    totalPages,
  };
}

export function muvekkilGet(id: number): Muvekkil | null {
  const r = getDb().prepare(`SELECT * FROM muvekkil WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? rowMuvekkil(r) : null;
}

export function muvekkilEkle(input: MuvekkilInput): Muvekkil {
  const err = validateMuvekkilKayit(input);
  if (err) throw new Error(err);
  const d = getDb();
  const t = nowIso();
  const tur = input.muvekkilTuru === "TUZEL_KISI" ? "TUZEL_KISI" : "GERCEK_KISI";

  if (tur === "GERCEK_KISI") {
    const r = d
      .prepare(
        `INSERT INTO muvekkil (
          muvekkil_turu, ad_soyad, telefon, eposta, adres, sirket_unvani, yetkili_ad_soyad, yetkili_telefon,
          mudur_ad_soyad, mudur_telefon, muhasebe_ad_soyad, muhasebe_telefon, vergi_no, vergi_dairesi,
          aktif_mi, notu, kayit_tarihi, guncelleme_tarihi
        ) VALUES ('GERCEK_KISI', ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, ?, ?, ?)`
      )
      .run(trimOrNull(input.adSoyad), trimOrNull(input.telefon), trimOrNull(input.eposta), trimOrNull(input.adres), trimOrNull(input.not), t, t);
    const id = Number(r.lastInsertRowid);
    const row = muvekkilGet(id);
    if (!row) throw new Error("Müvekkil kaydı oluşturuldu ancak doğrulanamadı.");
    return row;
  }

  const rr = d
    .prepare(
      `INSERT INTO muvekkil (
        muvekkil_turu, ad_soyad, telefon, eposta, adres, sirket_unvani, yetkili_ad_soyad, yetkili_telefon,
        mudur_ad_soyad, mudur_telefon, muhasebe_ad_soyad, muhasebe_telefon, vergi_no, vergi_dairesi,
        aktif_mi, notu, kayit_tarihi, guncelleme_tarihi
      ) VALUES ('TUZEL_KISI', '', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run(
      trimOrNull(input.eposta),
      trimOrNull(input.adres),
      trimOrNull(input.sirketUnvani),
      trimOrNull(input.yetkiliAdSoyad),
      trimOrNull(input.yetkiliTelefon),
      trimOrNull(input.mudurAdSoyad),
      trimOrNull(input.mudurTelefon),
      trimOrNull(input.muhasebeAdSoyad),
      trimOrNull(input.muhasebeTelefon),
      trimOrNull(input.vergiNo),
      trimOrNull(input.vergiDairesi),
      trimOrNull(input.not),
      t,
      t
    );
  const id = Number(rr.lastInsertRowid);
  const row = muvekkilGet(id);
  if (!row) throw new Error("Müvekkil kaydı oluşturuldu ancak doğrulanamadı.");
  return row;
}

export function muvekkilGuncelle(id: number, input: MuvekkilInput): Muvekkil | null {
  const err = validateMuvekkilKayit(input);
  if (err) throw new Error(err);
  const d = getDb();
  const t = nowIso();
  const tur = input.muvekkilTuru === "TUZEL_KISI" ? "TUZEL_KISI" : "GERCEK_KISI";

  if (tur === "GERCEK_KISI") {
    d.prepare(
      `UPDATE muvekkil SET
        muvekkil_turu = 'GERCEK_KISI',
        ad_soyad = ?, telefon = ?, eposta = ?, adres = ?,
        sirket_unvani = NULL, yetkili_ad_soyad = NULL, yetkili_telefon = NULL,
        mudur_ad_soyad = NULL, mudur_telefon = NULL, muhasebe_ad_soyad = NULL, muhasebe_telefon = NULL,
        vergi_no = NULL, vergi_dairesi = NULL,
        notu = ?, guncelleme_tarihi = ?
      WHERE id = ?`
    ).run(trimOrNull(input.adSoyad), trimOrNull(input.telefon), trimOrNull(input.eposta), trimOrNull(input.adres), trimOrNull(input.not), t, id);
  } else {
    d.prepare(
      `UPDATE muvekkil SET
        muvekkil_turu = 'TUZEL_KISI',
        ad_soyad = '', telefon = NULL, eposta = ?, adres = ?,
        sirket_unvani = ?, yetkili_ad_soyad = ?, yetkili_telefon = ?,
        mudur_ad_soyad = ?, mudur_telefon = ?,
        muhasebe_ad_soyad = ?, muhasebe_telefon = ?,
        vergi_no = ?, vergi_dairesi = ?,
        notu = ?, guncelleme_tarihi = ?
      WHERE id = ?`
    ).run(
      trimOrNull(input.eposta),
      trimOrNull(input.adres),
      trimOrNull(input.sirketUnvani),
      trimOrNull(input.yetkiliAdSoyad),
      trimOrNull(input.yetkiliTelefon),
      trimOrNull(input.mudurAdSoyad),
      trimOrNull(input.mudurTelefon),
      trimOrNull(input.muhasebeAdSoyad),
      trimOrNull(input.muhasebeTelefon),
      trimOrNull(input.vergiNo),
      trimOrNull(input.vergiDairesi),
      trimOrNull(input.not),
      t,
      id
    );
  }
  return muvekkilGet(id);
}
