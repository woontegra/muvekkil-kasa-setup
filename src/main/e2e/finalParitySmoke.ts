/**
 * Final parity smoke — mali kontrol, module guards, dosyalar, kârlılık, ödeme edit.
 * Temp MKD_TEST_DB only.
 */
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { getMaliKontrolUyarilari, getMaliKontrolUyarilariGuarded } from "../services/maliKontrol.service";
import { getMuvekkilKarlilik, listMuvekkilOfisGelirleri } from "../services/muvekkilKarlilik.service";
import { dosyaListAll } from "../services/dosya.service";
import {
  vekaletKaydet,
  vekaletTaksitEkle,
  vekaletTaksitOdemeAl,
  vekaletTaksitOdemeGuncelle,
} from "../services/vekalet.service";
import { decideModuleIpcAccess, MODULE_FORBIDDEN_ERROR } from "../ipc/moduleAuthorization.policy";
import { canShowOfisGuvenliSil } from "@shared/lib/guvenliSil";
import { OFIS_KASA_KAYNAK_VEKALET_TAHSILATI } from "@shared/constants/ofisKasa";
import { IPC } from "@shared/ipc";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function withTempDb(fn: () => Promise<void> | void): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-final-parity-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
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

export async function runFinalParitySmoke(): Promise<void> {
  await withTempDb(() => {
    const d = getDb();
    const t = nowIso();
    d.prepare(
      `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, sifre_hash, aktif_mi, kayit_tarihi, rol)
       VALUES ('Büro', 'buro', 'x', 1, ?, 'BURO_SAHIBI')`,
    ).run(t);
    d.prepare(
      `INSERT INTO muvekkil (ad_soyad, muvekkil_turu, aktif_mi, kayit_tarihi, guncelleme_tarihi)
       VALUES ('Test Müvekkil', 'GERCEK_KISI', 1, ?, ?)`,
    ).run(t, t);
    const mid = Number((d.prepare(`SELECT id FROM muvekkil LIMIT 1`).get() as { id: number }).id);
    d.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi)
       VALUES (?, 'Test Dosya', 'AKTIF', ?, ?)`,
    ).run(mid, t, t);
    const did = Number((d.prepare(`SELECT id FROM dosya LIMIT 1`).get() as { id: number }).id);

    assert(decideModuleIpcAccess(IPC.muvekkil.guncelle, { rol: "KATIP_PERSONEL" }) === "DENY", "katip cannot guncelle");
    assert(decideModuleIpcAccess(IPC.muvekkil.guncelle, { rol: "BURO_SAHIBI" }) === "ALLOW", "sahip can guncelle");
    assert(decideModuleIpcAccess(IPC.maliKontrol.uyarilar, { rol: "KATIP_PERSONEL" }) === "DENY", "katip no mali");
    assert(decideModuleIpcAccess(IPC.maliKontrol.uyarilar, { rol: "AVUKAT_YONETICI" }) === "ALLOW", "avukat mali");
    assert(MODULE_FORBIDDEN_ERROR === "FORBIDDEN_ROLE", "forbidden const");

    const maliDenied = getMaliKontrolUyarilariGuarded("KATIP_PERSONEL");
    assert(!maliDenied.ok && maliDenied.error === "YETKISIZ", "mali guard");
    const maliOk = getMaliKontrolUyarilariGuarded("BURO_SAHIBI");
    assert(maliOk.ok, "mali ok");
    const mali = getMaliKontrolUyarilari();
    assert(typeof mali.toplamUyari === "number", "mali shape");

    const list = dosyaListAll({ q: "Test", page: 1, pageSize: 20 });
    assert(list.total >= 1 && list.items[0].muvekkilAd.includes("Test"), "dosyaListAll");

    const karl = getMuvekkilKarlilik(mid);
    assert(karl.ok && karl.data.tumZamanlar.toplamDosya === 1, "karlilik");
    const ofis = listMuvekkilOfisGelirleri(mid, { page: 1, limit: 10 });
    assert(ofis.total === 0, "ofis empty ok");

    const vek = vekaletKaydet(did, mid, { anlasilanTutar: 1000, paraBirimi: "TRY" });
    assert(vek.ok, "vekalet");
    const tak = vekaletTaksitEkle(vek.row.id, {
      taksitNo: 1,
      tutar: 1000,
      vadeTarihi: "2099-01-01",
    });
    assert(tak.ok, "taksit");
    const od = vekaletTaksitOdemeAl(tak.row.id, {
      tutar: 100,
      odemeTarihi: "2026-01-15",
      odemeYontemi: "NAKIT",
      aciklama: "ilk",
    });
    assert(od.ok, "odeme");
    const upd = vekaletTaksitOdemeGuncelle(od.row.odeme.id, {
      tutar: 150,
      odemeTarihi: "2026-01-16",
      odemeYontemi: "BANKA",
      aciklama: "düzenlendi",
    });
    assert(upd.ok && upd.row.odeme.tutar === 150, "odeme edit");

    // Onaylı ofis → edit locked
    const ofisId = Number(od.row.odeme.ofisKasaHareketId);
    d.prepare(`UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ? WHERE id = ?`).run(t, ofisId);
    const locked = vekaletTaksitOdemeGuncelle(od.row.odeme.id, { tutar: 160, odemeTarihi: "2026-01-17", odemeYontemi: "NAKIT" });
    assert(!locked.ok, "onayli ofis edit locked");

    // canShowOfisGuvenliSil → TAHSILAT_IPTAL for linked gelir
    const mode = canShowOfisGuvenliSil({
      id: ofisId,
      islemTipi: "GELIR",
      onayDurumu: "ONAYLI",
      duzeltmeMi: false,
      hasCorrection: false,
      kaynakTipi: OFIS_KASA_KAYNAK_VEKALET_TAHSILATI,
    } as Parameters<typeof canShowOfisGuvenliSil>[0]);
    assert(mode === "TAHSILAT_IPTAL", "ofis linked mode");

    console.log("[PASS] final parity smoke (mali/guards/dosyalar/karlilik/odeme-edit/ofis-link)");
  });
}
