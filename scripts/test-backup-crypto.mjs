/**
 * Manuel yedek testi: yeni yedekler şifresiz SQLite; önceki sürümlerin şifreli .mkyedek yedekleri hâlâ geri yüklenebilir.
 * Gerçek backupCrypto / backupCreate / backupRestore + gerçek migration'lar; yalnızca os.tmpdir() altındaki izole SQLite dosyaları.
 * Gerçek kullanıcı verisine, userData klasörüne ve ağa dokunmaz. Eski şifreli yedek örnekleri scripts/lib/legacy-mkyedek-fixture.mjs ile üretilir.
 * Kapsam: şifresiz yedek oluşturma, eski şifreli yedeği parola / kurtarma anahtarıyla açma, yanlış sır, bozuk/kesik dosya,
 * başlık oynama, eski şifresiz yedek uyumluluğu, güvenli geri yükleme kuralları, Windows–Mac taşınabilirliği.
 * Çalıştırma: node scripts/test-backup-crypto.mjs
 */
import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import {
  closeSync,
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
const { writeLegacyEncryptedBackup, formatRecoveryKey } = await import(
  pathToFileURL(join(root, "scripts/lib/legacy-mkyedek-fixture.mjs")).href
);

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
function throwsCode(fn, code) {
  try {
    fn();
    return "atılmadı";
  } catch (e) {
    return e?.code === code ? true : String(e?.code ?? e);
  }
}

const tmp = mkdtempSync(join(os.tmpdir(), "mkd-backup-crypto-test-"));
const realConsoleError = console.error;
const PASSWORD = "Güçlü-Yedek-Parola-2026!";
const MARKER = "GIZLI_MUVEKKIL_ORNEK_ADI_7f3a";

try {
  const entry = join(tmp, "entry.ts");
  const src = (p) => JSON.stringify(join(root, p));
  writeFileSync(
    entry,
    `export * from ${src("src/main/services/backupCrypto.ts")};
export * as createModule from ${src("src/main/services/backupCreate.ts")};
export { createPlainBackup, BACKUP_WORK_DIR_NAME, cleanupBackupWorkspace } from ${src("src/main/services/backupCreate.ts")};
export { restoreFromBackupFile, RESTORE_WORK_DIR_NAME } from ${src("src/main/services/backupRestore.ts")};
export * from ${src("src/shared/backupPassword.ts")};
export * as passwordModule from ${src("src/shared/backupPassword.ts")};
export * as cryptoModule from ${src("src/main/services/backupCrypto.ts")};
export { allMigrations } from ${src("src/main/migrations/index.ts")};
export { runMigrations } from ${src("src/main/db/migrate.ts")};
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
  const m = await import(pathToFileURL(outfile).href);
  const mod = m.default ?? m;
  const {
    decryptBackupFile,
    isEncryptedBackupFile,
    readEncryptedBackupHeader,
    createPlainBackup,
    BACKUP_WORK_DIR_NAME,
    cleanupBackupWorkspace,
    restoreFromBackupFile,
    RESTORE_WORK_DIR_NAME,
    parseRecoveryKey,
    allMigrations,
    runMigrations,
    createModule,
    passwordModule,
    cryptoModule,
  } = mod;
  const encryptBackupFile = writeLegacyEncryptedBackup;

  const nowIso = () => new Date().toISOString();
  const ids = allMigrations.map((x) => x.id);
  const upTo = (id) => allMigrations.slice(0, ids.indexOf(id) + 1);
  const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

  function insertRow(db, table, values) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    const row = { ...values };
    for (const c of cols) {
      if (c.name in row || c.pk || !c.notnull || c.dflt_value !== null) continue;
      row[c.name] = /INT|REAL/i.test(c.type) ? 0 : "x";
    }
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(
      ...keys.map((k) => row[k]),
    );
  }
  const addUser = (db, u) =>
    insertRow(db, "uygulama_kullanici", { ad_soyad: u, kullanici_adi: u, sifre_hash: "hash-" + u, kayit_tarihi: nowIso() });
  function addLicense(db, key, deviceHash) {
    const cols = new Set(db.prepare(`PRAGMA table_info(yerel_lisans)`).all().map((c) => c.name));
    const row = {
      id: 1,
      license_key: key,
      device_hash: deviceHash,
      product_name: "Müvekkil Kasa",
      expires_at: "2099-01-01T00:00:00.000Z",
      status: "ACTIVE",
      kayit_tarihi: nowIso(),
      guncelleme_tarihi: nowIso(),
    };
    if (cols.has("kind")) row.kind = "paid";
    insertRow(db, "yerel_lisans", row);
  }
  function makeDbFile(path, migrations, seed) {
    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    runMigrations(db, migrations, nowIso);
    seed?.(db);
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
  }

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
  const dirEmpty = (d) => !existsSync(d) || readdirSync(d).length === 0;
  const autoBackups = (c) => {
    const d = join(c.userDataDir, "auto-backups");
    return existsSync(d) ? readdirSync(d) : [];
  };
  function quiet(fn) {
    console.error = () => {};
    try {
      return fn();
    } finally {
      console.error = realConsoleError;
    }
  }

  /** Önceki sürümle oluşturulmuş şifreli yedek: kaynak DB + eski biçim örneği. */
  async function makeEncryptedBackup(dir, migrations, seed, password = PASSWORD) {
    const plain = join(dir, `kaynak-${randomBytes(3).toString("hex")}.sqlite`);
    makeDbFile(plain, migrations, seed);
    const out = join(dir, `yedek-${randomBytes(3).toString("hex")}.mkyedek`);
    const { recoveryKey } = encryptBackupFile(plain, out, password);
    return { path: out, recoveryKey };
  }

  // ── 1) Yeni şifreli yedek oluşturma kaldırıldı ──────────
  console.log("\n1) Şifreli yedek oluşturma kodu kaldırıldı");
  assert(cryptoModule.encryptBackupFile === undefined, "backupCrypto: encryptBackupFile yok");
  assert(cryptoModule.verifyEncryptedBackup === undefined, "backupCrypto: verifyEncryptedBackup yok");
  assert(createModule.createEncryptedBackup === undefined, "backupCreate: createEncryptedBackup yok");
  assert(passwordModule.validateBackupPassword === undefined, "backupPassword: parola güç kuralı yok");
  assert(passwordModule.formatRecoveryKey === undefined, "backupPassword: kurtarma anahtarı üretimi yok");
  assert(typeof cryptoModule.decryptBackupFile === "function", "backupCrypto: eski yedekler için çözme duruyor");
  assert(typeof passwordModule.parseRecoveryKey === "function", "backupPassword: kurtarma anahtarı girişi duruyor");

  // ── 2) Kurtarma anahtarı biçimi ─────────────────────────
  console.log("\n2) Kurtarma anahtarı biçimi");
  {
    const raw = randomBytes(20);
    const key = formatRecoveryKey(raw);
    assert(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/.test(key), "8×4 Crockford Base32");
    assert(Buffer.from(parseRecoveryKey(key)).equals(raw), "geri çözüm aynı bayt");
    const messy = `  ${key.toLowerCase().replace(/-/g, " ")}\r\n`;
    assert(Buffer.from(parseRecoveryKey(messy)).equals(raw), "küçük harf, boşluk, CRLF tolere edilir");
    assert(parseRecoveryKey(key.slice(0, -1)) === null, "eksik karakter red");
    assert(parseRecoveryKey(key.replace(/-/g, "").slice(0, 31) + "U") === null, "geçersiz karakter red");
  }

  // ── 3) Eski şifreli yedeği okuma ────────────────────────
  console.log("\n3) Eski şifreli yedeği açma (parola, kurtarma anahtarı)");
  const d3 = join(tmp, "enc");
  mkdirSync(d3);
  const plain3 = join(d3, "plain.sqlite");
  makeDbFile(plain3, allMigrations, (db) => {
    addUser(db, MARKER);
    addLicense(db, "SECRET-LICENSE-KEY-123", "device-x");
  });
  const enc3 = join(d3, "a.mkyedek");
  const { recoveryKey: rk3 } = encryptBackupFile(plain3, enc3, PASSWORD);
  assert(isEncryptedBackupFile(enc3), "sihirli değer tanınıyor");
  assert(!isEncryptedBackupFile(plain3), "düz SQLite şifreli sayılmıyor");
  const bytes3 = readFileSync(enc3);
  const h3 = readEncryptedBackupHeader(enc3);
  assert(h3.slots.length === 2 && h3.slots[0].type === "password" && h3.slots[1].type === "recovery", "başlık okunuyor: iki anahtar yuvası");

  const t0 = Date.now();
  const out3a = join(d3, "out-pw.sqlite");
  decryptBackupFile(enc3, out3a, { kind: "password", value: PASSWORD });
  console.log(`    (önceki sürüm parametreleriyle çözme ${Date.now() - t0} ms)`);
  assert(sha(out3a) === sha(plain3), "parola ile çözülen dosya birebir aynı");
  const out3b = join(d3, "out-rk.sqlite");
  decryptBackupFile(enc3, out3b, { kind: "recovery", value: rk3.toLowerCase() });
  assert(sha(out3b) === sha(plain3), "kurtarma anahtarı tek başına açıyor");

  const enc3b = join(d3, "b.mkyedek");
  encryptBackupFile(plain3, enc3b, PASSWORD);
  assert(throwsCode(() => decryptBackupFile(enc3b, null, { kind: "recovery", value: rk3 }), "WRONG_SECRET") === true, "başka yedeğin kurtarma anahtarı açmıyor");

  // ── 4) Yanlış sır ve bozuk dosyalar ─────────────────────
  console.log("\n4) Yanlış parola / anahtar ve bozuk dosyalar");
  const noOut = join(d3, "should-not-exist.sqlite");
  assert(throwsCode(() => decryptBackupFile(enc3, noOut, { kind: "password", value: PASSWORD + "x" }), "WRONG_SECRET") === true, "yanlış parola → WRONG_SECRET");
  assert(!existsSync(noOut), "yanlış parolada çıktı dosyası oluşmadı");
  assert(throwsCode(() => decryptBackupFile(enc3, null, { kind: "recovery", value: formatRecoveryKey(randomBytes(20)) }), "WRONG_SECRET") === true, "yanlış kurtarma anahtarı → WRONG_SECRET");
  assert(throwsCode(() => decryptBackupFile(enc3, null, { kind: "recovery", value: "abc" }), "WRONG_SECRET") === true, "biçimsiz kurtarma anahtarı → WRONG_SECRET");
  assert(throwsCode(() => decryptBackupFile(enc3, null, { kind: "password", value: rk3 }), "WRONG_SECRET") === true, "kurtarma anahtarı parola yuvasını açmıyor");

  function mutated(name, fn) {
    const p = join(d3, name);
    const b = Buffer.from(bytes3);
    const r = fn(b) ?? b;
    writeFileSync(p, r);
    return p;
  }
  const prefixLen = 14 + bytes3.readUInt32BE(10);
  const cases = [
    ["şifreli veride 1 bit", mutated("c1.mkyedek", (b) => void (b[prefixLen + 100] ^= 1)), "CORRUPT"],
    ["GCM etiketi", mutated("c2.mkyedek", (b) => void (b[b.length - 1] ^= 1)), "CORRUPT"],
    ["kesik dosya", mutated("c3.mkyedek", (b) => b.subarray(0, Math.floor(b.length / 2))), "CORRUPT"],
    ["sona veri eklenmiş", mutated("c4.mkyedek", (b) => Buffer.concat([b, Buffer.from("x")])), "CORRUPT"],
    [
      "başlıkta veri nonce'u değişmiş",
      mutated("c5.mkyedek", (b) => {
        const hdr = JSON.parse(b.subarray(14, prefixLen).toString("utf8"));
        hdr.nonce = randomBytes(12).toString("base64");
        const nb = Buffer.from(JSON.stringify(hdr));
        const fixed = Buffer.from(b.subarray(0, 14));
        fixed.writeUInt32BE(nb.length, 10);
        return Buffer.concat([fixed, nb, b.subarray(prefixLen)]);
      }),
      "CORRUPT",
    ],
    [
      "başlıkta createdAt değişmiş (AAD)",
      mutated("c6.mkyedek", (b) => {
        const s = b.subarray(14, prefixLen).toString("utf8").replace(/"createdAt":"\d/, (x) => x.slice(0, -1) + (x.endsWith("1") ? "2" : "1"));
        return Buffer.concat([b.subarray(0, 14), Buffer.from(s), b.subarray(prefixLen)]);
      }),
      "CORRUPT",
    ],
    ["başlık uzunluğu bozuk", mutated("c7.mkyedek", (b) => void b.writeUInt32BE(0xffffff, 10)), "CORRUPT"],
    ["başlık JSON değil", mutated("c8.mkyedek", (b) => void b.fill(0x7b, 14, 30)), "CORRUPT"],
    ["bilinmeyen biçim sürümü", mutated("c9.mkyedek", (b) => void b.writeUInt16BE(99, 8)), "UNSUPPORTED_VERSION"],
    [
      "aşırı scrypt parametresi (DoS)",
      mutated("c10.mkyedek", (b) => {
        const hdr = JSON.parse(b.subarray(14, prefixLen).toString("utf8"));
        hdr.slots[0].kdf.N = 2 ** 24;
        const nb = Buffer.from(JSON.stringify(hdr));
        const fixed = Buffer.from(b.subarray(0, 14));
        fixed.writeUInt32BE(nb.length, 10);
        return Buffer.concat([fixed, nb, b.subarray(prefixLen)]);
      }),
      "CORRUPT",
    ],
    ["sarılmış anahtar bozuk", mutated("c11.mkyedek", (b) => {
      const s = b.subarray(14, prefixLen).toString("utf8");
      const hdr = JSON.parse(s);
      const wk = Buffer.from(hdr.slots[0].wrappedKey, "base64");
      wk[0] ^= 1;
      hdr.slots[0].wrappedKey = wk.toString("base64");
      const nb = Buffer.from(JSON.stringify(hdr));
      const fixed = Buffer.from(b.subarray(0, 14));
      fixed.writeUInt32BE(nb.length, 10);
      return Buffer.concat([fixed, nb, b.subarray(prefixLen)]);
    }), "WRONG_SECRET"],
  ];
  for (const [name, p, code] of cases) {
    const out = join(d3, `o-${randomBytes(3).toString("hex")}.sqlite`);
    let r;
    try {
      decryptBackupFile(p, out, { kind: "password", value: PASSWORD });
      r = "atılmadı";
    } catch (e) {
      r = e?.code === code ? true : String(e?.code ?? e);
    }
    assert(r === true, `${name} → ${code}${r === true ? "" : ` (gelen: ${r})`}`);
  }

  // ── 5) Taşınabilirlik ───────────────────────────────────
  console.log("\n5) Windows–Mac taşınabilirliği");
  {
    const realPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const realHostname = os.hostname;
    const setPlatform = (p) => Object.defineProperty(process, "platform", { value: p, configurable: true });
    try {
      setPlatform("darwin");
      os.hostname = () => "Avukat-MacBook";
      const encMac = join(d3, "mac.mkyedek");
      const { recoveryKey: rkMac } = encryptBackupFile(plain3, encMac, PASSWORD);
      setPlatform("win32");
      os.hostname = () => "BURO-PC";
      const outWin = join(d3, "win-out.sqlite");
      decryptBackupFile(encMac, outWin, { kind: "password", value: PASSWORD });
      assert(sha(outWin) === sha(plain3), "Mac'te şifrelenen, Windows'ta parola ile açılıyor");
      decryptBackupFile(encMac, null, { kind: "recovery", value: rkMac.replace(/-/g, " ") + "\r\n" });
      assert(true, "Windows'ta (CRLF'li metinden) kurtarma anahtarı ile açılıyor");
      const encWin = join(d3, "win.mkyedek");
      encryptBackupFile(plain3, encWin, PASSWORD);
      setPlatform("darwin");
      decryptBackupFile(encWin, null, { kind: "password", value: PASSWORD });
      assert(true, "Windows'ta şifrelenen, Mac'te açılıyor");
    } finally {
      Object.defineProperty(process, "platform", realPlatform);
      os.hostname = realHostname;
    }

    const nfc = "Şifre-Güçlü-İçin-2026";
    const nfd = nfc.normalize("NFD");
    assert(nfc !== nfd, "(test) NFC ve NFD farklı bayt dizileri");
    const encN = join(d3, "nfc.mkyedek");
    encryptBackupFile(plain3, encN, nfc);
    decryptBackupFile(encN, null, { kind: "password", value: nfd });
    assert(true, "NFC ile şifrelenen parola NFD girişle açılıyor (Mac/Windows klavye farkı)");

    // Bağımsız (spesifikasyondan) uygulama ile çapraz doğrulama: biçim yalnızca belgelenen alanlara dayanıyor.
    const MAGIC = Buffer.from("MKDYEDEK");
    const aadSlot = (t) => Buffer.concat([MAGIC, Buffer.from([0, 1]), Buffer.from(`slot:${t}`)]);
    const kdf = (secret, k) =>
      scryptSync(secret, Buffer.from(k.salt, "base64"), 32, { N: k.N, r: k.r, p: k.p, maxmem: 512 * 1024 * 1024 });
    function specDecrypt(path, password) {
      const b = readFileSync(path);
      const hl = b.readUInt32BE(10);
      const prefix = b.subarray(0, 14 + hl);
      const hdr = JSON.parse(b.subarray(14, 14 + hl).toString("utf8"));
      const s = hdr.slots.find((x) => x.type === "password");
      const d = createDecipheriv("aes-256-gcm", kdf(Buffer.from(password.normalize("NFC")), s.kdf), Buffer.from(s.nonce, "base64"));
      d.setAAD(aadSlot("password"));
      d.setAuthTag(Buffer.from(s.tag, "base64"));
      const dek = Buffer.concat([d.update(Buffer.from(s.wrappedKey, "base64")), d.final()]);
      const p = createDecipheriv("aes-256-gcm", dek, Buffer.from(hdr.nonce, "base64"));
      p.setAAD(prefix);
      p.setAuthTag(b.subarray(b.length - 16));
      return Buffer.concat([p.update(b.subarray(14 + hl, b.length - 16)), p.final()]);
    }
    assert(specDecrypt(enc3, PASSWORD).equals(readFileSync(plain3)), "(test) örnek dosya bağımsız spesifikasyon okuyucusuyla açılıyor");

    function specEncrypt(plainBuf, password, recoveryRaw) {
      const dek = randomBytes(32);
      const wrap = (type, secret, params) => {
        const salt = randomBytes(16);
        const nonce = randomBytes(12);
        const k = { name: "scrypt", ...params, salt: salt.toString("base64") };
        const c = createCipheriv("aes-256-gcm", kdf(secret, k), nonce);
        c.setAAD(aadSlot(type));
        const w = Buffer.concat([c.update(dek), c.final()]);
        return { type, kdf: k, nonce: nonce.toString("base64"), wrappedKey: w.toString("base64"), tag: c.getAuthTag().toString("base64") };
      };
      const nonce = randomBytes(12);
      const hdr = {
        format: "muvekkil-kasa-yedek",
        cipher: "aes-256-gcm",
        content: "sqlite",
        createdAt: "2026-01-01T00:00:00.000Z",
        nonce: nonce.toString("base64"),
        slots: [wrap("password", Buffer.from(password.normalize("NFC")), { N: 2 ** 14, r: 8, p: 1 }), wrap("recovery", recoveryRaw, { N: 2 ** 14, r: 8, p: 1 })],
      };
      const hb = Buffer.from(JSON.stringify(hdr));
      const fixed = Buffer.alloc(14);
      MAGIC.copy(fixed);
      fixed.writeUInt16BE(1, 8);
      fixed.writeUInt32BE(hb.length, 10);
      const prefix = Buffer.concat([fixed, hb]);
      const c = createCipheriv("aes-256-gcm", dek, nonce);
      c.setAAD(prefix);
      return Buffer.concat([prefix, c.update(plainBuf), c.final(), c.getAuthTag()]);
    }
    const rraw = randomBytes(20);
    const specFile = join(d3, "spec.mkyedek");
    writeFileSync(specFile, specEncrypt(readFileSync(plain3), PASSWORD, rraw));
    const specOut = join(d3, "spec-out.sqlite");
    decryptBackupFile(specFile, specOut, { kind: "recovery", value: formatRecoveryKey(rraw) });
    assert(sha(specOut) === sha(plain3), "bağımsız spesifikasyon yazıcısının dosyası modülle açılıyor");
  }

  // ── 6) createPlainBackup ────────────────────────────────
  console.log("\n6) Şifresiz manuel yedek: anlık görüntü, atomik yerleştirme, temizlik");
  {
    const c = setupCase();
    const dest = join(c.dir, "Belgeler", "muvekkil-kasa-yedek-20261011.sqlite");
    mkdirSync(dirname(dest), { recursive: true });
    const db0 = c.live.getDb();
    addUser(db0, "wal_icindeki_kullanici");
    const liveHashBefore = JSON.stringify([users(db0), license(db0)]);
    await createPlainBackup({ db: c.live.getDb(), destPath: dest });
    assert(existsSync(dest), "yedek dosyası oluştu");
    assert(readFileSync(dest).subarray(0, 16).toString("latin1") === "SQLite format 3\0", "düz SQLite biçiminde");
    assert(!isEncryptedBackupFile(dest), "şifreli yedek biçiminde değil");
    assert(readdirSync(dirname(dest)).length === 1, "hedef klasörde .part / -journal artığı yok");
    const chk = new Database(dest, { readonly: true });
    assert(
      JSON.stringify(users(chk)) === JSON.stringify(["canli_kullanici", "wal_icindeki_kullanici"]),
      "yedek canlı verinin tutarlı kopyası (WAL'deki son kayıt dahil)",
    );
    assert(chk.pragma("integrity_check", { simple: true }) === "ok", "yedek sağlam");
    assert(chk.pragma("journal_mode", { simple: true }) === "delete", "yedek tek dosyalık (WAL kipinde değil)");
    chk.close();
    assert(readdirSync(dirname(dest)).length === 1, "yedek açıldıktan sonra yanında -wal/-shm oluşmadı");
    const db = c.live.getDb();
    assert(JSON.stringify([users(db), license(db)]) === liveHashBefore, "canlı veritabanı değişmedi");

    const c2 = setupCase();
    const licBefore = license(c2.live.getDb());
    const r = run(c2, dest, undefined);
    assert(r.ok === true, "yeni yedek parola sorulmadan geri yüklenir");
    assert(users(c2.live.getDb()).includes("wal_icindeki_kullanici"), "geri yüklenen veri yedektekiyle aynı");
    assert(JSON.stringify(license(c2.live.getDb())) === JSON.stringify(licBefore), "geri yüklemede bu cihazın lisansı korunur");

    writeFileSync(dest, "ESKI-DOSYA");
    const closed = new Database(join(c.dir, "kapali.sqlite"));
    closed.close();
    let threw = false;
    try {
      await createPlainBackup({ db: closed, destPath: dest });
    } catch {
      threw = true;
    }
    assert(threw, "başarısız yedek hata döndürür");
    assert(readFileSync(dest, "utf8") === "ESKI-DOSYA", "başarısız yedekte mevcut hedef dosya korunur");
    assert(readdirSync(dirname(dest)).length === 1, "başarısız yedekte .part artığı yok");

    threw = false;
    try {
      await createPlainBackup({ db: c.live.getDb(), destPath: join(c.dir, "olmayan-klasor", "x.sqlite") });
    } catch {
      threw = true;
    }
    assert(threw && !existsSync(join(c.dir, "olmayan-klasor")), "yazılamayan hedefte hata, artık dosya yok");

    const leftover = join(c.userDataDir, BACKUP_WORK_DIR_NAME, "eski-surum-artigi");
    mkdirSync(leftover, { recursive: true });
    writeFileSync(join(leftover, "snapshot.sqlite"), "x");
    cleanupBackupWorkspace(c.userDataDir);
    assert(!existsSync(join(c.userDataDir, BACKUP_WORK_DIR_NAME)), "önceki sürümün geçici yedek alanı açılışta temizlenir");
  }

  // ── 7) Geri yükleme entegrasyonu (Aşama 1 kuralları) ────
  console.log("\n7) Şifreli yedekten geri yükleme");
  function run(c, srcPath, secret, depsOverride = {}) {
    const before = sha(srcPath);
    const r = quiet(() => restoreFromBackupFile(srcPath, { ...c.deps, ...depsOverride }, secret));
    assert(sha(srcPath) === before, "seçilen yedek dosyası değiştirilmedi");
    return r;
  }
  function assertUntouched(c, licBefore) {
    assert(c.live.isOpen(), "canlı veritabanı açık");
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["canli_kullanici"]), "canlı veriler değişmedi");
    assert(JSON.stringify(license(db)) === JSON.stringify(licBefore), "canlı lisans değişmedi");
    assert(autoBackups(c).length === 0, "'oncesi' yedeği oluşturulmadı");
    assert(dirEmpty(join(c.userDataDir, RESTORE_WORK_DIR_NAME)), "geçici çalışma alanı temiz (çözülmüş veri kalmadı)");
  }

  {
    console.log("  7a) parola ile, eski şema + başka cihazın lisansı");
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const b = await makeEncryptedBackup(c.dir, upTo("010_vekalet_avans_temizlik"), (db) => {
      addUser(db, "yedek_kullanici");
      addLicense(db, "OTHER-KEY", "other-device");
    });
    const r = run(c, b.path, { kind: "password", value: PASSWORD });
    assert(r.ok === true, "geri yükleme başarılı");
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["yedek_kullanici"]), "yedekteki veri yüklendi");
    assert(JSON.stringify(license(db)) === JSON.stringify(licBefore), "bu cihazın lisansı korundu, yedektekisi taşınmadı");
    const applied = db.prepare(`SELECT id FROM schema_migrations`).all().map((x) => x.id);
    assert(ids.every((id) => applied.includes(id)), "migration'lar uygulanmış");
    assert(autoBackups(c).length === 1, "'oncesi' otomatik yedeği alındı");
    assert(dirEmpty(join(c.userDataDir, RESTORE_WORK_DIR_NAME)), "geçici çalışma alanı temiz");
  }

  {
    console.log("  7b) kurtarma anahtarı ile, lisanssız cihaz");
    const c = setupCase({ liveLicense: false });
    const b = await makeEncryptedBackup(c.dir, allMigrations, (db) => {
      addUser(db, "yedek_kullanici");
      addLicense(db, "OTHER-KEY", "other-device");
    });
    const r = run(c, b.path, { kind: "recovery", value: b.recoveryKey });
    assert(r.ok === true, "kurtarma anahtarıyla geri yükleme başarılı");
    assert(license(c.live.getDb()).length === 0, "lisanssız cihaz yedekten lisans kazanmadı");
  }

  async function rejected(title, code, makeSrc, secret, depsOverride) {
    console.log(`  ${title}`);
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const p = await makeSrc(c);
    const r = run(c, p, secret, depsOverride);
    assert(r.ok === false && r.code === code, `reddedildi: ${code} (gelen: ${r.ok ? "ok" : r.code})`);
    assert(r.ok === false && r.error.includes("Mevcut veritabanı değiştirilmedi"), "kullanıcı mesajı");
    assert(r.ok === false && !r.error.includes(PASSWORD), "hata mesajı parolayı içermiyor");
    assertUntouched(c, licBefore);
  }

  await rejected("7c) sır verilmeden", "SECRET_REQUIRED", async (c) => (await makeEncryptedBackup(c.dir, allMigrations)).path, undefined);
  await rejected("7d) yanlış parola", "WRONG_SECRET", async (c) => (await makeEncryptedBackup(c.dir, allMigrations)).path, { kind: "password", value: PASSWORD + "!" });
  await rejected(
    "7e) başka yedeğin kurtarma anahtarı",
    "WRONG_SECRET",
    async (c) => {
      await makeEncryptedBackup(c.dir, allMigrations);
      return (await makeEncryptedBackup(c.dir, allMigrations)).path;
    },
    { kind: "recovery", value: formatRecoveryKey(randomBytes(20)) },
  );
  await rejected(
    "7f) bozuk şifreli yedek",
    "CORRUPT",
    async (c) => {
      const b = await makeEncryptedBackup(c.dir, allMigrations, (db) => addUser(db, "x"));
      const fd = openSync(b.path, "r+");
      writeSync(fd, Buffer.from([0xde, 0xad]), 0, 2, statSync(b.path).size - 200);
      closeSync(fd);
      return b.path;
    },
    { kind: "password", value: PASSWORD },
  );
  await rejected(
    "7g) kesik (yarım indirilmiş) şifreli yedek",
    "CORRUPT",
    async (c) => {
      const b = await makeEncryptedBackup(c.dir, allMigrations);
      truncateSync(b.path, Math.floor(statSync(b.path).size * 0.6));
      return b.path;
    },
    { kind: "password", value: PASSWORD },
  );
  await rejected(
    "7h) şifreli ama içi SQLite değil",
    "CORRUPT",
    async (c) => {
      const p = join(c.dir, "metin.txt");
      writeFileSync(p, "SQLite olmayan içerik ".repeat(100));
      const out = join(c.dir, "metin.mkyedek");
      encryptBackupFile(p, out, PASSWORD);
      return out;
    },
    { kind: "password", value: PASSWORD },
  );
  await rejected(
    "7i) şifreli başka uygulama veritabanı",
    "NOT_APP_BACKUP",
    async (c) => {
      const p = join(c.dir, "baska.sqlite");
      const db = new Database(p);
      db.exec("CREATE TABLE foo (id INTEGER)");
      db.close();
      const out = join(c.dir, "baska.mkyedek");
      encryptBackupFile(p, out, PASSWORD);
      return out;
    },
    { kind: "password", value: PASSWORD },
  );
  await rejected(
    "7j) şifreli, daha yeni sürüm yedeği",
    "NEWER_VERSION",
    async (c) =>
      (await makeEncryptedBackup(c.dir, allMigrations, (db) =>
        db.prepare(`INSERT INTO schema_migrations (id, applied_at) VALUES ('999_gelecek', ?)`).run(nowIso()),
      )).path,
    { kind: "password", value: PASSWORD },
  );
  await rejected(
    "7k) çözme sırasında disk doldu (kesinti)",
    "DISK_FULL",
    async (c) => {
      c.deps.decryptFile = (s, d) => {
        writeFileSync(d, "yarım");
        throw Object.assign(new Error("no space"), { code: "ENOSPC" });
      };
      return (await makeEncryptedBackup(c.dir, allMigrations)).path;
    },
    { kind: "password", value: PASSWORD },
  );

  {
    console.log("  7l) değişimden sonra açılış hatası: rollback");
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const b = await makeEncryptedBackup(c.dir, allMigrations, (db) => addUser(db, "yedek_kullanici"));
    let n = 0;
    const r = run(c, b.path, { kind: "password", value: PASSWORD }, {
      getDb: () => {
        n++;
        if (n === 2) throw new Error("test: açılamadı");
        return c.live.getDb();
      },
    });
    assert(r.ok === false && r.code === "ROLLED_BACK", `geri alındı (gelen: ${r.ok ? "ok" : r.code})`);
    const db = c.live.getDb();
    assert(JSON.stringify(users(db)) === JSON.stringify(["canli_kullanici"]), "önceki veriler geri geldi");
    assert(JSON.stringify(license(db)) === JSON.stringify(licBefore), "önceki lisans geri geldi");
    assert(dirEmpty(join(c.userDataDir, RESTORE_WORK_DIR_NAME)), "geçici çalışma alanı temiz");
  }

  // ── 8) Eski şifresiz yedek uyumluluğu ───────────────────
  console.log("\n8) Eski şifresiz SQLite yedeği: parola sorulmadan, dosya değişmeden");
  {
    const c = setupCase();
    const licBefore = license(c.live.getDb());
    const old = join(c.dir, "muvekkil-kasa-yedek-20250101.sqlite");
    makeDbFile(old, upTo("007_ofis_kasa_duzeltme_alanlari"), (db) => addUser(db, "eski_kullanici"));
    const r = run(c, old, undefined);
    assert(r.ok === true, "sırsız geri yükleme başarılı");
    assert(JSON.stringify(users(c.live.getDb())) === JSON.stringify(["eski_kullanici"]), "eski yedek verisi yüklendi");
    assert(JSON.stringify(license(c.live.getDb())) === JSON.stringify(licBefore), "lisans korundu");
    const c2 = setupCase();
    const old2 = join(c2.dir, "eski.db");
    makeDbFile(old2, allMigrations, (db) => addUser(db, "eski2"));
    const r2 = run(c2, old2, { kind: "password", value: "gereksiz" });
    assert(r2.ok === true, "şifresiz yedekte gereksiz parola yok sayılır");
  }
} finally {
  console.error = realConsoleError;
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız`);
process.exit(failed ? 1 : 0);
