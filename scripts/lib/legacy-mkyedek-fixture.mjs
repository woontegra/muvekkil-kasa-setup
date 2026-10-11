/**
 * Yalnızca testler için: önceki sürümlerin oluşturduğu şifreli manuel yedek (.mkyedek, biçim sürümü 1) dosyalarını üretir.
 * Program artık şifreli yedek oluşturmaz; geri yükleme tarafının eski dosyaları açabildiği bu örneklerle doğrulanır.
 * Biçim: "MKDYEDEK" | u16 sürüm | u32 başlık uzunluğu | başlık JSON | AES-256-GCM şifreli SQLite | 16 bayt etiket.
 */
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = Buffer.from("MKDYEDEK", "ascii");
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Önceki sürümün varsayılan scrypt parametreleri. */
export const LEGACY_PASSWORD_SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
export const LEGACY_RECOVERY_SCRYPT = { N: 2 ** 15, r: 8, p: 1 };

export function formatRecoveryKey(bytes) {
  if (bytes.length !== 20) throw new Error("recovery key length");
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += RECOVERY_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return out.match(/.{4}/g).join("-");
}

function wrap(dek, type, secret, params) {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const kek = scryptSync(secret, salt, 32, { ...params, maxmem: 256 * params.N * params.r + 16 * 1024 * 1024 });
  const c = createCipheriv("aes-256-gcm", kek, nonce, { authTagLength: 16 });
  c.setAAD(Buffer.concat([MAGIC, Buffer.from([0, 1]), Buffer.from(`slot:${type}`, "ascii")]));
  const wrapped = Buffer.concat([c.update(dek), c.final()]);
  return {
    type,
    kdf: { name: "scrypt", ...params, salt: salt.toString("base64") },
    nonce: nonce.toString("base64"),
    wrappedKey: wrapped.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  };
}

/** plainPath'teki dosyayı eski şifreli yedek biçiminde outPath'e yazar; kurtarma anahtarını döndürür. */
export function writeLegacyEncryptedBackup(plainPath, outPath, password, opts = {}) {
  const recoveryRaw = opts.recoveryRaw ?? randomBytes(20);
  const dek = randomBytes(32);
  const nonce = randomBytes(12);
  const header = {
    format: "muvekkil-kasa-yedek",
    cipher: "aes-256-gcm",
    content: "sqlite",
    createdAt: opts.createdAt ?? new Date().toISOString(),
    appVersion: "0.1.14",
    nonce: nonce.toString("base64"),
    slots: [
      wrap(dek, "password", Buffer.from(password.normalize("NFC"), "utf8"), opts.passwordScrypt ?? LEGACY_PASSWORD_SCRYPT),
      wrap(dek, "recovery", Buffer.from(recoveryRaw), opts.recoveryScrypt ?? LEGACY_RECOVERY_SCRYPT),
    ],
  };
  const headerBuf = Buffer.from(JSON.stringify(header), "utf8");
  const fixed = Buffer.alloc(14);
  MAGIC.copy(fixed, 0);
  fixed.writeUInt16BE(1, 8);
  fixed.writeUInt32BE(headerBuf.length, 10);
  const prefix = Buffer.concat([fixed, headerBuf]);
  const c = createCipheriv("aes-256-gcm", dek, nonce, { authTagLength: 16 });
  c.setAAD(prefix);
  writeFileSync(outPath, Buffer.concat([prefix, c.update(readFileSync(plainPath)), c.final(), c.getAuthTag()]), {
    mode: 0o600,
    flag: "wx",
  });
  return { recoveryKey: formatRecoveryKey(recoveryRaw) };
}
