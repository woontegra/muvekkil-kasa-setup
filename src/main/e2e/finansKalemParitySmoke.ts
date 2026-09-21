/**
 * Parity smoke: finans kalemi + ofis ilgili müvekkil — temp DB only.
 */
import { readFileSync, unlinkSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import {
  archiveFinansKalemi,
  createFinansKalemi,
  listAktifManuelKalemler,
  listFinansKalemleri,
  reorderFinansKalemleri,
  resolveAktifManuelKalem,
} from "../services/finansKalemi.service";
import { ofisKasaHareketEkle, ofisKasaHareketList } from "../services/ofisKasa.service";
import { listAuditLog } from "../services/auditLog.service";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function withTempDb(fn: () => Promise<void> | void): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-parity-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
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

export async function runFinansKalemParitySmoke(): Promise<void> {
  console.log("=== MKD Finans Kalem + İlgili Müvekkil Smoke ===");
  await withTempDb(() => {
    const sistem = listFinansKalemleri({ tur: "GELIR", includeSistem: true, aktif: "true" }).filter((k) => k.sistemMi);
    assert(sistem.some((k) => k.kod === "VEKALET_TAHSILATI"), "sistem VEKALET_TAHSILATI");
    assert(sistem.every((k) => k.sistemMi), "sistem flag");

    const manuel = listAktifManuelKalemler("GELIR");
    assert(manuel.length >= 4, "manuel gelir seeds");
    const locked = resolveAktifManuelKalem(sistem[0].id, "GELIR");
    assert(!locked.ok, "sistem kalem formda seçilemez");

    const created = createFinansKalemi("GELIR", "Test Danışmanlık Geliri");
    assert(created.ok, "create");
    if (!created.ok) return;
    const archived = archiveFinansKalemi(created.row.id);
    assert(archived.ok, "archive");
    const aktifAfter = listAktifManuelKalemler("GELIR").some((k) => k.id === created.row.id);
    assert(!aktifAfter, "archived not in form list");

    const aktif = listAktifManuelKalemler("GELIR");
    const ids = aktif.map((k) => k.id);
    const reordered = [...ids.slice(1), ids[0]!];
    const ord = reorderFinansKalemleri("GELIR", reordered);
    assert(ord.ok, "reorder");

    const d = getDb();
    const t = nowIso();
    d.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi, aktif_mi) VALUES ('GERCEK_KISI', 'Ayşe Yılmaz', ?, ?, 1)`,
    ).run(t, t);
    const muvekkilId = Number((d.prepare(`SELECT last_insert_rowid() AS id`).get() as { id: number }).id);

    const kalem = listAktifManuelKalemler("GELIR")[0]!;
    const ekle = ofisKasaHareketEkle(
      {
        islemTipi: "GELIR",
        tarih: "2026-09-15",
        kalemId: kalem.id,
        tutar: 1500,
        odemeYontemi: "NAKIT",
        muvekkilId,
        aciklama: "Test gelir",
      },
      1,
      "Test User",
    );
    assert(ekle.ok, `ofis ekle ${!ekle.ok ? ekle.error : ""}`);
    if (ekle.ok) {
      assert(ekle.row.muvekkilId === muvekkilId, "muvekkil id");
      assert(ekle.row.muvekkilAdiSnapshot === "Ayşe Yılmaz", "snapshot");
      assert(ekle.row.kalemId === kalem.id, "kalem id");
    }

    const liste = ofisKasaHareketList({
      tarihBas: "2026-01-01",
      tarihBit: "2026-12-31",
      muvekkilId,
    });
    assert(liste.some((h) => h.muvekkilId === muvekkilId), "list filter muvekkil");

    const audit = listAuditLog({ limit: 20 });
    assert(audit.total >= 1, "audit has entries");

    console.log("[PASS] finans kalem + ilgili müvekkil");
  });

  // Premium UI source structure (SaaS GelirGiderKalemleriPanel parity)
  {
    const root = process.cwd();
    const tsx = readFileSync(
      pathResolve(root, "src/renderer-premium/components/settings/SettingsKalemleriSection.tsx"),
      "utf8",
    );
    const css = readFileSync(pathResolve(root, "src/renderer-premium/styles/settings.css"), "utf8");
    assert(tsx.includes("pm-kalem-tabs"), "ui tabs");
    assert(tsx.includes("pm-kalem-add"), "ui add row");
    assert(tsx.includes("pm-kalem-rows"), "ui row list");
    assert(tsx.includes("pm-kalem-row-actions"), "ui actions");
    assert(tsx.includes("pm-kalem-lock"), "ui system lock badge");
    assert(tsx.includes("Sistem tarafından yönetilir"), "ui system helper");
    assert(!tsx.includes("pm-kalem-list"), "no legacy bullet list class");
    assert(css.includes(".pm-kalem-row"), "css row");
    assert(css.includes("list-style: none"), "css no bullets");
    assert(css.includes(".pm-kalem-add"), "css add form");
    console.log("[PASS] premium kalem UI source structure");
  }

  console.log("=== ALL FINANZ KALEM PARITY TESTS PASSED ===");
}
