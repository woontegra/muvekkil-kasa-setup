import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import {
  getAccountingPeriod,
  getPreviousAccountingPeriod,
} from "@shared/lib/accountingPeriod";
import { toKurus } from "@shared/lib/moneyKurus";
import {
  getAccountingPeriodMode,
  setAccountingPeriodMode,
} from "../services/appSettings.service";
import { ofisKasaAnaSayfaOzet } from "../services/ofisKasa.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertApprox(actual: number, expected: number, label: string): void {
  assert(
    toKurus(actual) === toKurus(expected),
    `${label}: beklenen ${expected}, gelen ${actual}`,
  );
}

function insertOfisHareket(opts: {
  islemTipi: "GELIR" | "GIDER";
  tarih: string;
  tutar: number;
  kategori: string;
}): void {
  const t = nowIso();
  getDb()
    .prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, odeme_yontemi, belge_no, not_metni,
        onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
        olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
        onaylayan_kullanici_id, onaylayan_kullanici_adi
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      opts.islemTipi,
      opts.tarih,
      opts.kategori,
      null,
      null,
      opts.tutar,
      "NAKIT",
      null,
      null,
      "ONAYLI",
      0,
      null,
      0,
      t,
      t,
      t,
      null,
      null,
      null,
      null,
    );
}

function unitTestGetAccountingPeriod(): void {
  const yearly = getAccountingPeriod("YEARLY", "2026-06-15");
  assert(yearly.mode === "YEARLY", "YEARLY mode");
  assert(yearly.bas === "2026-01-01", `YEARLY bas: ${yearly.bas}`);
  assert(yearly.bit === "2026-12-31", `YEARLY bit: ${yearly.bit}`);
  assert(yearly.etiket === "2026 Yılı", `YEARLY etiket: ${yearly.etiket}`);

  const monthly = getAccountingPeriod("MONTHLY", "2026-02-10");
  assert(monthly.mode === "MONTHLY", "MONTHLY mode");
  assert(monthly.bas === "2026-02-01", `MONTHLY bas: ${monthly.bas}`);
  assert(monthly.bit === "2026-02-28", `MONTHLY bit: ${monthly.bit}`);
  assert(monthly.etiket === "Şubat 2026", `MONTHLY etiket: ${monthly.etiket}`);

  const febLeap = getAccountingPeriod("MONTHLY", "2024-02-01");
  assert(febLeap.bit === "2024-02-29", `artık yıl Şubat bit: ${febLeap.bit}`);

  console.log("[PASS] getAccountingPeriod YEARLY/MONTHLY sınırları (DB yok)");
}

export async function runAccountingPeriodSmoke(): Promise<void> {
  unitTestGetAccountingPeriod();

  const dbPath = join(tmpdir(), `mkd-accounting-period-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);

    // --- Mode persist ---
    const setYearly = setAccountingPeriodMode("YEARLY");
    assert(setYearly === "YEARLY", "set YEARLY dönüş");
    assert(getAccountingPeriodMode() === "YEARLY", "getAccountingPeriodMode YEARLY");

    // --- Test 1: YEARLY ---
    insertOfisHareket({
      islemTipi: "GELIR",
      tarih: "2026-06-01",
      tutar: 100000,
      kategori: "DANISMANLIK_GELIR",
    });
    insertOfisHareket({
      islemTipi: "GIDER",
      tarih: "2026-06-15",
      tutar: 40000,
      kategori: "OFIS_KIRASI",
    });

    const ozet2026 = ofisKasaAnaSayfaOzet({ referenceDate: "2026-06-01" });
    assert(ozet2026.mode === "YEARLY", "2026 özet mode YEARLY");
    assert(ozet2026.period.bas === "2026-01-01" && ozet2026.period.bit === "2026-12-31", "2026 dönem");
    assertApprox(ozet2026.donemGelir, 100000, "2026 donemGelir");
    assertApprox(ozet2026.donemGider, 40000, "2026 donemGider");
    assertApprox(ozet2026.donemNetSonucu, 60000, "2026 donemNetSonucu");

    const ozet2027 = ofisKasaAnaSayfaOzet({ referenceDate: "2027-01-01" });
    assert(ozet2027.period.bas === "2027-01-01", "2027 dönem bas");
    assertApprox(ozet2027.donemGelir, 0, "2027 donemGelir");
    assertApprox(ozet2027.donemGider, 0, "2027 donemGider");
    assertApprox(ozet2027.donemNetSonucu, 0, "2027 donemNetSonucu");
    assertApprox(ozet2027.devredenBakiye, 60000, "2027 devredenBakiye");
    assertApprox(ozet2027.kasaBakiyesi, 60000, "2027 kasaBakiyesi");

    console.log("[PASS] YEARLY dönem özeti + devreden");

    // --- Test 2: MONTHLY (temiz tablo) ---
    db.prepare(`DELETE FROM ofis_kasa_hareketleri`).run();

    const setMonthly = setAccountingPeriodMode("MONTHLY");
    assert(setMonthly === "MONTHLY", "set MONTHLY dönüş");
    assert(getAccountingPeriodMode() === "MONTHLY", "getAccountingPeriodMode MONTHLY");

    insertOfisHareket({
      islemTipi: "GELIR",
      tarih: "2026-01-10",
      tutar: 30000,
      kategori: "DANISMANLIK_GELIR",
    });
    insertOfisHareket({
      islemTipi: "GIDER",
      tarih: "2026-01-20",
      tutar: 10000,
      kategori: "OFIS_KIRASI",
    });

    const ozetSubatBos = ofisKasaAnaSayfaOzet({ referenceDate: "2026-02-01" });
    assert(ozetSubatBos.mode === "MONTHLY", "Şubat mode MONTHLY");
    assert(ozetSubatBos.period.bas === "2026-02-01", "Şubat dönem bas");
    assertApprox(ozetSubatBos.donemGelir, 0, "Şubat donemGelir (boş)");
    assertApprox(ozetSubatBos.donemGider, 0, "Şubat donemGider (boş)");
    assertApprox(ozetSubatBos.donemNetSonucu, 0, "Şubat donemNetSonucu (boş)");
    assertApprox(ozetSubatBos.devredenBakiye, 20000, "Şubat devreden (Ocak net)");
    assertApprox(ozetSubatBos.kasaBakiyesi, 20000, "Şubat kasa (devreden)");

    insertOfisHareket({
      islemTipi: "GIDER",
      tarih: "2026-02-05",
      tutar: 5000,
      kategori: "ELEKTRIK",
    });

    const ozetSubat = ofisKasaAnaSayfaOzet({ referenceDate: "2026-02-01" });
    assertApprox(ozetSubat.donemGelir, 0, "Şubat donemGelir");
    assertApprox(ozetSubat.donemGider, 5000, "Şubat donemGider");
    assertApprox(ozetSubat.donemNetSonucu, -5000, "Şubat donemNetSonucu");
    assertApprox(ozetSubat.devredenBakiye, 20000, "Şubat + gider sonrası devreden");
    assertApprox(ozetSubat.kasaBakiyesi, 15000, "Şubat kasaBakiyesi");

    console.log("[PASS] MONTHLY dönem özeti + devreden");

    // --- getPreviousAccountingPeriod: Şubat'tan Ocak ---
    const prev = getPreviousAccountingPeriod(ozetSubat.period);
    assert(prev.mode === "MONTHLY", "önceki dönem MONTHLY");
    assert(prev.bas === "2026-01-01", `önceki bas: ${prev.bas}`);
    assert(prev.bit === "2026-01-31", `önceki bit: ${prev.bit}`);
    assert(prev.etiket === "Ocak 2026", `önceki etiket: ${prev.etiket}`);

    const ozetOcakView = ofisKasaAnaSayfaOzet({ referenceDate: prev.bas });
    assertApprox(ozetOcakView.donemGelir, 30000, "Ocak görünüm gelir");
    assertApprox(ozetOcakView.donemGider, 10000, "Ocak görünüm gider");
    assertApprox(ozetOcakView.donemNetSonucu, 20000, "Ocak görünüm net");

    console.log("[PASS] getPreviousAccountingPeriod (Şubat → Ocak)");
    console.log("\n=== Accounting period smoke: TÜM ADIMLAR GEÇTİ ===");
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
