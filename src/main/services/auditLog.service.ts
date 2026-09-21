import { getDb, nowIso } from "../db/connection";

export type AuditLogInput = {
  kullaniciId?: number | null;
  kullaniciAdi?: string | null;
  eylem: string;
  varlikTipi?: string | null;
  varlikId?: string | null;
  ozet?: string | null;
  detay?: unknown;
};

export type AuditLogRow = {
  id: number;
  olusturmaTarihi: string;
  kullaniciId: number | null;
  kullaniciAdi: string | null;
  eylem: string;
  varlikTipi: string | null;
  varlikId: string | null;
  ozet: string | null;
  detayJson: string | null;
};

export function writeAuditLog(input: AuditLogInput): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (olusturma_tarihi, kullanici_id, kullanici_adi, eylem, varlik_tipi, varlik_id, ozet, detay_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        nowIso(),
        input.kullaniciId ?? null,
        input.kullaniciAdi ?? null,
        input.eylem,
        input.varlikTipi ?? null,
        input.varlikId ?? null,
        input.ozet ?? null,
        input.detay != null ? JSON.stringify(input.detay) : null,
      );
  } catch {
    /* migration öncesi / test — sessiz */
  }
}

export function listAuditLog(opts?: {
  limit?: number;
  offset?: number;
}): { rows: AuditLogRow[]; total: number } {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const d = getDb();
  const total = (d.prepare(`SELECT COUNT(*) AS c FROM audit_log`).get() as { c: number }).c;
  const rows = d
    .prepare(
      `SELECT id, olusturma_tarihi, kullanici_id, kullanici_adi, eylem, varlik_tipi, varlik_id, ozet, detay_json
       FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as {
    id: number;
    olusturma_tarihi: string;
    kullanici_id: number | null;
    kullanici_adi: string | null;
    eylem: string;
    varlik_tipi: string | null;
    varlik_id: string | null;
    ozet: string | null;
    detay_json: string | null;
  }[];
  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      olusturmaTarihi: r.olusturma_tarihi,
      kullaniciId: r.kullanici_id,
      kullaniciAdi: r.kullanici_adi,
      eylem: r.eylem,
      varlikTipi: r.varlik_tipi,
      varlikId: r.varlik_id,
      ozet: r.ozet,
      detayJson: r.detay_json,
    })),
  };
}
