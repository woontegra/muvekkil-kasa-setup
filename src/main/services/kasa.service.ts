import { getDb, nowIso } from "../db/connection";
import { MASRAF_TURLERI, isMasrafTuruKaydiGecerli, isOdemeYontemiGecerli } from "@shared/constants/kasa";
import type {
  KasaEkleInput,
  KasaGuncellePatch,
  KasaHareket,
  KasaIslemSonuc,
  KasaOzet,
  KasaOnayDurumu,
} from "@shared/types/kasa";
import { authGetSession } from "./auth.service";
import { dosyaGet } from "./dosya.service";

function rowHareket(r: Record<string, unknown>): KasaHareket {
  const odeme = String(r.odeme_yontemi ?? "NAKIT");
  return {
    id: Number(r.id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    islemTipi: r.islem_tipi as KasaHareket["islemTipi"],
    masrafTuru: r.masraf_turu == null ? null : String(r.masraf_turu),
    tutar: Number(r.tutar),
    tarih: String(r.tarih ?? ""),
    masrafiYapanKisi: r.masrafi_yapan_kisi == null ? null : String(r.masrafi_yapan_kisi),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    belgeNo: r.belge_no == null ? null : String(r.belge_no),
    odemeYontemi: isOdemeYontemiGecerli(odeme) ? odeme : "NAKIT",
    onayDurumu: (r.onay_durumu as KasaOnayDurumu) ?? "ONAYSIZ",
    duzeltmeMi: Boolean(r.duzeltme_mi),
    duzeltilenIslemId: r.duzeltilen_islem_id == null ? null : Number(r.duzeltilen_islem_id),
    otomatikOnayMi: Boolean(r.otomatik_onay_mi ?? 0),
    onayTarihi: r.onay_tarihi == null ? null : String(r.onay_tarihi),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? r.kayit_tarihi ?? ""),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    onaylayanKullaniciId: r.onaylayan_kullanici_id == null ? null : Number(r.onaylayan_kullanici_id),
    onaylayanKullaniciAdi: r.onaylayan_kullanici_adi == null ? null : String(r.onaylayan_kullanici_adi),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    makbuzTarihi: r.makbuz_tarihi == null ? null : String(r.makbuz_tarihi).slice(0, 10),
    makbuzOlusturulduMu: Boolean(r.makbuz_olusturuldu_mu ?? 0),
  };
}

function belgeGrupForTip(islemTipi: string): string {
  if (islemTipi === "AVANS_GIRISI") return "AVN";
  if (islemTipi === "MASRAF") return "MSF";
  return "DZT";
}

function allocateBelgeNoInTx(d: ReturnType<typeof getDb>, islemTipi: string): string {
  const grup = belgeGrupForTip(islemTipi);
  const yil = new Date().getFullYear();
  const row = d.prepare(`SELECT son_sira FROM belge_no_sayac WHERE yil = ? AND grup = ?`).get(yil, grup) as
    | { son_sira: number }
    | undefined;
  const next = (row?.son_sira ?? 0) + 1;
  if (row) {
    d.prepare(`UPDATE belge_no_sayac SET son_sira = ? WHERE yil = ? AND grup = ?`).run(next, yil, grup);
  } else {
    d.prepare(`INSERT INTO belge_no_sayac (yil, grup, son_sira) VALUES (?,?,?)`).run(yil, grup, next);
  }
  return `${grup}-${yil}-${String(next).padStart(6, "0")}`;
}

function hesaplaAvansBakiyeFromRows(
  rows: { id: number; islem_tipi: string; tutar: number; duzeltilen_islem_id: number | null }[]
): Pick<KasaOzet, "toplamAvans" | "toplamMasraf" | "kalanAvans"> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  function kokKova(hareketId: number): "AVANS" | "MASRAF" | null {
    const seen = new Set<number>();
    let cur: number | null = hareketId;
    while (cur != null) {
      if (seen.has(cur)) return null;
      seen.add(cur);
      const r = byId.get(cur);
      if (!r) return null;
      if (r.islem_tipi === "AVANS_GIRISI") return "AVANS";
      if (r.islem_tipi === "MASRAF") return "MASRAF";
      cur = r.duzeltilen_islem_id ?? null;
    }
    return null;
  }
  let toplamAvans = 0;
  let toplamMasraf = 0;
  for (const x of rows) {
    if (x.islem_tipi === "AVANS_GIRISI") {
      toplamAvans += x.tutar;
    } else if (x.islem_tipi === "MASRAF") {
      toplamMasraf += x.tutar;
    } else if (x.islem_tipi === "DUZELTME") {
      const refId = x.duzeltilen_islem_id;
      if (refId == null) continue;
      const kova = kokKova(refId);
      if (kova === "AVANS") toplamAvans += x.tutar;
      else if (kova === "MASRAF") toplamMasraf += x.tutar;
    }
  }
  return { toplamAvans, toplamMasraf, kalanAvans: toplamAvans - toplamMasraf };
}

function olusturanBilgisi(): { id: number | null; adi: string | null } {
  const u = authGetSession();
  if (!u) return { id: null, adi: null };
  return { id: u.id, adi: u.adSoyad?.trim() || u.kullaniciAdi };
}

const KASA_INSERT_COLS = `dosya_id, muvekkil_id, islem_tipi, masraf_turu, tutar, tarih, masrafi_yapan_kisi, aciklama, belge_no, odeme_yontemi, onay_durumu, duzeltme_mi, duzeltilen_islem_id, kayit_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi`;

/** Transaction içinde dosya avans girişi (vekalet tahsilatı bu yolu kullanmaz). */
export function kasaAvansEkleInTx(
  d: ReturnType<typeof getDb>,
  input: {
    dosyaId: number;
    muvekkilId: number;
    tutar: number;
    tarih: string;
    odemeYontemi: import("@shared/constants/kasa").OdemeYontemiKodu;
    aciklama: string | null;
    t: string;
    olusturan?: { id: number | null; adi: string | null };
  }
): { id: number; belgeNo: string } {
  const olusturan = input.olusturan ?? olusturanBilgisi();
  const belgeNo = allocateBelgeNoInTx(d, "AVANS_GIRISI");
  const rIns = d
    .prepare(
      `INSERT INTO dosya_kasa_hareket (${KASA_INSERT_COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,'ONAYSIZ',0,NULL,?,?,?,?)`
    )
    .run(
      input.dosyaId,
      input.muvekkilId,
      "AVANS_GIRISI",
      null,
      input.tutar,
      input.tarih,
      null,
      input.aciklama,
      belgeNo,
      input.odemeYontemi,
      input.t,
      input.t,
      olusturan.id,
      olusturan.adi
    );
  return { id: Number(rIns.lastInsertRowid), belgeNo };
}

export function masrafTurleriList(): string[] {
  return [...MASRAF_TURLERI];
}

export function kasaHareketList(dosyaId: number): KasaHareket[] {
  const d = getDb();
  const rows = d
    .prepare(`SELECT * FROM dosya_kasa_hareket WHERE dosya_id = ? ORDER BY tarih DESC, id DESC`)
    .all(dosyaId) as Record<string, unknown>[];
  const correctedIds = new Set(
    (
      d
        .prepare(
          `SELECT DISTINCT duzeltilen_islem_id AS x FROM dosya_kasa_hareket WHERE dosya_id = ? AND duzeltme_mi = 1 AND duzeltilen_islem_id IS NOT NULL`
        )
        .all(dosyaId) as { x: number }[]
    ).map((r) => r.x)
  );
  return rows.map((raw) => {
    const h = rowHareket(raw);
    const hasCorrection = correctedIds.has(h.id) && !h.duzeltmeMi;
    return { ...h, hasCorrection };
  });
}

export function kasaHareketGet(id: number): KasaHareket | null {
  const r = getDb().prepare(`SELECT * FROM dosya_kasa_hareket WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return r ? rowHareket(r) : null;
}

export function hesaplaAvansBakiye(dosyaId: number): KasaOzet {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT id, islem_tipi, tutar, duzeltilen_islem_id FROM dosya_kasa_hareket WHERE dosya_id = ? AND onay_durumu IN ('ONAYSIZ','ONAYLI')`
    )
    .all(dosyaId) as { id: number; islem_tipi: string; tutar: number; duzeltilen_islem_id: number | null }[];
  const bakiye = hesaplaAvansBakiyeFromRows(rows);
  const onayRow = d
    .prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ? AND onay_durumu = 'ONAYSIZ'`)
    .get(dosyaId) as { c: number };
  return { ...bakiye, onayBekleyenSayisi: Number(onayRow.c) || 0 };
}

export function kasaHareketOnayla(id: number): KasaIslemSonuc {
  const d = getDb();
  const cur = kasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı" };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Zaten onaylı" };
  if (cur.onayDurumu === "REDDEDILDI") return { ok: false, error: "Reddedilmiş işlem onaylanamaz" };
  const t = nowIso();
  const u = authGetSession();
  d.prepare(
    `UPDATE dosya_kasa_hareket SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 0,
     onaylayan_kullanici_id = ?, onaylayan_kullanici_adi = ?, guncelleme_tarihi = ? WHERE id = ?`
  ).run(t, u?.id ?? null, u?.adSoyad?.trim() || u?.kullaniciAdi || null, t, id);
  const row = kasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı" };
}

export function kasaHareketReddet(id: number): KasaIslemSonuc {
  const d = getDb();
  const cur = kasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı" };
  if (cur.onayDurumu !== "ONAYSIZ") return { ok: false, error: "Yalnızca onaysız işlemler reddedilebilir" };
  const t = nowIso();
  const u = authGetSession();
  d.prepare(
    `UPDATE dosya_kasa_hareket SET onay_durumu = 'REDDEDILDI', onay_tarihi = ?, otomatik_onay_mi = 0,
     onaylayan_kullanici_id = ?, onaylayan_kullanici_adi = ?, guncelleme_tarihi = ? WHERE id = ?`
  ).run(t, u?.id ?? null, u?.adSoyad?.trim() || u?.kullaniciAdi || null, t, id);
  const row = kasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı" };
}

export function kasaHareketSil(id: number): { ok: true } | { ok: false; error: string } {
  const cur = kasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı" };
  if (cur.onayDurumu === "ONAYLI") {
    return { ok: false, error: "Onaylanan işlem silinemez. Düzeltme kaydı oluşturabilirsiniz." };
  }
  getDb().prepare(`DELETE FROM dosya_kasa_hareket WHERE id = ?`).run(id);
  return { ok: true };
}

export function kasaHareketGuncelle(id: number, patch: KasaGuncellePatch): KasaIslemSonuc {
  if (patch.onayDurumu === "REDDEDILDI") {
    return kasaHareketReddet(id);
  }
  const cur = kasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı" };
  if (cur.islemTipi === "DUZELTME") return { ok: false, error: "Düzeltme kaydı değiştirilemez" };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Onaylı işlem değiştirilemez" };
  if (cur.onayDurumu === "REDDEDILDI") return { ok: false, error: "Reddedilmiş işlem değiştirilemez" };
  if (patch.masrafTuru !== undefined && cur.islemTipi === "MASRAF" && !isMasrafTuruKaydiGecerli(patch.masrafTuru)) {
    return { ok: false, error: "Geçerli masraf türü giriniz" };
  }
  if (patch.odemeYontemi !== undefined && !isOdemeYontemiGecerli(patch.odemeYontemi)) {
    return { ok: false, error: "Geçersiz ödeme yöntemi" };
  }
  const d = getDb();
  const fields: string[] = ["guncelleme_tarihi = ?"];
  const vals: unknown[] = [nowIso()];
  if (patch.tutar !== undefined) {
    fields.push("tutar = ?");
    vals.push(patch.tutar);
  }
  if (patch.tarih !== undefined) {
    fields.push("tarih = ?");
    vals.push(patch.tarih);
  }
  if (patch.aciklama !== undefined) {
    fields.push("aciklama = ?");
    vals.push(patch.aciklama);
  }
  if (patch.belgeNo !== undefined) {
    fields.push("belge_no = ?");
    vals.push(patch.belgeNo);
  }
  if (patch.masrafTuru !== undefined) {
    fields.push("masraf_turu = ?");
    vals.push(patch.masrafTuru);
  }
  if (patch.masrafiYapanKisi !== undefined) {
    fields.push("masrafi_yapan_kisi = ?");
    vals.push(patch.masrafiYapanKisi);
  }
  if (patch.odemeYontemi !== undefined) {
    fields.push("odeme_yontemi = ?");
    vals.push(patch.odemeYontemi);
  }
  vals.push(id);
  d.prepare(`UPDATE dosya_kasa_hareket SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const row = kasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı" };
}

export function kasaHareketEkle(input: KasaEkleInput): KasaIslemSonuc {
  const dosya = dosyaGet(input.dosyaId);
  if (!dosya || dosya.muvekkilId !== input.muvekkilId) {
    return { ok: false, error: "Dosya ve müvekkil eşleşmiyor" };
  }
  const odeme = input.odemeYontemi && isOdemeYontemiGecerli(input.odemeYontemi) ? input.odemeYontemi : "NAKIT";
  const t = nowIso();
  const d = getDb();
  const olusturan = olusturanBilgisi();

  const insertCols = KASA_INSERT_COLS;

  if (input.islemTipi === "MASRAF") {
    if (!isMasrafTuruKaydiGecerli(input.masrafTuru)) {
      return { ok: false, error: "Geçerli masraf türü giriniz" };
    }
    if (input.tutar <= 0) return { ok: false, error: "Masraf tutarı sıfırdan büyük olmalıdır" };
    const yapan = (input.masrafiYapanKisi ?? "").trim();
    try {
      const row = d.transaction(() => {
        const belgeNo = allocateBelgeNoInTx(d, "MASRAF");
        const rIns = d
          .prepare(
            `INSERT INTO dosya_kasa_hareket (${insertCols}) VALUES (?,?,?,?,?,?,?,?,?,?,'ONAYSIZ',0,NULL,?,?,?,?)`
          )
          .run(
            input.dosyaId,
            input.muvekkilId,
            "MASRAF",
            input.masrafTuru,
            input.tutar,
            input.tarih,
            yapan || null,
            input.aciklama ?? null,
            belgeNo,
            odeme,
            t,
            t,
            olusturan.id,
            olusturan.adi
          );
        return kasaHareketGet(Number(rIns.lastInsertRowid));
      })();
      return row ? { ok: true, row } : { ok: false, error: "Kayıt oluşturulamadı" };
    } catch (e) {
      console.error("[kasaHareketEkle MASRAF]", e);
      return { ok: false, error: "Kayıt oluşturulamadı" };
    }
  }

  if (input.islemTipi === "AVANS_GIRISI") {
    if (input.tutar <= 0) return { ok: false, error: "Avans tutarı sıfırdan büyük olmalıdır" };
    try {
      const row = d.transaction(() => {
        const belgeNo = allocateBelgeNoInTx(d, "AVANS_GIRISI");
        const rIns = d
          .prepare(
            `INSERT INTO dosya_kasa_hareket (${insertCols}) VALUES (?,?,?,?,?,?,?,?,?,?,'ONAYSIZ',0,NULL,?,?,?,?)`
          )
          .run(
            input.dosyaId,
            input.muvekkilId,
            "AVANS_GIRISI",
            null,
            input.tutar,
            input.tarih,
            null,
            input.aciklama ?? null,
            belgeNo,
            odeme,
            t,
            t,
            olusturan.id,
            olusturan.adi
          );
        return kasaHareketGet(Number(rIns.lastInsertRowid));
      })();
      return row ? { ok: true, row } : { ok: false, error: "Kayıt oluşturulamadı" };
    } catch (e) {
      console.error("[kasaHareketEkle AVANS]", e);
      return { ok: false, error: "Kayıt oluşturulamadı" };
    }
  }

  if (input.islemTipi === "DUZELTME") {
    const aciklama = (input.aciklama ?? "").trim();
    if (!aciklama) return { ok: false, error: "Düzeltme açıklaması zorunludur" };
    const refId = input.duzeltilenIslemId;
    if (!refId) return { ok: false, error: "Düzeltilen işlem seçilmelidir" };
    const ref = kasaHareketGet(refId);
    if (!ref || ref.dosyaId !== input.dosyaId) {
      return { ok: false, error: "Düzeltilen işlem bu dosyaya ait değil" };
    }
    if (ref.onayDurumu !== "ONAYLI") {
      return { ok: false, error: "Düzeltme yalnızca onaylı işlemler için kaydedilebilir" };
    }
    if (ref.duzeltmeMi) {
      return { ok: false, error: "Düzeltme kaydı üzerinden yeni düzeltme açılamaz; ana işlem üzerinden düzeltme girin" };
    }
    if (input.tutar === 0) return { ok: false, error: "Düzeltme tutarı sıfır olamaz" };
    try {
      const row = d.transaction(() => {
        const belgeNo = allocateBelgeNoInTx(d, "DUZELTME");
        const rIns = d
          .prepare(
            `INSERT INTO dosya_kasa_hareket (${insertCols}) VALUES (?,?,?,?,?,?,?,?,?,?,'ONAYSIZ',1,?,?,?,?,?)`
          )
          .run(
            input.dosyaId,
            input.muvekkilId,
            "DUZELTME",
            null,
            input.tutar,
            input.tarih,
            null,
            aciklama,
            belgeNo,
            odeme,
            refId,
            t,
            t,
            olusturan.id,
            olusturan.adi
          );
        return kasaHareketGet(Number(rIns.lastInsertRowid));
      })();
      return row ? { ok: true, row } : { ok: false, error: "Kayıt oluşturulamadı" };
    } catch (e) {
      console.error("[kasaHareketEkle DUZELTME]", e);
      return { ok: false, error: "Kayıt oluşturulamadı" };
    }
  }

  return { ok: false, error: "Geçersiz işlem tipi" };
}
