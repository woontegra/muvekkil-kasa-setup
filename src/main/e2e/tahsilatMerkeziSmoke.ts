import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { bugunYmdLocal } from "@shared/lib/vekaletTaksitUyari";
import { getTahsilatMerkeziOzet, listTahsilatMerkezi } from "../services/tahsilatMerkezi.service";
import {
  vekaletKaydet,
  vekaletSmmKesildi,
  vekaletTaksitEkle,
  vekaletTaksitOdemeAl,
} from "../services/vekalet.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return bugunYmdLocal(dt);
}

export async function runTahsilatMerkeziSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-tahsilat-merkezi-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();
    const bugun = bugunYmdLocal();
    const dun = ymdAddDays(bugun, -1);
    const yarin = ymdAddDays(bugun, 1);
    const besGun = ymdAddDays(bugun, 5);

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, telefon, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Tahsilat Test', '5321112233', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, dosya_numarasi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Tahsilat Dosya', '2026/1', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 50000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    const gecmis = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: 1, vadeTarihi: dun });
    const gecmis2 = vekaletTaksitEkle(vk.row.id, { tutar: 4500, taksitNo: 2, vadeTarihi: dun });
    const bugunT = vekaletTaksitEkle(vk.row.id, { tutar: 4000, taksitNo: 3, vadeTarihi: bugun });
    const yaklasan = vekaletTaksitEkle(vk.row.id, { tutar: 3000, taksitNo: 4, vadeTarihi: besGun });
    const odenmis = vekaletTaksitEkle(vk.row.id, { tutar: 2000, taksitNo: 5, vadeTarihi: dun });
    const kismi = vekaletTaksitEkle(vk.row.id, { tutar: 6000, taksitNo: 6, vadeTarihi: yarin });
    assert(gecmis.ok && gecmis2.ok && bugunT.ok && yaklasan.ok && odenmis.ok && kismi.ok, "taksit ekleme");

    const odemeTam = vekaletTaksitOdemeAl(odenmis.row.id, {
      tutar: 2000,
      odemeTarihi: bugun,
      odemeYontemi: "NAKIT",
    });
    assert(odemeTam.ok, odemeTam.ok ? "" : odemeTam.error);

    const odemeKismi = vekaletTaksitOdemeAl(kismi.row.id, {
      tutar: 1000,
      odemeTarihi: bugun,
      odemeYontemi: "NAKIT",
    });
    assert(odemeKismi.ok, odemeKismi.ok ? "" : odemeKismi.error);

    const ozet = getTahsilatMerkeziOzet();
    assert(ozet.gecikmisAdet >= 2, `gecikmiş adet >= 2, got ${ozet.gecikmisAdet}`);
    assert(ozet.bugunAdet >= 1, `bugün adet >= 1, got ${ozet.bugunAdet}`);
    assert(ozet.kismiAdet >= 1, `kısmi adet >= 1, got ${ozet.kismiAdet}`);
    console.log(
      `[PASS] getTahsilatMerkeziOzet: gecikmiş=${ozet.gecikmisAdet}, bugün=${ozet.bugunAdet}, kısmi=${ozet.kismiAdet}`,
    );

    const gecikenler = listTahsilatMerkezi({ gorunum: "GECIKENLER" });
    assert(gecikenler.items.every((i) => i.gorunumler.includes("GECIKMIS")), "GECIKENLER filtresi");
    assert(gecikenler.total >= 2, "en az 2 geciken taksit");

    const bugunListe = listTahsilatMerkezi({ gorunum: "BUGUN" });
    assert(bugunListe.items.every((i) => i.gorunumler.includes("BUGUN")), "BUGUN filtresi");

    const kismiListe = listTahsilatMerkezi({ gorunum: "KISMI_ODENENLER" });
    assert(kismiListe.items.every((i) => i.gorunumler.includes("KISMI")), "KISMI filtresi");

    const arama = listTahsilatMerkezi({ q: "Tahsilat Test", gorunum: "TUMU" });
    assert(arama.total >= 3, "metin araması sonuç döndürmeli");
    assert(arama.items[0].muvekkilTelefonVar, "telefon bayrağı true olmalı");

    const tumu = listTahsilatMerkezi({ gorunum: "TUMU" });
    const smmRow = tumu.items.find((i) => i.taksit.smmBekleyenOdemeId != null);
    assert(smmRow?.taksit.smmBekleyenOdemeId != null, "SMM bekleyen ödeme olmalı");
    const smm = vekaletSmmKesildi(smmRow.taksit.smmBekleyenOdemeId);
    assert(smm.ok, smm.ok ? "" : smm.error);

    const gelecekHaric = listTahsilatMerkezi({ gorunum: "TUMU", vadeBas: yarin });
    assert(!gelecekHaric.items.some((i) => i.vadeTarihi === dun), "vadeBas filtresi");

    console.log("[PASS] listTahsilatMerkezi filtreleri ve SMM");
  } finally {
    closeDb();
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}
