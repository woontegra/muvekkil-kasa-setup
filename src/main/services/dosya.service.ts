import { getDb, nowIso } from "../db/connection";
import type { Dosya, DosyaDurum, DosyaInput, DosyaUpdateInput } from "@shared/types/dosya";
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
