import bcrypt from "bcryptjs";
import { getDb, nowIso } from "../db/connection";
import type { GuvenliSilInput, GuvenliSilSonuc } from "@shared/types/guvenliSil";
import { authGetSession } from "./auth.service";
import { writeAuditLog } from "./auditLog.service";
import { kasaHareketGet } from "./kasa.service";

const GUVENLI_SILINEBILIR_TIPLER = new Set(["MASRAF", "AVANS_GIRISI"]);

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

function buildMasrafSilindiAuditMessage(actorName: string, at: string, reason: string): string {
  return `Masraf, ${actorName} tarafından ${formatTrDateTime(at)} tarihinde silindi. Neden: ${reason}`;
}

function buildAvansSilindiAuditMessage(actorName: string, at: string, reason: string): string {
  return `Avans, ${actorName} tarafından ${formatTrDateTime(at)} tarihinde silindi. Neden: ${reason}`;
}

function verifyActorPassword(userId: number, sifre: string): { ok: true } | { ok: false; error: string } {
  const r = getDb()
    .prepare(`SELECT sifre_hash, COALESCE(rol, 'BURO_SAHIBI') AS rol, aktif_mi FROM uygulama_kullanici WHERE id = ?`)
    .get(userId) as { sifre_hash: string; rol: string; aktif_mi: number } | undefined;
  if (!r || !Number(r.aktif_mi)) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (r.rol !== "BURO_SAHIBI") {
    return { ok: false, error: "Kasa kaydı silme yalnızca büro sahibi tarafından yapılabilir." };
  }
  if (!sifre) return { ok: false, error: "Şifre zorunludur." };
  if (!bcrypt.compareSync(sifre, r.sifre_hash)) {
    writeAuditLog({
      kullaniciId: userId,
      eylem: "KASA_SIL_PASSWORD_FAILED",
      varlikTipi: "dosya_kasa_hareket",
      ozet: "Güvenli sil — hatalı şifre",
    });
    return { ok: false, error: "Şifre yanlış, kayıt silinmedi" };
  }
  return { ok: true };
}

export function guvenliKasaHareketSil(hareketId: number, body: GuvenliSilInput): GuvenliSilSonuc {
  const session = authGetSession();
  if (!session) return { ok: false, error: "Oturum gerekli." };

  const reason = (body.silmeNedeni ?? "").trim();
  if (reason.length < 3) return { ok: false, error: "Silme nedeni zorunludur (en az 3 karakter)." };
  if (reason.length > 1000) return { ok: false, error: "Silme nedeni en fazla 1000 karakter olabilir." };

  const pw = verifyActorPassword(session.id, body.sifre ?? "");
  if (!pw.ok) return pw;

  const d = getDb();
  const row = d
    .prepare(
      `SELECT * FROM dosya_kasa_hareket WHERE id = ? AND silinme_tarihi IS NULL`,
    )
    .get(hareketId) as Record<string, unknown> | undefined;
  if (!row) return { ok: false, error: "Kasa kaydı bulunamadı." };

  const tip = String(row.islem_tipi ?? "");
  if (!GUVENLI_SILINEBILIR_TIPLER.has(tip)) {
    return { ok: false, error: "Yalnızca onaylı avans ve masraf kayıtları güvenli sil ile kaldırılabilir." };
  }
  if (String(row.onay_durumu ?? "") !== "ONAYLI") {
    return { ok: false, error: "Güvenli sil yalnızca onaylı işlemler için kullanılabilir." };
  }

  const t = nowIso();
  const actorName = session.adSoyad?.trim() || session.kullaniciAdi || "Büro sahibi";
  const auditMessage =
    tip === "AVANS_GIRISI"
      ? buildAvansSilindiAuditMessage(actorName, t, reason)
      : buildMasrafSilindiAuditMessage(actorName, t, reason);

  const softDeletedIds = d.transaction(() => {
    const primary = d
      .prepare(
        `UPDATE dosya_kasa_hareket SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
         WHERE id = ? AND islem_tipi = ? AND onay_durumu = 'ONAYLI' AND silinme_tarihi IS NULL`,
      )
      .run(t, session.id, reason, t, hareketId, tip);
    if (Number(primary.changes ?? 0) !== 1) {
      throw new Error("CONFLICT");
    }

    const related = d
      .prepare(
        `SELECT id FROM dosya_kasa_hareket
         WHERE islem_tipi = 'DUZELTME' AND duzeltilen_islem_id = ? AND silinme_tarihi IS NULL`,
      )
      .all(hareketId) as { id: number }[];
    const relatedIds = related.map((r) => r.id);
    if (relatedIds.length > 0) {
      const ph = relatedIds.map(() => "?").join(",");
      d.prepare(
        `UPDATE dosya_kasa_hareket SET silinme_tarihi = ?, silen_kullanici_id = ?, silme_nedeni = ?, guncelleme_tarihi = ?
         WHERE id IN (${ph}) AND silinme_tarihi IS NULL`,
      ).run(t, session.id, reason, t, ...relatedIds);
    }
    return [hareketId, ...relatedIds];
  })();

  const auditAction = tip === "AVANS_GIRISI" ? "KASA_AVANS_SOFT_DELETED" : "KASA_MASRAF_SOFT_DELETED";
  const cur = kasaHareketGet(hareketId);
  writeAuditLog({
    kullaniciId: session.id,
    kullaniciAdi: actorName,
    eylem: auditAction,
    varlikTipi: "dosya_kasa_hareket",
    varlikId: String(hareketId),
    ozet: auditMessage,
    detay: {
      silinmeTarihi: t,
      silenKullaniciId: session.id,
      silmeNedeni: reason,
      softDeletedIds,
      islemTipi: tip,
      belgeNo: cur?.belgeNo ?? row.belge_no,
      tutar: cur?.tutar ?? row.tutar,
      dosyaId: cur?.dosyaId ?? row.dosya_id,
      message: auditMessage,
    },
  });

  return { ok: true, softDeletedIds, auditMessage };
}
