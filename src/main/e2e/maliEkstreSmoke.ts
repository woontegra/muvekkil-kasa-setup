import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { getDosyaMaliOzet } from "../services/dosyaMaliOzet.service";
import { buildMuvekkilEkstreForDosya } from "../services/muvekkilEkstre.service";
import { kasaHareketOnayla } from "../services/kasa.service";
import { ofisKasaHareketOnayla } from "../services/ofisKasa.service";
import { vekaletKaydet, vekaletTaksitEkle, vekaletTaksitOdemeAl } from "../services/vekalet.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runMaliEkstreSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-mali-ekstre-e2e-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, telefon, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Ekstre Test', '555', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, mahkeme_adi, dosya_numarasi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Test Dosya', 'Ankara', '2026/1', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    db.prepare(
      `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, 'AVANS_GIRISI', 1000, date('now'), 'NAKIT', 'ONAYSIZ', 0, ?, ?)`,
    ).run(dosyaId, muvekkilId, t, t);
    const avansId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    const onay = kasaHareketOnayla(avansId);
    assert(onay.ok, onay.ok ? "" : onay.error);

    db.prepare(
      `INSERT INTO dosya_kasa_hareket (dosya_id, muvekkil_id, islem_tipi, tutar, tarih, odeme_yontemi, onay_durumu, duzeltme_mi, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, ?, 'MASRAF', 200, date('now'), 'NAKIT', 'ONAYLI', 0, ?, ?)`,
    ).run(dosyaId, muvekkilId, t, t);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 10000, paraBirimi: "TRY" });
    assert(vk.ok, vk.ok ? "" : vk.error);

    const taksit = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: 1, vadeTarihi: "2026-12-31" });
    assert(taksit.ok, taksit.ok ? "" : taksit.error);

    const odeme = vekaletTaksitOdemeAl(taksit.row.id, {
      tutar: 5000,
      odemeTarihi: "2026-06-15",
      odemeYontemi: "NAKIT",
    });
    assert(odeme.ok, odeme.ok ? "" : odeme.error);
    assert(odeme.row.odeme.ofisKasaHareketId != null, "ofis kasa id");
    const ofisOnay = ofisKasaHareketOnayla(odeme.row.odeme.ofisKasaHareketId!);
    assert(ofisOnay.ok, ofisOnay.ok ? "" : ofisOnay.error);

    db.prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, tutar, odeme_yontemi, onay_durumu, duzeltme_mi, muvekkil_id,
        para_birimi, olusturma_tarihi, guncelleme_tarihi, otomatik_onay_mi, onay_tarihi
      ) VALUES ('GELIR', date('now'), 'DIGER_GELIR', 300, 'NAKIT', 'ONAYLI', 0, ?, 'TRY', ?, ?, 0, ?)`,
    ).run(muvekkilId, t, t, t);

    const mali = getDosyaMaliOzet(dosyaId);
    assert(mali.ok, mali.ok ? "" : mali.error);
    assert(Number(mali.data.tumZamanlar.kararlastirilanVekalet) === 10000, "kararlastirilan vekalet");
    assert(Number(mali.data.tumZamanlar.tahsilEdilenVekalet) === 5000, "tahsil edilen vekalet");
    assert(Number(mali.data.tumZamanlar.alinanMasrafAvansi) === 1000, "avans");
    assert(Number(mali.data.tumZamanlar.toplamMasraf) === 200, "masraf");
    assert(Number(mali.data.tumZamanlar.kalanMasrafAvansi) === 800, "kalan avans");
    assert(Number(mali.data.tumZamanlar.netKazanc) === 5000, "net kazanc = tahsilat (buro gider yok)");
    assert(mali.data.buDonem != null, "buDonem dolu");
    assert(mali.data.donemEtiketi != null, "donem etiketi");

    const ekstre = buildMuvekkilEkstreForDosya(dosyaId);
    assert(ekstre.ok, ekstre.ok ? "" : ekstre.error);
    assert(ekstre.data.muvekkil.gorunenAd === "Ekstre Test", "muvekkil ad");
    assert(Number(ekstre.data.vekaletOzeti.tahsilEdilenToplam) === 5000, "ekstre tahsilat");
    assert(Number(ekstre.data.masrafAvansiOzeti.guncelBakiye) === 800, "ekstre avans bakiye");
    assert(ekstre.data.taksitler.length === 1, "1 taksit");
    assert(ekstre.data.masrafHareketleri.length === 2, "2 kasa hareketi");
    assert(ekstre.data.dosyaDisiOfisGelirleri.hareketler.length >= 2, "ofis gelir (manuel + vekalet tahsilat)");
    assert(ekstre.data.dipnot.includes("bilgilendirme"), "dipnot");

    const ekstreCutoff = buildMuvekkilEkstreForDosya(dosyaId, { itibariyleTarih: "2020-01-01" });
    assert(ekstreCutoff.ok, ekstreCutoff.ok ? "" : ekstreCutoff.error);
    assert(Number(ekstreCutoff.data.vekaletOzeti.tahsilEdilenToplam) === 0, "itibariyle cutoff tahsilat");

    console.log("[PASS] dosyaMaliOzet + muvekkilEkstre smoke");
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
