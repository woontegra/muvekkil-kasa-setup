/**
 * P0 smoke: güvenli sil — temp DB only (MKD_GUVENLI_SIL_TEST).
 */
import bcrypt from "bcryptjs";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { authLoginSuccess } from "../services/auth.service";
import {
  hesaplaAvansBakiye,
  kasaHareketList,
  kasaHareketOnayla,
  kasaHareketEkle,
} from "../services/kasa.service";
import { guvenliKasaHareketSil } from "../services/kasaGuvenliSil.service";
import { guvenliOfisHareketSil } from "../services/ofisGuvenliSil.service";
import {
  ofisKasaHareketEkle,
  ofisKasaHareketList,
  ofisKasaHareketOnayla,
  ofisKasaUstOzet,
} from "../services/ofisKasa.service";
import { listAuditLog } from "../services/auditLog.service";

const TEST_PASS = "guvenli-sil-test-123";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function withTempDb(fn: () => Promise<void> | void): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-guvenli-sil-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
  try {
    closeDb();
  } catch {
    /* ignore */
  }
  process.env.MKD_TEST_DB = dbPath;
  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    await fn();
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
    delete process.env.MKD_TEST_DB;
  }
}

function seedUser(): number {
  const d = getDb();
  const t = nowIso();
  const hash = bcrypt.hashSync(TEST_PASS, 12);
  const info = d
    .prepare(
      `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, sifre_hash, aktif_mi, kayit_tarihi, rol)
       VALUES (?, ?, ?, ?, 1, ?, 'BURO_SAHIBI')`,
    )
    .run("Test Büro Sahibi", "guvenli_sil@test.local", "guvenli_sil@test.local", hash, t);
  const id = Number(info.lastInsertRowid);
  authLoginSuccess({
    id,
    adSoyad: "Test Büro Sahibi",
    kullaniciAdi: "guvenli_sil@test.local",
    eposta: "guvenli_sil@test.local",
    telefon: null,
    rol: "BURO_SAHIBI",
  });
  return id;
}

export async function runGuvenliSilSmoke(): Promise<void> {
  console.log("=== MKD Güvenli Sil Smoke ===");
  await withTempDb(() => {
    seedUser();
    const d = getDb();
    const t = nowIso();

    d.prepare(`INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'GS Test', ?, ?)`).run(t, t);
    const mid = Number(d.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    d.prepare(`INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'GS Dosya', 'AKTIF', ?, ?)`).run(mid, t, t);
    const did = Number(d.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const masraf = kasaHareketEkle({
      dosyaId: did,
      muvekkilId: mid,
      islemTipi: "MASRAF",
      tutar: 250,
      tarih: "2026-09-01",
      masrafTuru: "Harç",
      odemeYontemi: "NAKIT",
      aciklama: "Smoke masraf",
    });
    assert(masraf.ok, "masraf ekle");
    if (!masraf.ok) return;
    const onay = kasaHareketOnayla(masraf.row.id);
    assert(onay.ok, "masraf onayla");

    const ozetOnce = hesaplaAvansBakiye(did);
    assert(ozetOnce.toplamMasraf === 250, "özet masraf önce");
    assert(kasaHareketList(did).some((h) => h.id === masraf.row.id), "liste önce");

    const sil = guvenliKasaHareketSil(masraf.row.id, { sifre: TEST_PASS, silmeNedeni: "Smoke test silme" });
    assert(sil.ok, sil.ok ? "" : sil.error);

    const dbRow = d
      .prepare(`SELECT silinme_tarihi, silen_kullanici_id, silme_nedeni FROM dosya_kasa_hareket WHERE id = ?`)
      .get(masraf.row.id) as { silinme_tarihi: string | null; silen_kullanici_id: number | null; silme_nedeni: string | null };
    assert(dbRow.silinme_tarihi, "silinme_tarihi set");
    assert(dbRow.silen_kullanici_id != null, "silen_kullanici_id set");
    assert(dbRow.silme_nedeni === "Smoke test silme", "silme_nedeni set");

    assert(!kasaHareketList(did).some((h) => h.id === masraf.row.id), "liste sonra exclude");
    const ozetSonra = hesaplaAvansBakiye(did);
    assert(ozetSonra.toplamMasraf === 0, "özet masraf sonra sıfır");

    const audit = listAuditLog({ limit: 10 });
    assert(audit.rows.some((r) => r.eylem === "KASA_MASRAF_SOFT_DELETED"), "audit kaydı");

    const ofisEkle = ofisKasaHareketEkle(
      {
        islemTipi: "GIDER",
        tarih: "2026-09-02",
        kategori: "OFIS_KIRASI",
        tutar: 500,
        odemeYontemi: "NAKIT",
        aciklama: "Smoke gider",
      },
      1,
      "Test",
    );
    assert(ofisEkle.ok, "ofis gider ekle");
    if (!ofisEkle.ok) return;
    const ofisOnay = ofisKasaHareketOnayla(ofisEkle.row.id, 1, "Test");
    assert(ofisOnay.ok, "ofis onayla");

    const ustOnce = ofisKasaUstOzet().donemGider;
    assert(ustOnce >= 500, "ofis özet önce");

    const ofisSil = guvenliOfisHareketSil(ofisEkle.row.id, { sifre: TEST_PASS, silmeNedeni: "Ofis smoke sil" });
    assert(ofisSil.ok, ofisSil.ok ? "" : ofisSil.error);

    const ofisDb = d
      .prepare(`SELECT silinme_tarihi FROM ofis_kasa_hareketleri WHERE id = ?`)
      .get(ofisEkle.row.id) as { silinme_tarihi: string | null };
    assert(ofisDb.silinme_tarihi, "ofis silinme_tarihi");

    const filtre = { tarihBas: "2020-01-01", tarihBit: "2030-12-31" };
    assert(!ofisKasaHareketList(filtre).some((h) => h.id === ofisEkle.row.id), "ofis liste exclude");

    console.log("OK — dosya kasa + ofis kasa güvenli sil smoke geçti.");
  });
}
