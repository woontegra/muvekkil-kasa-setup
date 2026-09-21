import bcrypt from "bcryptjs";
import { getDb, nowIso } from "../db/connection";
import { OFIS_KASA_KAYNAK_VEKALET_TAHSILATI } from "@shared/constants/ofisKasa";
import type { GuvenliSilInput, GuvenliSilSonuc } from "@shared/types/guvenliSil";
import { authGetSession } from "./auth.service";
import { writeAuditLog } from "./auditLog.service";
import { guvenliSilVekaletTahsilat } from "./vekaletGuvenliIptal.service";

import type { OfisGuvenliSilMode } from "@shared/lib/guvenliSil";

export type { OfisGuvenliSilMode };

function formatTrDateTime(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function verifyActorPassword(userId: number, sifre: string): { ok: true } | { ok: false; error: string } {
  const r = getDb()
    .prepare(`SELECT sifre_hash, COALESCE(rol, 'BURO_SAHIBI') AS rol, aktif_mi FROM uygulama_kullanici WHERE id = ?`)
    .get(userId) as { sifre_hash: string; rol: string; aktif_mi: number } | undefined;
  if (!r || !Number(r.aktif_mi)) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (r.rol !== "BURO_SAHIBI") {
    return { ok: false, error: "Bu işlem yalnızca büro sahibi tarafından yapılabilir." };
  }
  if (!sifre) return { ok: false, error: "Şifre zorunludur." };
  if (!bcrypt.compareSync(sifre, r.sifre_hash)) {
    writeAuditLog({
      kullaniciId: userId,
      eylem: "OFIS_HAREKET_SIL_PASSWORD_FAILED",
      varlikTipi: "ofis_kasa_hareketleri",
      ozet: "Güvenli sil — hatalı şifre",
    });
    return { ok: false, error: "Şifre yanlış, işlem yapılmadı" };
  }
  return { ok: true };
}

export function softDeleteOfisHareketAndDuzeltmeler(
  d: ReturnType<typeof getDb>,
  opts: {
    hareketId: number;
    actorId: number;
    reason: string;
    t: string;
    expectedTip: "GELIR" | "GIDER";
  },
): number[] {
  const primary = d
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
       WHERE id = ? AND islem_tipi = ? AND onay_durumu = 'ONAYLI' AND silinme_tarihi IS NULL`,
    )
    .run(opts.t, opts.actorId, opts.reason, opts.t, opts.hareketId, opts.expectedTip);
  if (Number(primary.changes ?? 0) !== 1) return [];

  const related = d
    .prepare(
      `SELECT id FROM ofis_kasa_hareketleri
       WHERE islem_tipi = 'DUZELTME' AND orijinal_hareket_id = ? AND silinme_tarihi IS NULL`,
    )
    .all(opts.hareketId) as { id: number }[];
  const relatedIds = related.map((r) => r.id);
  if (relatedIds.length > 0) {
    const ph = relatedIds.map(() => "?").join(",");
    d.prepare(
      `UPDATE ofis_kasa_hareketleri SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
       WHERE id IN (${ph}) AND silinme_tarihi IS NULL`,
    ).run(opts.t, opts.actorId, opts.reason, opts.t, ...relatedIds);
  }
  return [opts.hareketId, ...relatedIds];
}

const BAGLI_TAHSILAT_KAYNAK_YOK =
  "Bu gelir bağlı bir tahsilattan oluştuğu için kaynak ödeme doğrulanmadan silinemez.";

/** Ofis geliri → vekalet ödemesi; kaynak_id bozuksa ters bağlantıdan çözülür. */
function vekaletOdemeIdFromOfisHareket(
  d: ReturnType<typeof getDb>,
  hareketId: number,
  kaynakId: unknown,
): number | null {
  const byKaynak = kaynakId == null ? null : Number(kaynakId);
  if (byKaynak != null && Number.isFinite(byKaynak) && byKaynak > 0) {
    const row = d.prepare(`SELECT id FROM vekalet_taksit_odeme WHERE id = ?`).get(byKaynak) as { id: number } | undefined;
    if (row) return Number(row.id);
  }
  const byLink = d
    .prepare(`SELECT id FROM vekalet_taksit_odeme WHERE ofis_kasa_hareket_id = ?`)
    .get(hareketId) as { id: number } | undefined;
  return byLink ? Number(byLink.id) : null;
}

export function guvenliOfisHareketSil(hareketId: number, body: GuvenliSilInput): GuvenliSilSonuc & { mode?: OfisGuvenliSilMode } {
  const session = authGetSession();
  if (!session) return { ok: false, error: "Oturum gerekli." };

  const reason = (body.silmeNedeni ?? "").trim();
  if (reason.length < 3) return { ok: false, error: "Silme / iptal nedeni zorunludur (en az 3 karakter)." };
  if (reason.length > 1000) return { ok: false, error: "Neden en fazla 1000 karakter olabilir." };

  const pw = verifyActorPassword(session.id, body.sifre ?? "");
  if (!pw.ok) return pw;

  const d = getDb();
  const row = d
    .prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE id = ? AND silinme_tarihi IS NULL`)
    .get(hareketId) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: "Kasa hareketi bulunamadı." };
  if (String(row.onay_durumu ?? "") !== "ONAYLI") {
    return { ok: false, error: "Güvenli sil yalnızca onaylı işlemler için kullanılabilir." };
  }

  const islemTipi = String(row.islem_tipi ?? "");
  const kaynakTipi = row.kaynak_tipi == null ? null : String(row.kaynak_tipi).trim() || null;
  const kaynakId = row.kaynak_id;

  if (islemTipi === "GIDER") {
    const t = nowIso();
    const actorName = session.adSoyad?.trim() || session.kullaniciAdi || "Büro sahibi";
    const auditMessage = `Masraf, ${actorName} tarafından ${formatTrDateTime(t)} tarihinde silindi. Neden: ${reason}`;
    const softDeletedIds = d.transaction(() =>
      softDeleteOfisHareketAndDuzeltmeler(d, {
        hareketId,
        actorId: session.id,
        reason,
        t,
        expectedTip: "GIDER",
      }),
    )();
    if (softDeletedIds.length === 0) {
      return { ok: false, error: "Kayıt zaten silinmiş veya eşzamanlı işlem çakıştı." };
    }
    writeAuditLog({
      kullaniciId: session.id,
      kullaniciAdi: actorName,
      eylem: "OFIS_KASA_GIDER_SOFT_DELETED",
      varlikTipi: "ofis_kasa_hareketleri",
      varlikId: String(hareketId),
      ozet: auditMessage,
      detay: { silinmeTarihi: t, softDeletedIds, silmeNedeni: reason, message: auditMessage },
    });
    return { ok: true, softDeletedIds, auditMessage, mode: "GIDER_SIL" };
  }

  if (islemTipi === "GELIR") {
    if (kaynakTipi === OFIS_KASA_KAYNAK_VEKALET_TAHSILATI) {
      const odemeId = vekaletOdemeIdFromOfisHareket(d, hareketId, kaynakId);
      if (odemeId == null) {
        return { ok: false, error: BAGLI_TAHSILAT_KAYNAK_YOK };
      }
      // Vekalet paneliyle aynı kaskad: makbuz iptal damgası + bağlı kasa soft-delete.
      const r = guvenliSilVekaletTahsilat(odemeId, body);
      if (!r.ok) return r;
      return {
        ok: true,
        softDeletedIds: r.softDeletedIds ?? [],
        auditMessage: r.auditMessage,
        mode: "TAHSILAT_IPTAL",
      };
    }
    if (kaynakTipi || kaynakId != null) {
      return {
        ok: false,
        error: "Bağlı tahsilat gelirleri bu sürümde güvenli sil ile kaldırılamaz.",
      };
    }
    const t = nowIso();
    const actorName = session.adSoyad?.trim() || session.kullaniciAdi || "Büro sahibi";
    const auditMessage = `${actorName}, ${formatTrDateTime(t)} tarihinde ofis gelirini sildi. Neden: ${reason}`;
    const softDeletedIds = d.transaction(() =>
      softDeleteOfisHareketAndDuzeltmeler(d, {
        hareketId,
        actorId: session.id,
        reason,
        t,
        expectedTip: "GELIR",
      }),
    )();
    if (softDeletedIds.length === 0) {
      return { ok: false, error: "Kayıt zaten silinmiş veya eşzamanlı işlem çakıştı." };
    }
    writeAuditLog({
      kullaniciId: session.id,
      kullaniciAdi: actorName,
      eylem: "OFIS_KASA_GELIR_SOFT_DELETED",
      varlikTipi: "ofis_kasa_hareketleri",
      varlikId: String(hareketId),
      ozet: auditMessage,
      detay: { silinmeTarihi: t, softDeletedIds, silmeNedeni: reason, message: auditMessage },
    });
    return { ok: true, softDeletedIds, auditMessage, mode: "GELIR_SIL" };
  }

  return { ok: false, error: "Bu uç ile yalnızca onaylı gider veya manuel gelir silinebilir." };
}
