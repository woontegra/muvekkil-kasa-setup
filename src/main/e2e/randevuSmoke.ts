import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { randevuGuncelle, randevuList, randevuOlustur, randevuSil } from "../services/randevu.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runRandevuSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-randevu-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, telefon, kayit_tarihi, guncelleme_tarihi, aktif_mi)
       VALUES ('GERCEK_KISI', 'Randevu Test', '05001112233', ?, ?, 1)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, 'Test Dosya', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const invalid = randevuOlustur({
      baslik: "Geçersiz",
      baslangicAt: "2026-08-11T14:00:00.000Z",
      bitisAt: "2026-08-11T13:00:00.000Z",
      muvekkilId,
    });
    assert(!invalid.ok, "Bitiş < başlangıç reddedilmeli");

    const created = randevuOlustur({
      baslik: "İlk görüşme",
      baslangicAt: "2026-08-11T10:00:00.000Z",
      bitisAt: "2026-08-11T11:00:00.000Z",
      muvekkilId,
      dosyaId,
      konum: "Ofis",
      aciklama: "Test randevusu",
    });
    assert(created.ok, created.ok ? "" : created.error);
    const id = created.data.id;

    const listed = randevuList({
      baslangic: "2026-08-11T00:00:00.000Z",
      bitis: "2026-08-12T00:00:00.000Z",
    });
    assert(listed.some((r) => r.id === id), "Randevu listede olmalı");
    assert(listed[0]!.muvekkilAd === "Randevu Test", "Müvekkil adı join ile gelmeli");

    const filtered = randevuList({
      baslangic: "2026-08-11T00:00:00.000Z",
      bitis: "2026-08-12T00:00:00.000Z",
      muvekkilId,
    });
    assert(filtered.length === 1, "Müvekkil filtresi çalışmalı");

    const updated = randevuGuncelle(id, {
      baslik: "Güncellenmiş görüşme",
      baslangicAt: "2026-08-11T11:00:00.000Z",
      bitisAt: "2026-08-11T12:00:00.000Z",
      muvekkilId,
      dosyaId,
      konum: "Mahkeme",
    });
    assert(updated.ok, updated.ok ? "" : updated.error);
    assert(updated.data.baslik === "Güncellenmiş görüşme", "Güncelleme başlığı");

    const del = randevuSil(id);
    assert(del.ok, del.ok ? "" : del.error);

    const afterDelete = randevuList({
      baslangic: "2026-08-11T00:00:00.000Z",
      bitis: "2026-08-12T00:00:00.000Z",
    });
    assert(!afterDelete.some((r) => r.id === id), "Silinen randevu listede olmamalı");

    const row = db.prepare(`SELECT aktif_mi FROM randevu WHERE id = ?`).get(id) as { aktif_mi: number };
    assert(row.aktif_mi === 0, "Soft delete aktif_mi=0");

    console.log("[PASS] Randevu CRUD, filtre ve soft delete");
  } finally {
    closeDb();
    delete process.env.MKD_TEST_DB;
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}
