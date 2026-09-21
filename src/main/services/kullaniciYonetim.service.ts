import bcrypt from "bcryptjs";
import { getDb, nowIso } from "../db/connection";
import { KULLANICI_ROLLERI, type KullaniciRolu } from "@shared/types/auth";
import { writeAuditLog } from "./auditLog.service";

export type { KullaniciRolu };

export type KullaniciListItem = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  eposta: string | null;
  telefon: string | null;
  rol: KullaniciRolu;
  aktifMi: boolean;
  kayitTarihi: string;
};

const ROLLER: readonly KullaniciRolu[] = KULLANICI_ROLLERI;

function mapUser(r: Record<string, unknown>): KullaniciListItem {
  const rolRaw = String(r.rol ?? "BURO_SAHIBI");
  const rol = (ROLLER.includes(rolRaw as KullaniciRolu) ? rolRaw : "KATIP_PERSONEL") as KullaniciRolu;
  return {
    id: Number(r.id),
    adSoyad: String(r.ad_soyad ?? ""),
    kullaniciAdi: String(r.kullanici_adi ?? ""),
    eposta: r.eposta == null ? null : String(r.eposta),
    telefon: r.telefon == null ? null : String(r.telefon),
    rol,
    aktifMi: Number(r.aktif_mi) === 1,
    kayitTarihi: String(r.kayit_tarihi ?? ""),
  };
}

export function listKullanicilar(): KullaniciListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT id, ad_soyad, kullanici_adi, eposta, telefon, COALESCE(rol, 'BURO_SAHIBI') AS rol, aktif_mi, kayit_tarihi
       FROM uygulama_kullanici ORDER BY aktif_mi DESC, ad_soyad ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapUser);
}

export function createKullanici(
  input: {
    adSoyad: string;
    kullaniciAdi: string;
    eposta?: string | null;
    telefon?: string | null;
    sifre: string;
    rol: KullaniciRolu;
  },
  actor?: { id: number; adSoyad: string } | null,
): { ok: true; row: KullaniciListItem } | { ok: false; error: string } {
  const adSoyad = input.adSoyad.trim();
  const kullaniciAdi = input.kullaniciAdi.trim();
  const sifre = input.sifre;
  if (adSoyad.length < 2) return { ok: false, error: "Ad soyad zorunlu." };
  if (kullaniciAdi.length < 3) return { ok: false, error: "Kullanıcı adı en az 3 karakter olmalı." };
  if (sifre.length < 6) return { ok: false, error: "Şifre en az 6 karakter olmalı." };
  if (!ROLLER.includes(input.rol)) return { ok: false, error: "Geçersiz rol." };
  const d = getDb();
  const exists = d
    .prepare(`SELECT id FROM uygulama_kullanici WHERE kullanici_adi = ? COLLATE NOCASE`)
    .get(kullaniciAdi) as { id: number } | undefined;
  if (exists) return { ok: false, error: "Bu kullanıcı adı kullanımda." };
  const hash = bcrypt.hashSync(sifre, 10);
  const t = nowIso();
  try {
    const info = d
      .prepare(
        `INSERT INTO uygulama_kullanici (ad_soyad, kullanici_adi, eposta, telefon, sifre_hash, aktif_mi, kayit_tarihi, rol)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        adSoyad,
        kullaniciAdi,
        input.eposta?.trim() || null,
        input.telefon?.trim() || null,
        hash,
        t,
        input.rol,
      );
    const id = Number(info.lastInsertRowid);
    const row = listKullanicilar().find((u) => u.id === id)!;
    writeAuditLog({
      kullaniciId: actor?.id ?? null,
      kullaniciAdi: actor?.adSoyad ?? null,
      eylem: "KULLANICI_OLUSTUR",
      varlikTipi: "uygulama_kullanici",
      varlikId: String(id),
      ozet: `Kullanıcı eklendi: ${kullaniciAdi} (${input.rol})`,
    });
    return { ok: true, row };
  } catch (e) {
    console.error("[createKullanici]", e);
    return { ok: false, error: "Kullanıcı oluşturulamadı." };
  }
}

export function setKullaniciAktif(
  id: number,
  aktif: boolean,
  actor?: { id: number; adSoyad: string } | null,
): { ok: true; row: KullaniciListItem } | { ok: false; error: string } {
  const d = getDb();
  const cur = d.prepare(`SELECT * FROM uygulama_kullanici WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!cur) return { ok: false, error: "Kullanıcı bulunamadı." };
  if (!aktif) {
    const aktifSahip = (
      d
        .prepare(
          `SELECT COUNT(*) AS c FROM uygulama_kullanici WHERE aktif_mi = 1 AND COALESCE(rol,'BURO_SAHIBI') = 'BURO_SAHIBI' AND id != ?`,
        )
        .get(id) as { c: number }
    ).c;
    const buSahip = String(cur.rol ?? "BURO_SAHIBI") === "BURO_SAHIBI" && Number(cur.aktif_mi) === 1;
    if (buSahip && aktifSahip === 0) {
      return { ok: false, error: "Son aktif büro sahibi pasifleştirilemez." };
    }
  }
  d.prepare(`UPDATE uygulama_kullanici SET aktif_mi = ? WHERE id = ?`).run(aktif ? 1 : 0, id);
  const row = listKullanicilar().find((u) => u.id === id)!;
  writeAuditLog({
    kullaniciId: actor?.id ?? null,
    kullaniciAdi: actor?.adSoyad ?? null,
    eylem: aktif ? "KULLANICI_AKTIF" : "KULLANICI_PASIF",
    varlikTipi: "uygulama_kullanici",
    varlikId: String(id),
    ozet: `${row.kullaniciAdi} ${aktif ? "aktifleştirildi" : "pasifleştirildi"}`,
  });
  return { ok: true, row };
}

export function resetKullaniciSifre(
  id: number,
  yeniSifre: string,
  actor?: { id: number; adSoyad: string } | null,
): { ok: true } | { ok: false; error: string } {
  if (yeniSifre.length < 6) return { ok: false, error: "Şifre en az 6 karakter olmalı." };
  const cur = getDb().prepare(`SELECT id, kullanici_adi FROM uygulama_kullanici WHERE id = ?`).get(id) as
    | { id: number; kullanici_adi: string }
    | undefined;
  if (!cur) return { ok: false, error: "Kullanıcı bulunamadı." };
  getDb().prepare(`UPDATE uygulama_kullanici SET sifre_hash = ? WHERE id = ?`).run(bcrypt.hashSync(yeniSifre, 10), id);
  writeAuditLog({
    kullaniciId: actor?.id ?? null,
    kullaniciAdi: actor?.adSoyad ?? null,
    eylem: "KULLANICI_SIFRE_SIFIRLA",
    varlikTipi: "uygulama_kullanici",
    varlikId: String(id),
    ozet: `Şifre sıfırlandı: ${cur.kullanici_adi}`,
  });
  return { ok: true };
}
