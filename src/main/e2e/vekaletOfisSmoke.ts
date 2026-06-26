import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { hesaplaAvansBakiye } from "../services/kasa.service";
import { vekaletTaksitEkle, vekaletTaksitOdemeAl, vekaletKaydet, vekaletSmmKesildi } from "../services/vekalet.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runVekaletOfisSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-ofis-e2e-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'E2E Test Müvekkil', ?, ?)`
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'E2E İş Davası', 'AKTIF', ?, ?)`
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, 'AVANS_GIRISI', 5000, '2026-06-01', 'NAKIT', 'ONAYSIZ', 0, ?, ?)`
    ).run(dosyaId, muvekkilId, t, t);

    const avansOnce = hesaplaAvansBakiye(dosyaId);
    assert(avansOnce.kalanAvans === 5000, "Başlangıç avans bakiyesi 5000 olmalı");

    const ofisGelirOnce = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s
    );

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 75000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    const taksitRes = vekaletTaksitEkle(vk.row.id, { tutar: 15000, taksitNo: 1, vadeTarihi: "2026-06-25" });
    assert(taksitRes.ok, taksitRes.ok ? "" : taksitRes.error);

    const kasaSayOnce = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ?`).get(dosyaId).c
    );

    const odemeRes = vekaletTaksitOdemeAl(taksitRes.row.id, {
      tutar: 15000,
      odemeTarihi: "2026-06-21",
      odemeYontemi: "NAKIT",
      aciklama: null,
    });
    assert(odemeRes.ok, odemeRes.ok ? "" : odemeRes.error);
    assert(odemeRes.row.odeme.ofisKasaHareketId != null, "ofisKasaHareketId dolu olmalı");
    assert(odemeRes.row.odeme.kasaHareketId == null, "kasaHareketId boş olmalı");

    const kasaSaySonra = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ?`).get(dosyaId).c
    );
    assert(kasaSaySonra === kasaSayOnce, "Vekalet tahsilatı yeni dosya kasa hareketi oluşturmamalı");

    const vekaletAvans = Number(
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ? AND aciklama LIKE 'Vekalet taksit%'`
        )
        .get(dosyaId).c
    );
    assert(vekaletAvans === 0, "Dosya kasasında vekalet taksit avans kaydı olmamalı");

    const avansSonra = hesaplaAvansBakiye(dosyaId);
    assert(avansSonra.kalanAvans === 5000, "Avans bakiyesi değişmemeli");

    const ofisGelirSonra = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s
    );
    assert(ofisGelirSonra >= ofisGelirOnce + 15000 - 0.01, "Ofis Kasası toplam geliri artmalı");

    const ofisRow = db
      .prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE id = ?`)
      .get(odemeRes.row.odeme.ofisKasaHareketId) as Record<string, unknown>;
    assert(ofisRow.islem_tipi === "GELIR", "Ofis kasa tipi GELIR olmalı");
    assert(ofisRow.kategori === "VEKALET_TAHSILATI", "Kategori VEKALET_TAHSILATI olmalı");
    assert(Number(ofisRow.tutar) === 15000, "Ofis kasa tutarı 15000 olmalı");
    assert(String(ofisRow.aciklama).includes("Taksit No: 1"), "Açıklama taksit no içermeli");
    assert(ofisRow.kaynak_tipi === "VEKALET_TAHSILATI", "kaynak_tipi doğru olmalı");
    assert(Number(ofisRow.kaynak_id) === odemeRes.row.odeme.id, "kaynak_id ödeme id olmalı");

    const ofisSayOnce = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    const smmRes = vekaletSmmKesildi(odemeRes.row.odeme.id);
    assert(smmRes.ok, smmRes.ok ? "" : smmRes.error);
    const ofisSaySmm = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    assert(ofisSaySmm === ofisSayOnce, "SMM Kesildi yeni Ofis Kasası hareketi eklememeli");

    console.log("OK — gerçek servis E2E: vekalet tahsilatı Ofis Kasası'na, dosya avansına değil");
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
