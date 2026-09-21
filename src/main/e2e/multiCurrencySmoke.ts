/**
 * Multi-currency (SaaS parity) smoke — temp DB only.
 * NEVER touches production AppData SQLite.
 */
import { unlinkSync, readFileSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import {
  formatMoney,
  resolveDovizDonusum,
  resolvePaymentAmounts,
  resolveParaBirimi,
  roundRate,
} from "@shared/lib/paraBirimi";
import { toKurus } from "@shared/lib/moneyKurus";
import {
  ofisKasaAnaSayfaOzet,
  ofisKasaDovizDonusum,
  ofisKasaHareketEkle,
  ofisKasaHareketOnayla,
  ofisKasaUstOzet,
} from "../services/ofisKasa.service";
import {
  vekaletGetOrCreate,
  vekaletKaydet,
  vekaletTaksitEkle,
  vekaletTaksitOdemeAl,
  vekaletGuncelle,
} from "../services/vekalet.service";
import {
  icraTahsilatAlacakOlustur,
  icraTahsilatTaksitOdemeAl,
  icraTahsilatUstOzet,
} from "../services/icraTahsilat.service";
import {
  clearTcmbCacheForTests,
  parseTcmbXml,
  seedTcmbCacheForTests,
  getTcmbPairRate,
  buildTcmbHistoricalUrl,
  getTcmbRates,
  yaklasikTryTutar,
} from "../services/tcmbKur.service";
import {
  formatTcmbRateDisplay,
  formatDateTrShort,
  istanbulTodayYmd,
} from "@shared/lib/tcmbFormat";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertApprox(actual: number, expected: number, label: string): void {
  assert(toKurus(actual) === toKurus(expected), `${label}: beklenen ${expected}, gelen ${actual}`);
}

async function withTempDb(fn: () => Promise<void> | void): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-fx-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
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

function seedMuvekkilDosya(): { muvekkilId: number; dosyaId: number } {
  const d = getDb();
  const t = nowIso();
  d.prepare(
    `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Ali Veli', ?, ?)`,
  ).run(t, t);
  const muvekkilId = Number((d.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id);
  d.prepare(
    `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Dava', 'AKTIF', ?, ?)`,
  ).run(muvekkilId, t, t);
  const dosyaId = Number((d.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id);
  return { muvekkilId, dosyaId };
}

function unitParaBirimiMath(): void {
  console.log("[test] paraBirimi math");
  assert(resolveParaBirimi(null) === "TRY", "null → TRY");
  assert(resolveParaBirimi("") === "TRY", "empty → TRY");
  let threw = false;
  try {
    resolveParaBirimi("GBP");
  } catch {
    threw = true;
  }
  assert(threw, "GBP rejected");

  const same = resolvePaymentAmounts({
    alacakParaBirimi: "USD",
    mahsupTutari: 100,
    kalanBorc: 100,
    odemeParaBirimi: "USD",
  });
  assert(!same.isCrossCurrency, "same PB not cross");
  assert(same.kur == null, "same PB kur null");
  assertApprox(same.kasaTutari, 100, "same kasa");

  const cross = resolvePaymentAmounts({
    alacakParaBirimi: "USD",
    mahsupTutari: 100,
    kalanBorc: 500,
    odemeParaBirimi: "TRY",
    kasaTutari: 3400,
  });
  assert(cross.isCrossCurrency, "cross");
  assertApprox(cross.kur!, roundRate(3400 / 100), "kur = kasa/mahsup");
  assert(cross.kurOzeti?.startsWith("1 USD =") === true, "kur ozeti");

  const dov = resolveDovizDonusum({
    kaynakParaBirimi: "TRY",
    hedefParaBirimi: "USD",
    kaynakTutar: 3400,
    hedefTutar: 100,
  });
  assertApprox(dov.kur, roundRate(100 / 3400), "donusum kur");
  assert(formatMoney(1500, "TRY").includes("₺"), "TRY format");
  assert(formatMoney(10, "USD").startsWith("$"), "USD format");
  console.log("[PASS] paraBirimi math");
}

function unitTcmbParse(): void {
  console.log("[test] TCMB parse + lookback URL");
  const xml = `<?xml version="1.0"?>
<Tarih_Date Tarih="11.09.2026" Date="09/11/2026">
  <Currency CurrencyCode="USD"><Unit>1</Unit><ForexBuying>34.8000</ForexBuying><ForexSelling>34.9000</ForexSelling></Currency>
  <Currency CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>37.5000</ForexBuying><ForexSelling>37.6000</ForexSelling></Currency>
</Tarih_Date>`;
  const p = parseTcmbXml(xml);
  assert(p.tarih === "2026-09-11", `tarih ${p.tarih}`);
  assertApprox(p.usdBuying, 34.8, "usd");
  assert(buildTcmbHistoricalUrl("2026-09-11").includes("/kurlar/202609/11092026.xml"), "hist url");
  console.log("[PASS] TCMB parse");
}

async function testMigration016Backfill(): Promise<void> {
  console.log("[test] migration 016 backfill TRY");
  await withTempDb(() => {
    const d = getDb();
    const cols = d.prepare(`PRAGMA table_info(ofis_kasa_hareketleri)`).all() as { name: string }[];
    assert(cols.some((c) => c.name === "para_birimi"), "ofis para_birimi");
    assert(cols.some((c) => c.name === "doviz_donusum_id"), "doviz_donusum_id");
    const vCols = d.prepare(`PRAGMA table_info(vekalet_taksit_odeme)`).all() as { name: string }[];
    assert(vCols.some((c) => c.name === "kasa_tutari"), "kasa_tutari");
    const kasaCols = d.prepare(`PRAGMA table_info(dosya_kasa_hareket)`).all() as { name: string }[];
    assert(!kasaCols.some((c) => c.name === "para_birimi"), "dosya kasa TRY-only (no para_birimi)");

    const t = nowIso();
    d.prepare(
      `INSERT INTO ofis_kasa_hareketleri (
        islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, odeme_yontemi, belge_no, not_metni,
        onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
        olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
        onaylayan_kullanici_id, onaylayan_kullanici_adi
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      "GELIR",
      "2026-01-15",
      "DANISMANLIK_GELIR",
      null,
      "eski",
      1000,
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
    const row = d.prepare(`SELECT para_birimi, tutar FROM ofis_kasa_hareketleri LIMIT 1`).get() as {
      para_birimi: string;
      tutar: number;
    };
    assert(row.para_birimi === "TRY", "default TRY");
    assertApprox(row.tutar, 1000, "tutar unchanged");
    const ust = ofisKasaUstOzet({ referenceDate: "2026-01-20" });
    assertApprox(ust.bakiyeler.TRY, 1000, "TRY bakiye");
    assertApprox(ust.bakiyeler.USD, 0, "USD 0");
    assertApprox(ust.kasaBakiyesi, 1000, "legacy = TRY");
  });
  console.log("[PASS] migration 016 backfill");
}

async function testOfisFxAndDonusum(): Promise<void> {
  console.log("[test] ofis FX + doviz donusum");
  await withTempDb(async () => {
    const g1 = ofisKasaHareketEkle(
      {
        islemTipi: "GELIR",
        tarih: "2026-03-01",
        kategori: "DANISMANLIK_GELIR",
        tutar: 5000,
        odemeYontemi: "NAKIT",
        paraBirimi: "TRY",
      },
      1,
      "FX",
    );
    assert(g1.ok, "try gelir");
    if (g1.ok) ofisKasaHareketOnayla(g1.row.id, 1, "FX");

    const gUsd = ofisKasaHareketEkle(
      {
        islemTipi: "GELIR",
        tarih: "2026-03-02",
        kategori: "DANISMANLIK_GELIR",
        tutar: 200,
        odemeYontemi: "BANKA",
        paraBirimi: "USD",
      },
      1,
      "FX",
    );
    assert(gUsd.ok, "usd gelir");
    if (gUsd.ok) ofisKasaHareketOnayla(gUsd.row.id, 1, "FX");

    const giderEur = ofisKasaHareketEkle(
      {
        islemTipi: "GIDER",
        tarih: "2026-03-03",
        kategori: "OFIS_KIRASI",
        tutar: 50,
        odemeYontemi: "BANKA",
        paraBirimi: "EUR",
      },
      1,
      "FX",
    );
    assert(giderEur.ok, "eur gider");
    if (giderEur.ok) ofisKasaHareketOnayla(giderEur.row.id, 1, "FX");

    let ust = ofisKasaUstOzet({ referenceDate: "2026-03-15" });
    assertApprox(ust.bakiyeler.TRY, 5000, "TRY");
    assertApprox(ust.bakiyeler.USD, 200, "USD");
    assertApprox(ust.bakiyeler.EUR, -50, "EUR");
    assertApprox(ust.kasaBakiyesi, 5000, "legacy TRY only");

    clearTcmbCacheForTests();
    const don = await ofisKasaDovizDonusum(
      {
        tarih: "2026-03-10",
        kaynakParaBirimi: "TRY",
        hedefParaBirimi: "USD",
        kaynakTutar: 1000,
        hedefTutar: 30,
        kurKaynagi: "MANUEL",
        odemeYontemi: "BANKA",
      },
      1,
      "FX",
    );
    assert(don.ok, `donusum: ${!don.ok ? don.error : ""}`);
    if (don.ok) {
      assert(don.cikis.dovizDonusumId === don.giris.dovizDonusumId, "same id");
      ofisKasaHareketOnayla(don.cikis.id, 1, "FX");
      ofisKasaHareketOnayla(don.giris.id, 1, "FX");
    }

    ust = ofisKasaUstOzet({ referenceDate: "2026-03-15" });
    assertApprox(ust.bakiyeler.TRY, 4000, "TRY after donusum");
    assertApprox(ust.bakiyeler.USD, 230, "USD after donusum");
    assertApprox(ust.byCurrency.TRY.donemGelir, 5000, "donem gelir excludes doviz");

    const home = ofisKasaAnaSayfaOzet({ referenceDate: "2026-03-15" });
    assertApprox(home.bakiyeler.TRY, 4000, "home TRY");
    assertApprox(home.bakiyeler.USD, 230, "home USD");
  });
  console.log("[PASS] ofis FX + doviz donusum");
}

async function testVekaletCrossAndLock(): Promise<void> {
  console.log("[test] vekalet cross + PB lock");
  await withTempDb(async () => {
    const { muvekkilId, dosyaId } = seedMuvekkilDosya();
    const d = getDb();

    vekaletGetOrCreate(dosyaId, muvekkilId);
    const kaydet = vekaletKaydet(dosyaId, muvekkilId, {
      anlasilanTutar: 1000,
      paraBirimi: "USD",
      aciklama: null,
    });
    assert(kaydet.ok, `vekalet usd ${!kaydet.ok ? kaydet.error : ""}`);
    if (!kaydet.ok) return;
    const vekaletId = kaydet.row.id;
    const taksit = vekaletTaksitEkle(vekaletId, {
      tutar: 1000,
      vadeTarihi: "2026-04-01",
    });
    assert(taksit.ok, `taksit ${!taksit.ok ? taksit.error : ""}`);
    if (!taksit.ok) return;
    assert(taksit.row.paraBirimi === "USD", "taksit USD");

    const same = vekaletTaksitOdemeAl(taksit.row.id, {
      tutar: 200,
      odemeTarihi: "2026-04-02",
      odemeYontemi: "NAKIT",
      odemeParaBirimi: "USD",
    });
    assert(same.ok, `same pay ${!same.ok ? same.error : ""}`);
    if (same.ok) {
      assertApprox(same.row.odeme.kasaTutari, 200, "same kasa");
      assert(same.row.odeme.kur == null, "kur null");
      assert(same.row.odeme.odemeParaBirimi === "USD", "odeme PB");
    }

    const cross = vekaletTaksitOdemeAl(taksit.row.id, {
      tutar: 100,
      odemeTarihi: "2026-04-03",
      odemeYontemi: "BANKA",
      odemeParaBirimi: "TRY",
      kasaTutari: 3400,
      kurKaynagi: "MANUEL",
    });
    assert(cross.ok, `cross pay ${!cross.ok ? cross.error : ""}`);
    if (cross.ok) {
      assertApprox(cross.row.odeme.kur!, roundRate(3400 / 100), "cross kur");
      const ofis = d
        .prepare(`SELECT tutar, para_birimi FROM ofis_kasa_hareketleri WHERE id = ?`)
        .get(cross.row.odeme.ofisKasaHareketId) as { tutar: number; para_birimi: string };
      assertApprox(ofis.tutar, 3400, "ofis kasa TRY");
      assert(ofis.para_birimi === "TRY", "ofis PB TRY");
    }

    let locked = false;
    try {
      vekaletGuncelle(vekaletId, { anlasilanTutar: 1000, paraBirimi: "EUR" });
    } catch (e) {
      locked = e instanceof Error && e.message.includes("para birimi");
    }
    assert(locked, "PB change blocked after tahsilat");
  });
  console.log("[PASS] vekalet cross + lock");
}

async function testIcraCross(): Promise<void> {
  console.log("[test] icra FX");
  await withTempDb(async () => {
    const alacak = icraTahsilatAlacakOlustur({
      alacakTuru: "KARSI_TARAF_VEKALET",
      borcluAdi: "Borçlu",
      toplamTutar: 500,
      pesinatVar: false,
      taksitSayisi: 1,
      ilkVadeTarihi: "2026-05-01",
      odemeYontemi: "NAKIT",
      paraBirimi: "EUR",
    });
    assert(alacak.ok, `alacak ${!alacak.ok ? alacak.error : ""}`);
    if (!alacak.ok) return;
    assert(alacak.row.paraBirimi === "EUR", "alacak EUR");

    const d = getDb();
    const taksit = d
      .prepare(`SELECT id FROM icra_tahsilat_taksit WHERE alacak_id = ?`)
      .get(alacak.row.id) as { id: number };
    const odeme = icraTahsilatTaksitOdemeAl(taksit.id, {
      tutar: 100,
      odemeTarihi: "2026-05-02",
      odemeYontemi: "BANKA",
      odemeParaBirimi: "USD",
      kasaTutari: 110,
      kurKaynagi: "MANUEL",
    });
    assert(odeme.ok, `icra cross ${!odeme.ok ? odeme.error : ""}`);
    if (odeme.ok) {
      assertApprox(odeme.row.odeme.kur!, roundRate(110 / 100), "icra kur");
      const ofis = d
        .prepare(`SELECT tutar, para_birimi FROM ofis_kasa_hareketleri WHERE id = ?`)
        .get(odeme.row.odeme.ofisKasaHareketId) as { tutar: number; para_birimi: string };
      assertApprox(ofis.tutar, 110, "ofis usd");
      assert(ofis.para_birimi === "USD", "ofis USD");
    }

    const ozet = icraTahsilatUstOzet();
    assert(ozet.byCurrency.EUR.toplamAlacak > 0, "icra byCurrency EUR");
  });
  console.log("[PASS] icra FX");
}

async function testTcmbOfflineManual(): Promise<void> {
  console.log("[test] TCMB offline → manuel devam");
  await withTempDb(async () => {
    clearTcmbCacheForTests();
    const quote = await getTcmbPairRate("USD", "TRY", {
      date: "2099-01-01",
      fetchXml: async () => {
        throw new Error("offline");
      },
    });
    assert(quote == null, "offline null");

    const don = await ofisKasaDovizDonusum(
      {
        tarih: "2026-06-01",
        kaynakParaBirimi: "USD",
        hedefParaBirimi: "EUR",
        kaynakTutar: 10,
        hedefTutar: 9,
        kurKaynagi: "TCMB",
        odemeYontemi: "BANKA",
      },
      1,
      "FX",
    );
    assert(don.ok, `offline donusum ${!don.ok ? don.error : ""}`);
    if (don.ok) {
      assert(don.cikis.kurKaynagi === "MANUEL" || don.cikis.kurKaynagi === "TCMB", "kaynak set");
    }

    seedTcmbCacheForTests({
      istenilenTarih: "2026-09-11",
      bulunanTcmbKurTarihi: "2026-09-11",
      effectiveDate: "2026-09-11",
      fetchedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      fromCache: false,
      source: "TCMB",
      stale: false,
      fallbackKullanildi: false,
      usd: { currency: "USD", buyingRate: "34.80000000", sellingRate: "34.90000000", unit: 1 },
      eur: { currency: "EUR", buyingRate: "37.50000000", sellingRate: "37.60000000", unit: 1 },
      usdEurCapraz: "0.92800000",
      eurUsdCapraz: "1.07758621",
    });
    const q2 = await getTcmbPairRate("USD", "TRY", { date: "2026-09-11", bypassCache: false });
    assert(q2?.available === true, "seeded available");
    assertApprox(Number(q2!.dovizAlis), 34.8, "alis");
  });
  console.log("[PASS] TCMB offline/manual");
}

function unitTcmbHeaderDtoAndFormat(): void {
  console.log("[test] TCMB header DTO + format parity");

  assert(formatTcmbRateDisplay("48.61160000") === "48,6116", "USD 4dp tr");
  assert(formatTcmbRateDisplay("55.79810000") === "55,7981", "EUR 4dp tr");
  assert(formatDateTrShort("2026-09-18") === "18.09.2026", "date short");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(istanbulTodayYmd()), "istanbul today");

  const root = process.cwd();
  const premiumHeader = readFileSync(
    pathResolve(root, "src/renderer-premium/components/kurlar/PremiumTcmbHeaderRates.tsx"),
    "utf8",
  );
  const premiumShell = readFileSync(pathResolve(root, "src/renderer-premium/app/PremiumShell.tsx"), "utf8");
  const legacyShell = readFileSync(pathResolve(root, "src/renderer/components/AppShell.tsx"), "utf8");
  assert(premiumShell.includes("PremiumTcmbHeaderRates"), "Premium shell mounts TCMB header");
  assert(legacyShell.includes("LegacyTcmbHeaderRates"), "Legacy shell mounts TCMB header");
  assert(premiumHeader.includes("kurlarTcmb"), "header calls IPC");
  assert(premiumHeader.includes("TCMB Döviz Alış"), "TCMB label");
  assert(premiumHeader.includes("USD/TRY"), "USD label");
  assert(premiumHeader.includes("EUR/TRY"), "EUR label");
  assert(!/48[,.]6116/.test(premiumHeader), "no hard-coded USD rate");
  assert(!/55[,.]7981/.test(premiumHeader), "no hard-coded EUR rate");
  assert(premiumHeader.includes("forceRefresh: true"), "refresh forces TCMB");

  const vekaletPanel = readFileSync(
    pathResolve(root, "src/renderer-premium/components/vekalet/PremiumVekaletTaksitPanel.tsx"),
    "utf8",
  );
  assert(vekaletPanel.includes("useYaklasikTryBatch"), "Premium vekalet yaklaşık TRY");
  assert(vekaletPanel.includes("BugunkuTlKarsilikCell"), "Premium BugunkuTl cell");

  console.log("[PASS] TCMB header DTO + format parity");
}

async function testYaklasikTryIpcShape(): Promise<void> {
  console.log("[test] yaklasikTry + header DTO shape");
  await withTempDb(async () => {
    clearTcmbCacheForTests();
    seedTcmbCacheForTests({
      istenilenTarih: "2026-09-18",
      bulunanTcmbKurTarihi: "2026-09-18",
      effectiveDate: "2026-09-18",
      fetchedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      fromCache: false,
      source: "TCMB",
      stale: false,
      fallbackKullanildi: false,
      usd: { currency: "USD", buyingRate: "48.61160000", sellingRate: "48.70000000", unit: 1 },
      eur: { currency: "EUR", buyingRate: "55.79810000", sellingRate: "55.90000000", unit: 1 },
      usdEurCapraz: "0.87100000",
      eurUsdCapraz: "1.14800000",
    });
    const snap = await getTcmbRates({ date: "2026-09-18" });
    assert(snap, "snap");
    const dto = {
      usdDovizAlis: snap!.usd.buyingRate,
      eurDovizAlis: snap!.eur.buyingRate,
      sourceLabel: "Türkiye Cumhuriyet Merkez Bankası",
      effectiveDate: snap!.effectiveDate,
    };
    assert(dto.usdDovizAlis === "48.61160000", "usdDovizAlis");
    assert(dto.eurDovizAlis === "55.79810000", "eurDovizAlis");
    assert(dto.sourceLabel.includes("Merkez Bankası"), "sourceLabel");

    const y = yaklasikTryTutar(1000, "USD", snap);
    assert(y.tryTutar != null, "yaklasik try");
    assertApprox(y.tryTutar!, 48611.6, "1000 USD ≈ TRY");
    assert(y.aciklama?.includes("TCMB Döviz Alış"), "yaklasik aciklama");
  });
  console.log("[PASS] yaklasikTry + header DTO shape");
}

export async function runMultiCurrencySmoke(): Promise<void> {
  console.log("=== MKD Multi-Currency Smoke ===");
  unitParaBirimiMath();
  unitTcmbParse();
  unitTcmbHeaderDtoAndFormat();
  await testMigration016Backfill();
  await testOfisFxAndDonusum();
  await testVekaletCrossAndLock();
  await testIcraCross();
  await testTcmbOfflineManual();
  await testYaklasikTryIpcShape();
  console.log("=== ALL MULTI-CURRENCY TESTS PASSED ===");
}
