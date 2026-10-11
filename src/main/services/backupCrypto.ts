import { createDecipheriv, scryptSync } from "node:crypto";
import { closeSync, fstatSync, fsyncSync, openSync, readSync, writeSync } from "node:fs";
import { normalizeBackupPassword, parseRecoveryKey } from "@shared/backupPassword";

/**
 * Önceki sürümlerin oluşturduğu şifreli manuel yedekleri (.mkyedek) okur; yeni şifreli yedek oluşturulmaz.
 * Biçim (platformdan bağımsız, tüm sayılar big-endian):
 *   "MKDYEDEK" | u16 sürüm | u32 başlık uzunluğu | başlık JSON (UTF-8) | şifreli SQLite | 16 bayt GCM etiketi
 * Veri anahtarı (DEK) parola ve kurtarma anahtarından scrypt ile türetilen anahtarlarla ayrı ayrı
 * AES-256-GCM ile sarılmıştır. Önek (sihirli değer + başlık) veri şifrelemesinin AAD'sidir.
 */
export const ENCRYPTED_BACKUP_EXTENSION = "mkyedek";
const MAGIC = Buffer.from("MKDYEDEK", "ascii");
const FORMAT_VERSION = 1;
const FIXED_PREFIX = MAGIC.length + 2 + 4;
const MAX_HEADER_BYTES = 64 * 1024;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const SALT_BYTES = 16;
const CHUNK_BYTES = 1024 * 1024;

type ScryptParams = { N: number; r: number; p: number };

type SlotType = "password" | "recovery";

type Slot = {
  type: SlotType;
  kdf: { name: "scrypt"; N: number; r: number; p: number; salt: string };
  nonce: string;
  wrappedKey: string;
  tag: string;
};

export type EncryptedBackupHeader = {
  format: "muvekkil-kasa-yedek";
  cipher: "aes-256-gcm";
  content: "sqlite";
  createdAt: string;
  appVersion?: string;
  nonce: string;
  slots: Slot[];
};

export type BackupSecret = { kind: "password"; value: string } | { kind: "recovery"; value: string };

export type BackupCryptoErrorCode = "NOT_ENCRYPTED" | "CORRUPT" | "UNSUPPORTED_VERSION" | "WRONG_SECRET";

export class BackupCryptoError extends Error {
  constructor(
    public readonly code: BackupCryptoErrorCode,
    public readonly detail?: unknown,
  ) {
    super(code);
    this.name = "BackupCryptoError";
  }
}

function b64(buf: Buffer): string {
  return buf.toString("base64");
}

function unb64(value: unknown, expectedLen: number): Buffer {
  if (typeof value !== "string") throw new BackupCryptoError("CORRUPT");
  const buf = Buffer.from(value, "base64");
  if (buf.length !== expectedLen || b64(buf) !== value) throw new BackupCryptoError("CORRUPT");
  return buf;
}

function assertScryptParams(p: { N: unknown; r: unknown; p: unknown }): ScryptParams {
  const { N, r } = p;
  const par = p.p;
  const pow2 = typeof N === "number" && Number.isInteger(N) && N >= 2 ** 14 && N <= 2 ** 20 && (N & (N - 1)) === 0;
  const rOk = typeof r === "number" && Number.isInteger(r) && r >= 1 && r <= 16;
  const pOk = typeof par === "number" && Number.isInteger(par) && par >= 1 && par <= 4;
  if (!pow2 || !rOk || !pOk) throw new BackupCryptoError("CORRUPT");
  return { N: N as number, r: r as number, p: par as number };
}

function deriveKek(secret: Buffer, salt: Buffer, params: ScryptParams): Buffer {
  return scryptSync(secret, salt, KEY_BYTES, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 256 * params.N * params.r + 16 * 1024 * 1024,
  });
}

function slotAad(type: SlotType): Buffer {
  return Buffer.concat([MAGIC, Buffer.from([0, FORMAT_VERSION]), Buffer.from(`slot:${type}`, "ascii")]);
}

function secretBytes(type: SlotType, value: string): Buffer | null {
  if (type === "password") {
    if (typeof value !== "string" || value.length === 0) return null;
    return Buffer.from(normalizeBackupPassword(value), "utf8");
  }
  const parsed = parseRecoveryKey(value);
  return parsed ? Buffer.from(parsed) : null;
}

function unwrapKey(slot: Slot, secret: Buffer): Buffer {
  const params = assertScryptParams(slot.kdf ?? {});
  if (slot.kdf.name !== "scrypt") throw new BackupCryptoError("CORRUPT");
  const salt = unb64(slot.kdf.salt, SALT_BYTES);
  const nonce = unb64(slot.nonce, NONCE_BYTES);
  const wrapped = unb64(slot.wrappedKey, KEY_BYTES);
  const tag = unb64(slot.tag, TAG_BYTES);
  const kek = deriveKek(secret, salt, params);
  try {
    const d = createDecipheriv("aes-256-gcm", kek, nonce, { authTagLength: TAG_BYTES });
    d.setAAD(slotAad(slot.type));
    d.setAuthTag(tag);
    return Buffer.concat([d.update(wrapped), d.final()]);
  } catch {
    throw new BackupCryptoError("WRONG_SECRET");
  } finally {
    kek.fill(0);
  }
}

function readExact(fd: number, buf: Buffer, position: number): void {
  let off = 0;
  while (off < buf.length) {
    const n = readSync(fd, buf, off, buf.length - off, position + off);
    if (n === 0) throw new BackupCryptoError("CORRUPT");
    off += n;
  }
}

function writeAll(fd: number, buf: Buffer): void {
  let off = 0;
  while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off);
}

/** Dosya şifreli yedek biçiminde mi (yalnızca sihirli değere bakar). */
export function isEncryptedBackupFile(path: string): boolean {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(MAGIC.length);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return n === MAGIC.length && buf.equals(MAGIC);
  } finally {
    closeSync(fd);
  }
}

type ParsedFile = { header: EncryptedBackupHeader; prefix: Buffer; cipherLen: number; fileSize: number };

function parseFile(fd: number): ParsedFile {
  const fileSize = fstatSync(fd).size;
  if (fileSize < FIXED_PREFIX + TAG_BYTES) throw new BackupCryptoError("CORRUPT");
  const fixed = Buffer.alloc(FIXED_PREFIX);
  readExact(fd, fixed, 0);
  if (!fixed.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupCryptoError("NOT_ENCRYPTED");
  const version = fixed.readUInt16BE(MAGIC.length);
  if (version !== FORMAT_VERSION) throw new BackupCryptoError("UNSUPPORTED_VERSION");
  const headerLen = fixed.readUInt32BE(MAGIC.length + 2);
  if (headerLen === 0 || headerLen > MAX_HEADER_BYTES || FIXED_PREFIX + headerLen + TAG_BYTES > fileSize) {
    throw new BackupCryptoError("CORRUPT");
  }
  const headerBuf = Buffer.alloc(headerLen);
  readExact(fd, headerBuf, FIXED_PREFIX);
  let header: EncryptedBackupHeader;
  try {
    header = JSON.parse(headerBuf.toString("utf8")) as EncryptedBackupHeader;
  } catch (e) {
    throw new BackupCryptoError("CORRUPT", e);
  }
  if (
    !header ||
    header.format !== "muvekkil-kasa-yedek" ||
    header.cipher !== "aes-256-gcm" ||
    !Array.isArray(header.slots) ||
    header.slots.length === 0 ||
    header.slots.length > 8
  ) {
    throw new BackupCryptoError("CORRUPT");
  }
  return {
    header,
    prefix: Buffer.concat([fixed, headerBuf]),
    cipherLen: fileSize - FIXED_PREFIX - headerLen - TAG_BYTES,
    fileSize,
  };
}

export function readEncryptedBackupHeader(path: string): EncryptedBackupHeader {
  const fd = openSync(path, "r");
  try {
    return parseFile(fd).header;
  } finally {
    closeSync(fd);
  }
}

function openWithSecret(fd: number, secret: BackupSecret): { parsed: ParsedFile; dek: Buffer } {
  const parsed = parseFile(fd);
  const bytes = secretBytes(secret.kind, secret.value);
  if (!bytes) throw new BackupCryptoError("WRONG_SECRET");
  try {
    const slots = parsed.header.slots.filter((s) => s && s.type === secret.kind);
    if (slots.length === 0) throw new BackupCryptoError("WRONG_SECRET");
    for (const slot of slots) {
      try {
        return { parsed, dek: unwrapKey(slot, bytes) };
      } catch (e) {
        if (!(e instanceof BackupCryptoError) || e.code !== "WRONG_SECRET") throw e;
      }
    }
    throw new BackupCryptoError("WRONG_SECRET");
  } finally {
    bytes.fill(0);
  }
}

/**
 * Şifreli yedeği doğrulayarak çözer. outPath null ise yalnızca bütünlük doğrulanır.
 * GCM etiketi doğrulanmadan çıkan veri güvenilir değildir: hata durumunda outPath çağıran tarafından silinmelidir.
 */
export function decryptBackupFile(encPath: string, outPath: string | null, secret: BackupSecret): void {
  const inFd = openSync(encPath, "r");
  let dek: Buffer | null = null;
  try {
    const opened = openWithSecret(inFd, secret);
    dek = opened.dek;
    decryptPayload(inFd, opened.parsed, dek, outPath);
  } finally {
    closeSync(inFd);
    dek?.fill(0);
  }
}

function decryptPayload(inFd: number, parsed: ParsedFile, dek: Buffer, outPath: string | null): void {
  let outFd: number | null = null;
  try {
    const nonce = unb64(parsed.header.nonce, NONCE_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", dek, nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(parsed.prefix);
    const tag = Buffer.alloc(TAG_BYTES);
    readExact(inFd, tag, parsed.fileSize - TAG_BYTES);
    decipher.setAuthTag(tag);
    if (outPath !== null) outFd = openSync(outPath, "wx", 0o600);
    const buf = Buffer.alloc(CHUNK_BYTES);
    const start = parsed.prefix.length;
    for (let done = 0; done < parsed.cipherLen; ) {
      const want = Math.min(buf.length, parsed.cipherLen - done);
      readExact(inFd, buf.subarray(0, want), start + done);
      done += want;
      const plain = decipher.update(buf.subarray(0, want));
      if (outFd !== null) writeAll(outFd, plain);
    }
    try {
      const tail = decipher.final();
      if (outFd !== null) writeAll(outFd, tail);
    } catch (e) {
      throw new BackupCryptoError("CORRUPT", e);
    }
    if (outFd !== null) fsyncSync(outFd);
  } finally {
    if (outFd !== null) closeSync(outFd);
  }
}
