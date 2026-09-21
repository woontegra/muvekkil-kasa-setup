import bcrypt from "bcryptjs";
import { getDb, nowIso } from "../db/connection";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import type { VekaletGuvenliIptalSonuc } from "@shared/types/vekaletGuvenliIptal";
import { authGetSession } from "./auth.service";
import { writeAuditLog } from "./auditLog.service";
import { ODEME_AKTIF_OFIS_SQL } from "@shared/lib/tahsilatOdemeAktif";

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

function verifyActorPassword(userId: number, sifre: string, auditPrefix: string): { ok: true } | { ok: false; error: string } {
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
      eylem: `${auditPrefix}_PASSWORD_FAILED`,
      varlikTipi: "vekalet",
      ozet: "Güvenli iptal — hatalı şifre",
    });
    return { ok: false, error: "Şifre yanlış, işlem yapılmadı" };
  }
  return { ok: true };
}

function validateReason(body: GuvenliSilInput): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = (body.silmeNedeni ?? "").trim();
  if (reason.length < 3) return { ok: false, error: "İptal nedeni zorunludur (en az 3 karakter)." };
  if (reason.length > 1000) return { ok: false, error: "Neden en fazla 1000 karakter olabilir." };
  return { ok: true, reason };
}

/** Vekalet tahsilat gelirleri ONAYSIZ oluşturulur — güvenli iptal onay şartı aramaz. */
function softDeleteVekaletOfisGelir(
  d: ReturnType<typeof getDb>,
  opts: { hareketId: number; actorId: number; reason: string; t: string },
): number[] {
  const primary = d
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
       WHERE id = ? AND islem_tipi = 'GELIR' AND silinme_tarihi IS NULL`,
    )
    .run(opts.t, opts.actorId, opts.reason, opts.t, opts.hareketId);
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

function softDeleteKasaHareket(
  d: ReturnType<typeof getDb>,
  kasaHareketId: number,
  actorId: number,
  reason: string,
  t: string,
): void {
  d.prepare(
    `UPDATE dosya_kasa_hareket SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
     WHERE id = ? AND silinme_tarihi IS NULL`,
  ).run(t, actorId, reason, t, kasaHareketId);
}

function countAktifOdemelerForTaksit(d: ReturnType<typeof getDb>, taksitId: number): number {
  const row = d
    .prepare(
      `SELECT COUNT(*) AS c FROM vekalet_taksit_odeme o
       WHERE o.taksit_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
    .get(taksitId) as { c: number };
  return Number(row.c ?? 0);
}

/** Ödemesiz taksit — odeme_durumu = IPTAL (anlaşılan tutar değişmez). */
export function guvenliSilVekaletTaksiti(taksitId: number, body: GuvenliSilInput): VekaletGuvenliIptalSonuc {
  const session = authGetSession();
  if (!session) return { ok: false, error: "Oturum gerekli." };

  const vr = validateReason(body);
  if (!vr.ok) return vr;

  const pw = verifyActorPassword(session.id, body.sifre ?? "", "VEKALET_TAKSIT_GUVENLI_SIL");
  if (!pw.ok) return pw;

  const d = getDb();
  const taksit = d
    .prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`)
    .get(taksitId) as Record<string, unknown> | undefined;
  if (!taksit) return { ok: false, error: "Taksit bulunamadı." };

  const odemeDurumu = String(taksit.odeme_durumu ?? "AKTIF");
  if (odemeDurumu === "IPTAL") {
    return { ok: true, alreadyDone: true, auditMessage: "Taksit zaten iptal edilmişti." };
  }

  if (countAktifOdemelerForTaksit(d, taksitId) > 0) {
    return {
      ok: false,
      error: "Ödeme kaydı olan taksit silinemez. Önce ilgili tahsilatı güvenli iptal edin.",
    };
  }

  const t = nowIso();
  const actorName = session.adSoyad?.trim() || session.kullaniciAdi || "Büro sahibi";
  const taksitNo = Number(taksit.taksit_no);
  const auditMessage = `${actorName}, ${formatTrDateTime(t)} tarihinde taksit #${taksitNo} satırını iptal etti. Neden: ${vr.reason}`;

  d.prepare(
    `UPDATE vekalet_ucreti_taksit SET odeme_durumu = 'IPTAL', guncelleme_tarihi = ? WHERE id = ? AND COALESCE(odeme_durumu, 'AKTIF') != 'IPTAL'`,
  ).run(t, taksitId);

  writeAuditLog({
    kullaniciId: session.id,
    kullaniciAdi: actorName,
    eylem: "VEKALET_TAKSIT_GUVENLI_IPTAL",
    varlikTipi: "vekalet_ucreti_taksit",
    varlikId: String(taksitId),
    ozet: auditMessage,
    detay: {
      taksitNo,
      silmeNedeni: vr.reason,
      odemeDurumu: "IPTAL",
      message: auditMessage,
    },
  });

  return { ok: true, auditMessage };
}

/** Tahsilat satırı — makbuz iptal + bağlı ofis/dosya kasa soft-delete. */
export function guvenliSilVekaletTahsilat(odemeId: number, body: GuvenliSilInput): VekaletGuvenliIptalSonuc {
  const session = authGetSession();
  if (!session) return { ok: false, error: "Oturum gerekli." };

  const vr = validateReason(body);
  if (!vr.ok) return vr;

  const pw = verifyActorPassword(session.id, body.sifre ?? "", "VEKALET_TAHSILAT_IPTAL");
  if (!pw.ok) return pw;

  const d = getDb();
  const odeme = d
    .prepare(
      `SELECT o.*, t.taksit_no,
        ok.silinme_tarihi AS ofis_silinme_tarihi,
        dk.silinme_tarihi AS kasa_silinme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       LEFT JOIN ofis_kasa_hareketleri ok ON ok.id = o.ofis_kasa_hareket_id
       LEFT JOIN dosya_kasa_hareket dk ON dk.id = o.kasa_hareket_id
       WHERE o.id = ?`,
    )
    .get(odemeId) as Record<string, unknown> | undefined;
  if (!odeme) return { ok: false, error: "Ödeme kaydı bulunamadı." };

  const taksitNo = Number(odeme.taksit_no);
  const t = nowIso();
  const actorName = session.adSoyad?.trim() || session.kullaniciAdi || "Büro sahibi";
  const odemeWasAlreadyIptal =
    String(odeme.makbuz_durumu ?? "AKTIF") === "IPTAL" || odeme.iptal_tarihi != null;

  const softDeletedIds = d.transaction(() => {
    const ofisIds: number[] = [];
    const ofisHareketId = odeme.ofis_kasa_hareket_id == null ? null : Number(odeme.ofis_kasa_hareket_id);
    if (ofisHareketId != null && (odeme.ofis_silinme_tarihi == null || String(odeme.ofis_silinme_tarihi).trim() === "")) {
      ofisIds.push(
        ...softDeleteVekaletOfisGelir(d, {
          hareketId: ofisHareketId,
          actorId: session.id,
          reason: vr.reason,
          t,
        }),
      );
    }

    const kasaHareketId = odeme.kasa_hareket_id == null ? null : Number(odeme.kasa_hareket_id);
    if (kasaHareketId != null && (odeme.kasa_silinme_tarihi == null || String(odeme.kasa_silinme_tarihi).trim() === "")) {
      softDeleteKasaHareket(d, kasaHareketId, session.id, vr.reason, t);
      ofisIds.push(kasaHareketId);
    }

    if (!odemeWasAlreadyIptal) {
      d.prepare(
        `UPDATE vekalet_taksit_odeme SET makbuz_durumu = 'IPTAL', iptal_tarihi = ?, iptal_eden_kullanici_id = ?, iptal_nedeni = ?, guncelleme_tarihi = ?
         WHERE id = ?`,
      ).run(t, session.id, vr.reason, t, odemeId);
      d.prepare(`UPDATE vekalet_ucreti_taksit SET guncelleme_tarihi = ? WHERE id = ?`).run(t, Number(odeme.taksit_id));
    }

    return ofisIds;
  })();

  const alreadyDone = odemeWasAlreadyIptal && softDeletedIds.length === 0;
  const auditMessage = alreadyDone
    ? "Tahsilat zaten iptal edilmişti; bakiye değiştirilmedi."
    : `${actorName}, ${formatTrDateTime(t)} tarihinde taksit #${taksitNo} tahsilatını iptal etti. Neden: ${vr.reason}`;

  writeAuditLog({
    kullaniciId: session.id,
    kullaniciAdi: actorName,
    eylem: alreadyDone ? "VEKALET_TAHSILAT_IPTAL_IDEMPOTENT" : "VEKALET_TAHSILAT_IPTAL",
    varlikTipi: "vekalet_taksit_odeme",
    varlikId: String(odemeId),
    ozet: auditMessage,
    detay: {
      taksitId: Number(odeme.taksit_id),
      taksitNo,
      makbuzNo: odeme.makbuz_no,
      tutar: odeme.tutar,
      silmeNedeni: vr.reason,
      softDeletedIds,
      alreadyDone,
      message: auditMessage,
    },
  });

  return { ok: true, alreadyDone, softDeletedIds, auditMessage };
}
