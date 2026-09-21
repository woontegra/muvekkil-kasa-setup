/**
 * P1 smoke: vekalet güvenli iptal — temp DB only (MKD_VEKALET_GUVENLI_SIL_TEST).
 */
import bcrypt from "bcryptjs";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { authLoginSuccess } from "../services/auth.service";
import { listAuditLog } from "../services/auditLog.service";
import {
  vekaletKaydet,
  vekaletOzetHesapla,
  vekaletTaksitEkle,
  vekaletTaksitList,
  vekaletTaksitOdemeAl,
} from "../services/vekalet.service";
import { guvenliSilVekaletTaksiti, guvenliSilVekaletTahsilat } from "../services/vekaletGuvenliIptal.service";
import { ofisKasaUstOzet } from "../services/ofisKasa.service";

const TEST_PASS = "vekalet-guvenli-iptal-test-123";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function withTempDb(fn: () => Promise<void> | void): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-guvenli-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
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
    .run("Test Büro Sahibi", "vekalet_guvenli@test.local", "vekalet_guvenli@test.local", hash, t);
  const id = Number(info.lastInsertRowid);
  authLoginSuccess({
    id,
    adSoyad: "Test Büro Sahibi",
    kullaniciAdi: "vekalet_guvenli@test.local",
    eposta: "vekalet_guvenli@test.local",
    telefon: null,
    rol: "BURO_SAHIBI",
  });
  return id;
}

export async function runVekaletGuvenliIptalSmoke(): Promise<void> {
  console.log("=== MKD Vekalet Güvenli İptal Smoke ===");
  await withTempDb(() => {
    seedUser();
    const d = getDb();
    const t = nowIso();

    d.prepare(`INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'VG Test', ?, ?)`).run(t, t);
    const mid = Number(d.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    d.prepare(`INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'VG Dosya', 'AKTIF', ?, ?)`).run(mid, t, t);
    const did = Number(d.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const vk = vekaletKaydet(did, mid, { anlasilanTutar: 30000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    const taksit1 = vekaletTaksitEkle(vk.row.id, { tutar: 10000, taksitNo: 1, vadeTarihi: "2026-10-01" });
    assert(taksit1.ok, taksit1.ok ? "" : taksit1.error);
    const taksit2 = vekaletTaksitEkle(vk.row.id, { tutar: 10000, taksitNo: 2, vadeTarihi: "2026-11-01" });
    assert(taksit2.ok, taksit2.ok ? "" : taksit2.error);

    const odeme = vekaletTaksitOdemeAl(taksit1.row!.id, {
      tutar: 10000,
      odemeTarihi: "2026-09-15",
      odemeYontemi: "NAKIT",
    });
    assert(odeme.ok, odeme.ok ? "" : odeme.error);
    if (!odeme.ok) return;

    const ozetOnce = vekaletOzetHesapla(did);
    assert(ozetOnce.odenenToplam === 10000, "özet ödenen önce 10000");

    const ofisOnce = ofisKasaUstOzet().donemGelir;
    assert(ofisOnce >= 10000, "ofis gelir önce");

    const iptal = guvenliSilVekaletTahsilat(odeme.row.odeme.id, {
      sifre: TEST_PASS,
      silmeNedeni: "Smoke tahsilat iptal",
    });
    assert(iptal.ok, iptal.ok ? "" : iptal.error);

    const odemeDb = d
      .prepare(`SELECT makbuz_durumu, iptal_tarihi, iptal_nedeni FROM vekalet_taksit_odeme WHERE id = ?`)
      .get(odeme.row.odeme.id) as { makbuz_durumu: string; iptal_tarihi: string | null; iptal_nedeni: string | null };
    assert(odemeDb.makbuz_durumu === "IPTAL", "makbuz_durumu IPTAL");
    assert(odemeDb.iptal_tarihi, "iptal_tarihi set");
    assert(odemeDb.iptal_nedeni === "Smoke tahsilat iptal", "iptal_nedeni");

    const ofisRow = d
      .prepare(`SELECT silinme_tarihi FROM ofis_kasa_hareketleri WHERE id = ?`)
      .get(odeme.row.odeme.ofisKasaHareketId) as { silinme_tarihi: string | null };
    assert(ofisRow.silinme_tarihi, "ofis hareket soft-delete");

    const ozetSonra = vekaletOzetHesapla(did);
    assert(ozetSonra.odenenToplam === 0, "özet ödenen sonra 0");

    const taksitIptal = guvenliSilVekaletTaksiti(taksit2.row!.id, {
      sifre: TEST_PASS,
      silmeNedeni: "Smoke taksit iptal",
    });
    assert(taksitIptal.ok, taksitIptal.ok ? "" : taksitIptal.error);

    const taksitDb = d
      .prepare(`SELECT odeme_durumu FROM vekalet_ucreti_taksit WHERE id = ?`)
      .get(taksit2.row!.id) as { odeme_durumu: string };
    assert(taksitDb.odeme_durumu === "IPTAL", "taksit odeme_durumu IPTAL");

    const liste = vekaletTaksitList(vk.row.id);
    assert(liste.length === 1, "IPTAL taksit listeden exclude");
    assert(liste[0]!.id === taksit1.row!.id, "aktif taksit kaldı");

    const audit = listAuditLog({ limit: 20 });
    assert(audit.rows.some((r) => r.eylem === "VEKALET_TAHSILAT_IPTAL"), "tahsilat audit");
    assert(audit.rows.some((r) => r.eylem === "VEKALET_TAKSIT_GUVENLI_IPTAL"), "taksit audit");

    console.log("OK — vekalet güvenli iptal smoke geçti.");
  });
}
