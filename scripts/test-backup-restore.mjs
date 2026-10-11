/**
 * Yedekten geri yükleme regresyon testi (Aşama 1).
 * Gerçek backupRestore.ts + gerçek migration'lar; yalnızca os.tmpdir() altındaki izole SQLite dosyaları.
 * Gerçek kullanıcı verisine, userData klasörüne ve ağa dokunmaz.
 * better-sqlite3 Electron ABI'si için derlendiğinden betik kendini ELECTRON_RUN_AS_NODE ile yeniden başlatır.
 * Çalıştırma: node scripts/test-backup-restore.mjs
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
  writeSync,
  closeSync,
} from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.versions.electron) {
  const rel = readFileSync(join(root, "node_modules/electron/path.txt"), "utf8").trim();
  const exe = join(root, "node_modules/electron/dist", rel);
  const r = spawnSync(exe, [fileURLToPath(import.meta.url)], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  process.exit(r.status ?? 1);
}

const require = createRequire(join(root, "package.json"));
const Database = require("better-sqlite3");
const { build } = require("esbuild");

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

const tmp = mkdtempSync(join(os.tmpdir(), "mkd-restore-test-"));
const realConsoleError = console.error;

try {
  const entry = join(tmp, "entry.ts");
  writeFileSync(
    entry,
    `export { restoreFromBackupFile, cleanupRestoreWorkspace, RESTORE_WORK_DIR_NAME } from ${JSON.stringify(
      join(root, "src/main/services/backupRestore.ts"),
    )};
export { allMigrations } from ${JSON.stringify(join(root, "src/main/migrations/index.ts"))};
export { runMigrations } from ${JSON.stringify(join(root, "src/main/db/migrate.ts"))};
`,
  );
  const outfile = join(tmp, "bundle.cjs");
  const betterSqlitePath = require.resolve("better-sqlite3");
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "error",
    alias: { "@shared": join(root, "src/shared") },
    plugins: [
      {
        name: "stubs",
        setup(b) {
          b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: `export const app = { getPath: () => { throw new Error("test: userData kullanılmamalı"); }, getVersion: () => "0.1.14", isPackaged: false };
export const dialog = {}; export default { app, dialog };`,
            loader: "js",
          }));
          b.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: betterSqlitePath, external: true }));
        },
      },
    ],
  });
  const mod = await import(pathToFileURL(outfile).href);
  const { restoreFromBackupFile, cleanupRestoreWorkspace, RESTORE_WORK_DIR_NAME, allMigrations, runMigrations } =
    mod.default ?? mod;

  const nowIso = () => new Date().toISOString();
  const ids = allMigrations.map((m) => m.id);
  const upTo = (id) => allMigrations.slice(0, ids.indexOf(id) + 1);

  function insertRow(db, table, values) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const row = { ...values };
    for (const c of cols) {
      if (c.name in row || c.pk || !c.notnull || c.dflt_value !== null) continue;
      row[c.name] = c.type.toUpperCase().includes("INT") || c.type.toUpperCase().includes("REAL") ? 0 : "x";
    }
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(
      ...keys.map((k) => row[k]),
    );
  }

  function addUser(db, kullaniciAdi) {
    insertRow(db, "uygulama_kullanici", {
      ad_soyad: kullaniciAdi,
      kullanici_adi: kullaniciAdi,
      sifre_hash: "hash-" + kullaniciAdi,
      kayit_tarihi: nowIso(),
    });
  }

  function addLicense(db, key, deviceHash) {
    const cols = new Set(db.prepare(`PRAGMA table_info(yerel_lisans)`).all().map((c) => c.name));
    const row = {
      id: 1,
      license_key: key,
      device_hash: deviceHash,
      product_name: "Müvekkil Kasa",
      expires_at: "2099-01-01T00:00:00.000Z",
      last_validated_at: nowIso(),
      offline_grace_until: "2099-01-01T00:00:00.000Z",
      status: "ACTIVE",
      kayit_tarihi: nowIso(),
      guncelleme_tarihi: nowIso(),
    };
    if (cols.has("kind")) row.kind = "paid";
    insertRow(db, "yerel_lisans", row);
  }

  /** Uygulamanın yedek dosyası gibi: WAL modunda, checkpoint edilmiş tek dosya. */
  function makeDbFile(path, migrations, seed) {
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    runMigrations(db, migrations, nowIso);
    seed?.(db);
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
  }

  const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

  let caseNo = 0;
  function setupCase({ liveLicense = true } = {}) {
    const dir = join(tmp, `case-${++caseNo}`);
    const userDataDir = join(dir, "userData");
    const dbPath = join(userDataDir, "muvekkil-kasa-defteri.sqlite");
    makeDbFile(dbPath, allMigrations, (db) => {
      addUser(db, "canli_kullanici");
      if (liveLicense) addLicense(db, "LIVE-KEY", "live-device-hash");
    });
    let handle = null;
    const live = {
      getDb() {
        if (!handle) {
          handle = new Database(dbPath);
          handle.pragma("journal_mode = WAL");
          handle.pragma("foreign_keys = ON");
        }
        return handle;
      },
      closeDb() {
        handle?.close();
        handle = null;
      },
      isOpen: () => handle !== null,
    };
    live.getDb();
    const deps = { dbPath, userDataDir, getDb: live.getDb, closeDb: live.closeDb, migrations: allMigrations, nowIso };
    return { dir, userDataDir, dbPath, live, deps };
  }

  const users = (db) => db.prepare(`SELECT kullanici_adi FROM uygulama_kullanici ORDER BY kullanici_adi`).all().map((r) => r.kullanici_adi);
  const license = (db) => db.prepare(`SELECT * FROM yerel_lisans`).all();
  const autoBackups = (c) => {
    const d = join(c.userDataDir, "auto-backups");
    return existsSync(d) ? readdirSync(d) : [];
  };
  const workspaceEmpty = (c) => {
    const d = join(c.userDataDir, RESTORE_WORK_DIR_NAME);
    return !existsSync(d) || readdirSync(d).length === 0;
  };

  function run(c, src, depsOverride = {}) {
    const before = existsSync(src) ? sha(src) : null;
    console.error = () => {};
    let r;
    try {
      r = restoreFromBackupFile(src, { ...c.deps, ...depsOverride });
    } finally {
      console.error = realConsoleError;
    }
    if (before) assert(sha(src) === before, "seçilen yedek dosyası değiştirilmedi");
    return r;
  }

  function assertLiveUntouched(c, liveLicenseBefore) {
    assert(c.live.isOpen(), "canlı veritabanı açık bırakıldı");
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["canli_kullanici"]), "canlı veriler değişmedi");
    assert(JSON.stringify(license(db)) === JSON.stringify(liveLicenseBefore), "canlı lisans kaydı değişmedi");
    assert(db.pragma("quick_check", { simple: true }) === "ok", "canlı veritabanı sağlam");
    assert(workspaceEmpty(c), "geçici çalışma alanı temizlendi");
  }

  function expectRejected(title, code, makeSrc, opts = {}) {
    console.log(`\n${title}`);
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const src = makeSrc(c);
    const r = run(c, src, opts.deps);
    assert(r.ok === false && r.code === code, `reddedildi: ${code} (gelen: ${r.ok ? "ok" : r.code})`);
    assert(typeof r.error === "string" && r.error.includes("Mevcut veritabanı değiştirilmedi"), "kullanıcı mesajı");
    assert(autoBackups(c).length === 0, "yarım 'oncesi' dosyası bırakılmadı");
    assertLiveUntouched(c, licBefore);
  }

  // ── Başarılı senaryolar ─────────────────────────────────────
  console.log("\n1) Eski şema (007) yedeği: migration geçici kopyada, lisans bu cihazdan korunur");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const src = join(c.dir, "eski-yedek.sqlite");
    makeDbFile(src, upTo("007_ofis_kasa_duzeltme_alanlari"), (db) => addUser(db, "yedek_kullanici"));
    const r = run(c, src);
    assert(r.ok === true, "geri yükleme başarılı");
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["yedek_kullanici"]), "yedekteki veriler yüklendi");
    const applied = db.prepare(`SELECT id FROM schema_migrations`).all().map((x) => x.id);
    assert(ids.every((id) => applied.includes(id)), "tüm migration'lar uygulanmış");
    assert(JSON.stringify(license(db)) === JSON.stringify(licBefore), "bu cihazın lisans kaydı aynen korundu");
    assert(db.pragma("journal_mode", { simple: true }) === "wal", "canlı bağlantı WAL modunda");
    assert(r.ok && existsSync(r.autoBackupPath), "geri yükleme öncesi otomatik yedek var");
    assert(r.ok && /auto-backups[\\/]oncesi-.+\.sqlite$/.test(r.autoBackupPath), "otomatik yedek adı/klasörü aynı");
    const pre = new Database(r.autoBackupPath, { readonly: true });
    assert(JSON.stringify(users(pre)) === JSON.stringify(["canli_kullanici"]), "otomatik yedek önceki veriyi içeriyor");
    assert(pre.pragma("integrity_check", { simple: true }) === "ok", "otomatik yedek sağlam");
    pre.close();
    assert(workspaceEmpty(c), "geçici çalışma alanı temizlendi");
  }

  console.log("\n2) Başka bilgisayarın lisanslı yedeği: yedekteki lisans taşınmaz");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const src = join(c.dir, "diger-pc.sqlite");
    makeDbFile(src, allMigrations, (db) => {
      addUser(db, "diger_kullanici");
      addLicense(db, "OTHER-KEY", "other-device-hash");
    });
    const r = run(c, src);
    assert(r.ok === true, "geri yükleme başarılı");
    const lic = license(c.live.getDb());
    assert(JSON.stringify(lic) === JSON.stringify(licBefore), "canlı lisans korundu");
    assert(!lic.some((l) => l.license_key === "OTHER-KEY"), "yedekteki lisans anahtarı yok");
  }

  console.log("\n3) Lisanssız bilgisayar + lisanslı yedek: lisans kazanılmaz");
  {
    const c = setupCase({ liveLicense: false });
    const src = join(c.dir, "lisansli.sqlite");
    makeDbFile(src, allMigrations, (db) => {
      addUser(db, "diger_kullanici");
      addLicense(db, "OTHER-KEY", "other-device-hash");
    });
    const r = run(c, src);
    assert(r.ok === true, "geri yükleme başarılı");
    assert(license(c.live.getDb()).length === 0, "yerel_lisans boş");
  }

  console.log("\n4) Lisans tablosu 014 öncesi (license_key NOT NULL) olan eski lisanslı yedek");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const src = join(c.dir, "v010.sqlite");
    makeDbFile(src, upTo("010_vekalet_avans_temizlik"), (db) => {
      addUser(db, "eski_kullanici");
      addLicense(db, "OLD-KEY", "old-device-hash");
    });
    const r = run(c, src);
    assert(r.ok === true, "geri yükleme başarılı");
    assert(JSON.stringify(license(c.live.getDb())) === JSON.stringify(licBefore), "canlı lisans korundu");
  }

  // ── Reddedilen yedekler (canlı veri değişmemeli) ──────────
  expectRejected("5) SQLite olmayan dosya", "INVALID_SQLITE", (c) => {
    const p = join(c.dir, "metin.sqlite");
    writeFileSync(p, "bu bir veritabanı değil");
    return p;
  });

  expectRejected("6) Bozuk yedek (sayfalar bozulmuş)", "CORRUPT", (c) => {
    const p = join(c.dir, "bozuk.sqlite");
    makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
    const size = statSync(p).size;
    const fd = openSync(p, "r+");
    writeSync(fd, Buffer.alloc(size - 4096, 0xab), 0, size - 4096, 4096);
    closeSync(fd);
    return p;
  });

  expectRejected("7) Yarım kopyalanmış (kesik) yedek", "CORRUPT", (c) => {
    const p = join(c.dir, "kesik.sqlite");
    makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
    truncateSync(p, Math.floor(statSync(p).size / 2));
    return p;
  });

  expectRejected("8) Başka uygulamanın SQLite dosyası", "NOT_APP_BACKUP", (c) => {
    const p = join(c.dir, "baska.sqlite");
    const db = new Database(p);
    db.exec(`CREATE TABLE foo (id INTEGER)`);
    db.close();
    return p;
  });

  expectRejected("9) Daha yeni sürümün yedeği", "NEWER_VERSION", (c) => {
    const p = join(c.dir, "yeni.sqlite");
    makeDbFile(p, allMigrations, (db) =>
      db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES ('999_gelecek', ?)`).run(nowIso()),
    );
    return p;
  });

  expectRejected("10) Eksik tablo (migration kaydı var, tablo yok)", "MISSING_TABLES", (c) => {
    const p = join(c.dir, "eksik.sqlite");
    const probe = join(c.dir, "probe.sqlite");
    makeDbFile(probe, upTo("012_app_settings"));
    const pdb = new Database(probe, { readonly: true });
    const older = new Set(pdb.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name));
    pdb.close();
    makeDbFile(p, allMigrations, (db) => {
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name);
      const target = tables.find((t) => !older.has(t) && !t.startsWith("sqlite_"));
      db.pragma("foreign_keys = OFF");
      db.exec(`DROP TABLE "${target}"`);
    });
    return p;
  });

  expectRejected(
    "11) Migration hatası",
    "MIGRATION_FAILED",
    (c) => {
      const p = join(c.dir, "mig.sqlite");
      makeDbFile(p, upTo("007_ofis_kasa_duzeltme_alanlari"));
      return p;
    },
    {
      deps: {
        migrations: [
          ...allMigrations,
          {
            id: "999_test_hata",
            up() {
              throw new Error("test migration hatası");
            },
          },
        ],
      },
    },
  );

  expectRejected("12) Yetersiz disk alanı (ön kontrol)", "DISK_FULL", (c) => {
    const p = join(c.dir, "ok.sqlite");
    makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
    c.deps.freeBytes = () => 0;
    return p;
  });

  {
    let calls = 0;
    expectRejected("13) Kopyalama sırasında ENOSPC (geçici kopya)", "DISK_FULL", (c) => {
      const p = join(c.dir, "ok.sqlite");
      makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
      c.deps.copyFile = () => {
        calls++;
        throw Object.assign(new Error("no space"), { code: "ENOSPC" });
      };
      return p;
    });
    assert(calls === 1, "hata ilk kopyada oluştu");
  }

  {
    let calls = 0;
    expectRejected("14) Canlı kapatıldıktan sonra 'oncesi' kopyasında ENOSPC", "DISK_FULL", (c) => {
      const p = join(c.dir, "ok.sqlite");
      makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
      c.deps.copyFile = (s, d) => {
        calls++;
        if (calls === 2) throw Object.assign(new Error("no space"), { code: "ENOSPC" });
        writeFileSync(d, readFileSync(s));
      };
      return p;
    });
    assert(calls === 2, "hata canlı DB kapatıldıktan sonra oluştu");
  }

  {
    let calls = 0;
    expectRejected("15) Canlı kapatıldıktan sonra beklenmeyen G/Ç hatası (kesinti benzetimi)", "FAILED", (c) => {
      const p = join(c.dir, "ok.sqlite");
      makeDbFile(p, allMigrations, (db) => addUser(db, "x"));
      c.deps.copyFile = (s, d) => {
        calls++;
        if (calls === 2) throw Object.assign(new Error("EIO"), { code: "EIO" });
        writeFileSync(d, readFileSync(s));
      };
      return p;
    });
  }

  console.log("\n16) Değişimden sonra açılış hatası: önceki veritabanına eksiksiz dönüş");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const src = join(c.dir, "ok.sqlite");
    makeDbFile(src, allMigrations, (db) => addUser(db, "yedek_kullanici"));
    let n = 0;
    const r = run(c, src, {
      getDb: () => {
        n++;
        if (n === 2) throw new Error("test: açılamadı");
        return c.live.getDb();
      },
    });
    assert(r.ok === false && r.code === "ROLLED_BACK", `geri alındı (gelen: ${r.ok ? "ok" : r.code})`);
    assert(r.ok === false && r.autoBackupPath && existsSync(r.autoBackupPath), "geri yükleme öncesi kopya duruyor");
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["canli_kullanici"]), "önceki veriler geri geldi");
    assert(JSON.stringify(license(db)) === JSON.stringify(licBefore), "önceki lisans geri geldi");
    assert(db.pragma("integrity_check", { simple: true }) === "ok", "geri dönülen veritabanı sağlam");
    assert(workspaceEmpty(c), "geçici çalışma alanı temizlendi");
  }

  console.log("\n17) Kesinti sonrası açılış: kalan geçici çalışma alanı temizlenir, canlı DB'ye dokunulmaz");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const leftover = join(c.userDataDir, RESTORE_WORK_DIR_NAME, "2026-01-01T00-00-00-000Z");
    mkdirSync(leftover, { recursive: true });
    writeFileSync(join(leftover, "candidate.sqlite"), "yarım");
    writeFileSync(join(leftover, "oncesi.sqlite"), "yarım");
    const liveHash = (c.live.closeDb(), sha(c.dbPath));
    cleanupRestoreWorkspace(c.userDataDir);
    assert(!existsSync(join(c.userDataDir, RESTORE_WORK_DIR_NAME)), "kalan geçici klasör silindi");
    assert(sha(c.dbPath) === liveHash, "canlı DB dosyası bayt bayt aynı");
    assert(autoBackups(c).length === 0, "otomatik yedek klasörüne dokunulmadı");
    assert(JSON.stringify(license(c.live.getDb())) === JSON.stringify(licBefore), "lisans aynı");
  }

  console.log("\n18) Ardışık iki geri yükleme");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const a = join(c.dir, "a.sqlite");
    const b = join(c.dir, "b.sqlite");
    makeDbFile(a, allMigrations, (db) => addUser(db, "a_kullanici"));
    makeDbFile(b, upTo("005_vekalet_taksit_odeme"), (db) => addUser(db, "b_kullanici"));
    let t = Date.parse("2026-10-10T10:00:00.000Z");
    const now = () => new Date((t += 1000));
    const r1 = run(c, a, { now });
    const r2 = run(c, b, { now });
    assert(r1.ok && r2.ok, "iki geri yükleme de başarılı");
    assert(JSON.stringify(users(c.live.getDb())) === JSON.stringify(["b_kullanici"]), "son yedek yüklendi");
    assert(autoBackups(c).filter((f) => f.endsWith(".sqlite")).length === 2, "her geri yükleme için ayrı 'oncesi' yedeği");
    assert(JSON.stringify(license(c.live.getDb())) === JSON.stringify(licBefore), "lisans korundu");
  }
} finally {
  console.error = realConsoleError;
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız`);
process.exit(failed ? 1 : 0);
