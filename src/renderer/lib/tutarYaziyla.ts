const ones = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const tens = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];

function belowThousand(n: number): string {
  if (n === 0) return "";
  const y = Math.floor(n / 100);
  const o = Math.floor((n % 100) / 10);
  const b = n % 10;
  const parts: string[] = [];
  if (y > 0) parts.push(y === 1 ? "yüz" : `${ones[y]} yüz`);
  if (o > 0) parts.push(tens[o]);
  if (b > 0) parts.push(ones[b]);
  return parts.join(" ");
}

function tamSayiTurkce(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "sıfır";
  if (n < 0) return `eksi ${tamSayiTurkce(-n)}`;
  let x = Math.floor(n);
  const chunks: string[] = [];
  const milyar = Math.floor(x / 1e9);
  if (milyar > 0) {
    chunks.push(milyar === 1 ? "bir milyar" : `${belowThousand(milyar)} milyar`.trim());
    x %= 1e9;
  }
  const milyon = Math.floor(x / 1e6);
  if (milyon > 0) {
    chunks.push(milyon === 1 ? "bir milyon" : `${belowThousand(milyon)} milyon`.trim());
    x %= 1e6;
  }
  const bin = Math.floor(x / 1e3);
  if (bin > 0) {
    chunks.push(bin === 1 ? "bin" : `${belowThousand(bin)} bin`.trim());
    x %= 1e3;
  }
  if (x > 0) chunks.push(belowThousand(x));
  return chunks.join(" ").replace(/\s+/g, " ").trim() || "sıfır";
}

export function tutarYaziylaTry(tutar: number): string {
  const lira = Math.round(Math.abs(tutar));
  return `Yalnız: ${tamSayiTurkce(lira)} Türk lirası`;
}
