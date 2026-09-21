import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import {
  vekaletKaydet,
  vekaletTaksitEkle,
  vekaletTaksitGuncelle,
  vekaletTaksitSil,
} from "../services/vekalet.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runVekaletTaksitLimitSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-limit-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();
    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Limit Test', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Limit', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 100000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    for (let i = 1; i <= 10; i++) {
      const r = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: i, vadeTarihi: "2026-07-01" });
      assert(r.ok, `taksit ${i}: ${r.ok ? "" : r.error}`);
    }

    const sinir = vekaletTaksitEkle(vk.row.id, { tutar: 50000, taksitNo: 11, vadeTarihi: "2026-08-01" });
    assert(sinir.ok, `50.000 eklenmeli: ${sinir.ok ? "" : sinir.error}`);
    assert(vekaletTaksitSil(sinir.row.id).ok, "50.000 silinemedi");

    const asiri = vekaletTaksitEkle(vk.row.id, { tutar: 50000.01, taksitNo: 11, vadeTarihi: "2026-08-01" });
    assert(!asiri.ok, "50.000,01 reddedilmeli");
    assert(
      (asiri.ok ? "" : asiri.error).includes("taksitlendirilebilir kalan"),
      `hata mesajı beklenen değil: ${asiri.ok ? "" : asiri.error}`,
    );
    console.log("[PASS] tek taksit üst sınır (50.000 ok / 50.000,01 ret)");

    const dolu = vekaletTaksitEkle(vk.row.id, { tutar: 50000, taksitNo: 11, vadeTarihi: "2026-08-01" });
    assert(dolu.ok, dolu.ok ? "" : dolu.error);
    const kalanYok = vekaletTaksitEkle(vk.row.id, { tutar: 0.01, taksitNo: 12, vadeTarihi: "2026-09-01" });
    assert(!kalanYok.ok, "tam plan sonrası ekleme reddedilmeli");
    assert(vekaletTaksitSil(dolu.row.id).ok, "dolu taksit silinemedi");
    console.log("[PASS] taksitlendirilebilir tutar kalmadığında ekleme reddi");

    // Diğer taksitler 85.000, düzenlenen 10.000 → max 15.000
    const hedef = vekaletTaksitEkle(vk.row.id, { tutar: 10000, taksitNo: 11, vadeTarihi: "2026-08-01" });
    assert(hedef.ok, hedef.ok ? "" : hedef.error);
    for (let i = 12; i <= 18; i++) {
      const r = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: i, vadeTarihi: "2026-08-01" });
      assert(r.ok, `ek ${i}: ${r.ok ? "" : r.error}`);
    }
    // mevcut: 10×5k + 10k + 7×5k = 50+10+35 = 95k → diğerler 85k, max 15k
    // Wait: 10×5k=50k, then +10k=60k, then 7×5k=35k → total 95k. Other than hedef: 85k. max=15k. Good.

    const okGuncelle = vekaletTaksitGuncelle(hedef.row.id, { tutar: 15000 });
    assert(okGuncelle.ok, `15.000 güncelleme: ${okGuncelle.ok ? "" : okGuncelle.error}`);
    const retGuncelle = vekaletTaksitGuncelle(hedef.row.id, { tutar: 15000.01 });
    assert(!retGuncelle.ok, "15.000,01 güncelleme reddedilmeli");
    console.log("[PASS] taksit düzenleme üst sınır (15.000 ok / 15.000,01 ret)");

    // Hatalı eski kayıt silinmez — doğrudan INSERT ile aşımı simüle et, sonra ekleme reddedilir
    db.prepare(
      `INSERT INTO vekalet_ucreti_taksit
        (vekalet_ucreti_id, dosya_id, muvekkil_id, taksit_no, tutar, vade_tarihi, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, ?, 99, 60000000, '2026-12-01', ?, ?)`,
    ).run(vk.row.id, dosyaId, muvekkilId, t, t);
    const asimiSonrasi = vekaletTaksitEkle(vk.row.id, { tutar: 1, taksitNo: 100, vadeTarihi: "2026-12-02" });
    assert(!asimiSonrasi.ok, "aşım varken yeni taksit reddedilmeli");
    const hatali = db
      .prepare(`SELECT id, tutar FROM vekalet_ucreti_taksit WHERE taksit_no = 99 AND vekalet_ucreti_id = ?`)
      .get(vk.row.id) as { id: number; tutar: number } | undefined;
    assert(hatali && Number(hatali.tutar) === 60000000, "hatalı kayıt korunmalı");
    assert(vekaletTaksitSil(hatali.id).ok, "kullanıcı hatalı kaydı silebilmeli");
    console.log("[PASS] hatalı aşım kaydı korunur, yeni ekleme engellenir, silinebilir");

    console.log("[OK] vekalet taksit limit smoke tamam");
  } finally {
    try {
      closeDb();
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}
