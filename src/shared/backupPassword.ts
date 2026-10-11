/** Önceki sürümlerde oluşturulmuş şifreli yedeklerin parola ve kurtarma anahtarı girişi (renderer + main ortak). */

/** Mac ve Windows klavyelerinin farklı Unicode biçimleri aynı anahtarı üretsin. */
export function normalizeBackupPassword(pw: string): string {
  return pw.normalize("NFC");
}

/** Crockford Base32: I, L, O, U yok; okunurken karışan karakterler eşlenir. */
const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RECOVERY_KEY_BYTES = 20;
const RECOVERY_KEY_CHARS = (RECOVERY_KEY_BYTES * 8) / 5;

/** Biçimi tolere ederek (boşluk, tire, satır sonu, küçük harf, O/0, I/L/1) anahtarı baytlara çevirir; geçersizse null. */
export function parseRecoveryKey(input: unknown): Uint8Array | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== RECOVERY_KEY_CHARS) return null;
  const out = new Uint8Array(RECOVERY_KEY_BYTES);
  let bits = 0;
  let value = 0;
  let i = 0;
  for (let c = 0; c < cleaned.length; c++) {
    const v = RECOVERY_ALPHABET.indexOf(cleaned.charAt(c));
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out[i++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return out;
}
