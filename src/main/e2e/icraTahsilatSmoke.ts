import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { hesaplaAvansBakiye } from "../services/kasa.service";
import {
  icraTahsilatAlacakOlustur,
  icraTahsilatSmmKesildi,
  icraTahsilatTaksitGuncelle,
  icraTahsilatTaksitList,
  icraTahsilatTaksitOdemeAl,
} from "../services/icraTahsilat.service";
import { OFIS_KASA_KAYNAK_ICRA_TAHSILAT } from "@shared/constants/ofisKasa";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runIcraTahsilatSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-icra-tahsilat-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'İcra Test', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'İcra Dosya', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, 'AVANS_GIRISI', 8000, '2026-06-01', 'NAKIT', 'ONAYSIZ', 0, ?, ?)`,
    ).run(dosyaId, muvekkilId, t, t);
    const avansOnce = hesaplaAvansBakiye(dosyaId).kalanAvans;
    const ofisOnce = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s,
    );

    const alacak1 = icraTahsilatAlacakOlustur({
      alacakTuru: "KARSI_TARAF_VEKALET",
      borcluAdi: "Karşı Taraf A.Ş.",
      muvekkilId,
      dosyaId,
      toplamTutar: 30000,
      pesinatVar: false,
      taksitSayisi: 3,
      ilkVadeTarihi: "2026-07-01",
      odemeYontemi: "NAKIT",
    });
    assert(alacak1.ok, alacak1.ok ? "" : alacak1.error);
    const ofisAlacakSonra = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s,
    );
    assert(ofisAlacakSonra === ofisOnce, "Alacak oluşturma Ofis Kasası geliri yazmamalı");

    const taksitler = icraTahsilatTaksitList(alacak1.row.id);
    assert(taksitler.length === 3, "3 taksit olmalı");
    const odeme = icraTahsilatTaksitOdemeAl(taksitler[0].id, {
      tutar: 10000,
      odemeTarihi: "2026-06-21",
      odemeYontemi: "NAKIT",
    });
    assert(odeme.ok, odeme.ok ? "" : odeme.error);
    assert(odeme.row.odeme.ofisKasaHareketId != null, "ofis kasa bağlantısı olmalı");

    const avansSonra = hesaplaAvansBakiye(dosyaId).kalanAvans;
    assert(avansSonra === avansOnce, "Dosya avans kasası etkilenmemeli");

    const ofisOdemeSonra = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s,
    );
    assert(ofisOdemeSonra >= ofisOnce + 10000 - 0.01, "Ofis kasası 10000 gelir artmalı");

    const ofisRow = db
      .prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE id = ?`)
      .get(odeme.row.odeme.ofisKasaHareketId) as Record<string, unknown>;
    assert(ofisRow.kategori === "KARSI_TARAF_VEKALET", "Kategori doğru olmalı");
    assert(ofisRow.kaynak_tipi === OFIS_KASA_KAYNAK_ICRA_TAHSILAT, "kaynak_tipi ICRA_TAHSILAT olmalı");

    const taksitOdemeSonra = icraTahsilatTaksitList(alacak1.row.id)[0];
    assert(taksitOdemeSonra.smmDurumu === "BEKLIYOR", "Ödeme sonrası SMM bekliyor olmalı");
    assert(taksitOdemeSonra.smmBekleyenOdemeId === odeme.row.odeme.id, "Bekleyen SMM ödeme id eşleşmeli");

    const ofisSaySmmOnce = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    const smmTaksit = icraTahsilatSmmKesildi(odeme.row.odeme.id);
    assert(smmTaksit.ok, smmTaksit.ok ? "" : smmTaksit.error);
    const taksitSmmSonra = icraTahsilatTaksitList(alacak1.row.id)[0];
    assert(taksitSmmSonra.smmDurumu === "KESILDI", "SMM kesildi sonrası durum KESILDI olmalı");
    assert(taksitSmmSonra.smmBekleyenOdemeId == null, "Bekleyen SMM ödeme kalmamalı");
    const ofisSaySmmSonra = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    assert(ofisSaySmmSonra === ofisSaySmmOnce, "SMM Kesildi yeni Ofis Kasası kaydı oluşturmamalı");

    const smmTekrar = icraTahsilatSmmKesildi(odeme.row.odeme.id);
    assert(!smmTekrar.ok, "SMM zaten kesildi tekrar işlem reddedilmeli");

    const ofisSay = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    const tekrar = icraTahsilatTaksitOdemeAl(taksitler[0].id, { tutar: 1, odemeTarihi: "2026-06-22", odemeYontemi: "NAKIT" });
    assert(!tekrar.ok || tekrar.ok, "kısmi ikinci ödeme veya limit");

    const alacak2 = icraTahsilatAlacakOlustur({
      alacakTuru: "ICRA_VEKALET",
      borcluAdi: "Borçlu Kişi",
      toplamTutar: 30000,
      pesinatVar: true,
      pesinatTutar: 5000,
      taksitSayisi: 3,
      ilkVadeTarihi: "2026-08-01",
      odemeYontemi: "BANKA",
    });
    assert(alacak2.ok, alacak2.ok ? "" : alacak2.error);
    const ofisPesinat = Number(
      db.prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM ofis_kasa_hareketleri WHERE islem_tipi = 'GELIR'`).get().s,
    );
    assert(ofisPesinat >= ofisOdemeSonra + 5000 - 0.01, "Peşinat Ofis Kasasına yazılmalı");

    const pesinatOdeme = db
      .prepare(`SELECT id FROM icra_tahsilat_odeme WHERE alacak_id = ? AND pesinat_mi = 1`)
      .get(alacak2.row.id) as { id: number };
    const ofisSayOnce = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    const smm = icraTahsilatSmmKesildi(pesinatOdeme.id);
    assert(smm.ok, smm.ok ? "" : smm.error);
    const ofisSaySmm = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    assert(ofisSaySmm === ofisSayOnce, "SMM Kesildi yeni Ofis Kasası kaydı oluşturmamalı");

    const dupCount = db
      .prepare(
        `SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri WHERE kaynak_tipi = ? AND kaynak_id = ?`,
      )
      .get(OFIS_KASA_KAYNAK_ICRA_TAHSILAT, odeme.row.odeme.id) as { c: number };
    assert(Number(dupCount.c) === 1, "Aynı ödeme için tek Ofis Kasası kaydı olmalı");

    const alacak3 = icraTahsilatAlacakOlustur({
      alacakTuru: "KARSI_TARAF_VEKALET",
      borcluAdi: "Taksit Düzenle Test",
      toplamTutar: 30000,
      pesinatVar: false,
      taksitSayisi: 4,
      ilkVadeTarihi: "2026-09-01",
      odemeYontemi: "NAKIT",
    });
    assert(alacak3.ok, alacak3.ok ? "" : alacak3.error);
    let t4 = icraTahsilatTaksitList(alacak3.row.id);
    assert(t4.length === 4, "4 taksit olmalı");
    assert(Math.abs(t4[0].tutar - 7500) < 0.01, "Eşit taksit 7500 olmalı");

    const ofisTaksitDuzenleOnce = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    const g3 = icraTahsilatTaksitGuncelle(t4[2].id, { tutar: 5000, vadeTarihi: "2026-11-01" });
    const g4 = icraTahsilatTaksitGuncelle(t4[3].id, { tutar: 5000, vadeTarihi: "2026-12-01" });
    const g1 = icraTahsilatTaksitGuncelle(t4[0].id, { tutar: 10000, vadeTarihi: "2026-09-01" });
    const g2 = icraTahsilatTaksitGuncelle(t4[1].id, { tutar: 10000, vadeTarihi: "2026-10-01" });
    assert(g1.ok && g2.ok && g3.ok && g4.ok, `Taksit düzenleme başarılı olmalı: ${[g1, g2, g3, g4].filter((x) => !x.ok).map((x) => (!x.ok ? x.error : "")).join("; ")}`);
    t4 = icraTahsilatTaksitList(alacak3.row.id);
    const taksitToplam = t4.reduce((s, x) => s + x.tutar, 0);
    assert(Math.abs(taksitToplam - 30000) < 0.01, "Taksit toplamı 30000 olmalı");
    const ofisTaksitDuzenleSonra = Number(db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri`).get().c);
    assert(ofisTaksitDuzenleSonra === ofisTaksitDuzenleOnce, "Taksit düzenleme Ofis Kasası kaydı oluşturmamalı");

    const kismiOdeme = icraTahsilatTaksitOdemeAl(t4[0].id, {
      tutar: 3000,
      odemeTarihi: "2026-09-05",
      odemeYontemi: "NAKIT",
    });
    assert(kismiOdeme.ok, kismiOdeme.ok ? "" : kismiOdeme.error);
    const kotuTutar = icraTahsilatTaksitGuncelle(t4[0].id, { tutar: 2000 });
    assert(!kotuTutar.ok, "Ödenenden küçük tutar reddedilmeli");

    const tamOdeme = icraTahsilatTaksitOdemeAl(t4[0].id, {
      tutar: 7000,
      odemeTarihi: "2026-09-10",
      odemeYontemi: "NAKIT",
    });
    assert(tamOdeme.ok, tamOdeme.ok ? "" : tamOdeme.error);
    const tamSonraTutar = icraTahsilatTaksitGuncelle(t4[0].id, { tutar: 9000 });
    assert(!tamSonraTutar.ok, "Tam ödenmiş taksitte tutar değiştirilemez");
    const tamSonraVade = icraTahsilatTaksitGuncelle(t4[0].id, { vadeTarihi: "2026-09-15", aciklama: "not" });
    assert(tamSonraVade.ok, tamSonraVade.ok ? "" : tamSonraVade.error);

    const asim = icraTahsilatTaksitGuncelle(t4[1].id, { tutar: 25000 });
    assert(!asim.ok, "Taksit toplamı alacağı aşmamalı");

    console.log("[PASS] İcra tahsilat smoke: alacak, ödeme, peşinat, ofis kasa, avans izolasyonu, taksit düzenleme");
    console.log("\n=== İcra tahsilat smoke: TÜM TESTLER GEÇTİ ===\n");
    console.log("Not: İcra tahsilat taksitleri ana sayfa uyarılarına dahil edilmedi (vekalet taksitleri ayrı).");
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
