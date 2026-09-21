import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import {
  bugunYmdLocal,
  siniflaVekaletTaksitUyari,
  vekaletTaksitUyariOzetFromSiniflar,
} from "@shared/lib/vekaletTaksitUyari";
import { vekaletKaydet, vekaletTaksitEkle, vekaletTaksitOdemeAl, vekaletTaksitUyariOzet } from "../services/vekalet.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return bugunYmdLocal(dt);
}

export async function runVekaletTaksitUyariSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-vekalet-uyari-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const bugun = "2026-06-28";
    assert(siniflaVekaletTaksitUyari("2026-06-27", 5000, bugun) === "vadesiGecmis", "geçmiş vade");
    assert(siniflaVekaletTaksitUyari("2026-06-28", 5000, bugun) === "bugunOdenecek", "bugün vade");
    assert(siniflaVekaletTaksitUyari("2026-07-01", 5000, bugun) === "odenmemis", "gelecek vade");
    assert(siniflaVekaletTaksitUyari("2026-06-27", 0, bugun) === null, "ödenmiş");
    assert(siniflaVekaletTaksitUyari("2026-06-27", 2500, bugun) === "vadesiGecmis", "kısmi ödenmiş geçmiş");
    console.log("[PASS] siniflaVekaletTaksitUyari kuralları");

    const ozetBir = vekaletTaksitUyariOzetFromSiniflar([
      "vadesiGecmis",
      "bugunOdenecek",
      "odenmemis",
      null,
    ]);
    assert(ozetBir.vadesiGecmis === 1 && ozetBir.bugunOdenecek === 1 && ozetBir.odenmemis === 1, "özet sayımı");

    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();
    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Uyarı Test', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Test', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const refBugun = bugunYmdLocal();
    const dun = ymdAddDays(refBugun, -1);
    const yarin = ymdAddDays(refBugun, 1);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 50000 });
    assert(vk.ok, vk.ok ? "" : vk.error);

    const gecmis = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: 1, vadeTarihi: dun });
    const bugunT = vekaletTaksitEkle(vk.row.id, { tutar: 4000, taksitNo: 2, vadeTarihi: refBugun });
    const gelecek = vekaletTaksitEkle(vk.row.id, { tutar: 3000, taksitNo: 3, vadeTarihi: yarin });
    const odenmis = vekaletTaksitEkle(vk.row.id, { tutar: 2000, taksitNo: 4, vadeTarihi: dun });
    const kismi = vekaletTaksitEkle(vk.row.id, { tutar: 6000, taksitNo: 5, vadeTarihi: dun });
    assert(gecmis.ok && bugunT.ok && gelecek.ok && odenmis.ok && kismi.ok, "taksit ekleme");

    const odemeTam = vekaletTaksitOdemeAl(odenmis.row.id, {
      tutar: 2000,
      odemeTarihi: refBugun,
      odemeYontemi: "NAKIT",
    });
    assert(odemeTam.ok, odemeTam.ok ? "" : odemeTam.error);

    const odemeKismi = vekaletTaksitOdemeAl(kismi.row.id, {
      tutar: 1000,
      odemeTarihi: refBugun,
      odemeYontemi: "NAKIT",
    });
    assert(odemeKismi.ok, odemeKismi.ok ? "" : odemeKismi.error);

    const sonuc = vekaletTaksitUyariOzet();
    assert(sonuc.ozet.vadesiGecmis >= 2, `vadesi geçmiş en az 2 olmalı, ${sonuc.ozet.vadesiGecmis}`);
    assert(sonuc.ozet.bugunOdenecek >= 1, `bugün ödenecek en az 1 olmalı, ${sonuc.ozet.bugunOdenecek}`);
    assert(sonuc.ozet.odenmemis >= 1, `ödenmemiş en az 1 olmalı, ${sonuc.ozet.odenmemis}`);
    assert(
      sonuc.vadesiGecmisListe.length === sonuc.ozet.vadesiGecmis,
      `liste sayısı (${sonuc.vadesiGecmisListe.length}) kart ile eşleşmeli (${sonuc.ozet.vadesiGecmis})`,
    );
    assert(
      sonuc.vadesiGecmisListe.every((s) => s.kalan > 0 && s.durum === "GECIKTI"),
      "liste satırları geçikmiş açık taksit olmalı",
    );

    console.log(
      `[PASS] vekaletTaksitUyariOzet DB: geçmiş=${sonuc.ozet.vadesiGecmis}, bugün=${sonuc.ozet.bugunOdenecek}, ödenmemiş=${sonuc.ozet.odenmemis}, liste=${sonuc.vadesiGecmisListe.length}`,
    );
    console.log("\n=== Vekalet taksit uyarı smoke: TÜM TESTLER GEÇTİ ===\n");
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
