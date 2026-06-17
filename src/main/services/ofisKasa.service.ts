import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  isGecerliOfisGelirKategori,
  isGecerliOfisGiderKategori,
  isOfisOdemeYontemiGecerli,
  OFIS_GELIR_KATEGORI_ETIKET,
  OFIS_GIDER_KATEGORI_ETIKET,
} from "@shared/constants/ofisKasa";
import {
  duzeltmeKasaEtkisiFromRow,
  hesaplaOfisKasaDuzeltme,
} from "@shared/ofisKasaDuzeltme";
import type {
  OfisKasaAnaSayfaOzet,
  OfisKasaDuzeltmeInput,
  OfisKasaEkleInput,
  OfisKasaGuncellePatch,
  OfisKasaHareket,
  OfisKasaHareketListeSatir,
  OfisKasaIslemSonuc,
  OfisKasaListFilter,
  OfisKasaRaporPaketi,
  OfisKasaUstOzet,
} from "@shared/types/ofisKasa";
import { getDb, nowIso } from "../db/connection";
import { officeSettingsGetForMakbuz } from "./office.service";

function formatDateTrSimple(iso: string): string {
  const p = String(iso ?? "").slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function formatTrySimple(n: number): string {
  return `${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

function kategoriEtiketi(kategori: string, ozelKategoriAdi: string | null): string {
  if (kategori === "DUZELTME") return "Düzeltme";
  const ozel = (ozelKategoriAdi ?? "").trim();
  if (kategori === DIGER_GELIR_KOD || kategori === DIGER_GIDER_KOD) {
    return ozel || (kategori === DIGER_GELIR_KOD ? OFIS_GELIR_KATEGORI_ETIKET[DIGER_GELIR_KOD] : OFIS_GIDER_KATEGORI_ETIKET[DIGER_GIDER_KOD]);
  }
  return OFIS_GELIR_KATEGORI_ETIKET[kategori] ?? OFIS_GIDER_KATEGORI_ETIKET[kategori] ?? kategori;
}

type OfisKasaOzetSatir = {
  islem_tipi: string;
  tutar: number;
  tarih: string;
  duzeltme_mi: number;
  onay_durumu: string;
  duzeltme_kasa_etkisi: number | null;
};

function ofisKasaSatirKasaEtkisi(x: OfisKasaOzetSatir): number {
  if (x.islem_tipi === "GELIR") return x.tutar;
  if (x.islem_tipi === "GIDER") return -x.tutar;
  if (x.islem_tipi === "DUZELTME") {
    return duzeltmeKasaEtkisiFromRow({
      tutar: x.tutar,
      duzeltmeKasaEtkisi: x.duzeltme_kasa_etkisi,
    });
  }
  return 0;
}

function allocateDztBelgeNo(d: ReturnType<typeof getDb>): string {
  const grup = "DZT";
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

function bugunYerelIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rowOfisKasaHareket(r: Record<string, unknown>): OfisKasaHareket {
  return {
    id: Number(r.id),
    islemTipi: r.islem_tipi as OfisKasaHareket["islemTipi"],
    tarih: String(r.tarih ?? ""),
    kategori: String(r.kategori ?? ""),
    ozelKategoriAdi: r.ozel_kategori_adi == null ? null : String(r.ozel_kategori_adi),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    tutar: Number(r.tutar ?? 0),
    odemeYontemi: String(r.odeme_yontemi ?? ""),
    belgeNo: r.belge_no == null ? null : String(r.belge_no),
    not: r.not_metni == null ? null : String(r.not_metni),
    onayDurumu: (r.onay_durumu as OfisKasaHareket["onayDurumu"]) ?? "ONAYSIZ",
    duzeltmeMi: Boolean(r.duzeltme_mi),
    orijinalHareketId: r.orijinal_hareket_id == null ? null : Number(r.orijinal_hareket_id),
    otomatikOnayMi: Boolean(r.otomatik_onay_mi ?? 0),
    onayTarihi: r.onay_tarihi == null ? null : String(r.onay_tarihi),
    olusturmaTarihi: String(r.olusturma_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    onaylayanKullaniciId: r.onaylayan_kullanici_id == null ? null : Number(r.onaylayan_kullanici_id),
    onaylayanKullaniciAdi: r.onaylayan_kullanici_adi == null ? null : String(r.onaylayan_kullanici_adi),
    duzeltmeYonu:
      r.duzeltme_yonu === "ARTIR" || r.duzeltme_yonu === "AZALT"
        ? r.duzeltme_yonu
        : null,
    duzeltmeOrijinalTutar: r.duzeltme_orijinal_tutar == null ? null : Number(r.duzeltme_orijinal_tutar),
    duzeltmeDogruTutar: r.duzeltme_dogru_tutar == null ? null : Number(r.duzeltme_dogru_tutar),
    duzeltmeFarkTutar: r.duzeltme_fark_tutar == null ? null : Number(r.duzeltme_fark_tutar),
    duzeltmeKasaEtkisi: r.duzeltme_kasa_etkisi == null ? null : Number(r.duzeltme_kasa_etkisi),
    duzeltmeRefTipi:
      r.duzeltme_ref_tipi === "GELIR" || r.duzeltme_ref_tipi === "GIDER" ? r.duzeltme_ref_tipi : null,
  };
}

export function approveAllPendingOfisKasaOnExit(): { approved: number } {
  const d = getDb();
  const t = nowIso();
  const r = d
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 1,
       onaylayan_kullanici_id = NULL, onaylayan_kullanici_adi = 'Otomatik (kapanış)', guncelleme_tarihi = ?
       WHERE onay_durumu = 'ONAYSIZ'`
    )
    .run(t, t);
  return { approved: Number(r.changes ?? 0) };
}

export function ofisKasaHareketList(f: OfisKasaListFilter = {}): OfisKasaHareketListeSatir[] {
  const d = getDb();
  const tb = (f.tarihBas ?? "").trim().slice(0, 10);
  const te = (f.tarihBit ?? "").trim().slice(0, 10);
  const q = (f.q ?? "").trim();
  const kat = (f.kategori ?? "").trim();
  const conds = [`tarih >= ?`, `tarih <= ?`];
  const params: unknown[] = [tb, te];
  if (f.islemTipi === "GELIR") {
    conds.push(`islem_tipi = 'GELIR'`);
  } else if (f.islemTipi === "GIDER") {
    conds.push(`islem_tipi = 'GIDER'`);
  } else if (f.islemTipi === "DUZELTME") {
    conds.push(`islem_tipi = 'DUZELTME'`);
  }
  if (kat) {
    conds.push(`kategori = ?`);
    params.push(kat);
  }
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    conds.push(
      `(aciklama LIKE ? ESCAPE '\\' OR belge_no LIKE ? ESCAPE '\\' OR not_metni LIKE ? ESCAPE '\\' OR ozel_kategori_adi LIKE ? ESCAPE '\\')`
    );
    params.push(like, like, like, like);
  }
  const sql = `SELECT * FROM ofis_kasa_hareketleri WHERE ${conds.join(" AND ")} ORDER BY tarih DESC, id DESC`;
  const rows = d.prepare(sql).all(...params) as Record<string, unknown>[];
  const correctedIds = new Set(
    (
      d
        .prepare(
          `SELECT DISTINCT orijinal_hareket_id AS x FROM ofis_kasa_hareketleri WHERE islem_tipi = 'DUZELTME' AND duzeltme_mi = 1 AND orijinal_hareket_id IS NOT NULL`
        )
        .all() as { x: number }[]
    ).map((r) => r.x)
  );
  return rows.map((raw) => {
    const h = rowOfisKasaHareket(raw);
    const hasCorrection = correctedIds.has(h.id) && h.islemTipi !== "DUZELTME";
    if (h.islemTipi === "DUZELTME" && !h.duzeltmeRefTipi && h.orijinalHareketId != null) {
      const origRaw = rows.find((r) => Number(r.id) === h.orijinalHareketId);
      if (origRaw) {
        const orig = rowOfisKasaHareket(origRaw);
        if (orig.islemTipi === "GELIR" || orig.islemTipi === "GIDER") {
          return { ...h, duzeltmeRefTipi: orig.islemTipi, hasCorrection };
        }
      }
    }
    return { ...h, hasCorrection };
  });
}

export function ofisKasaUstOzet(): OfisKasaUstOzet {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT islem_tipi, tutar, tarih, duzeltme_mi, onay_durumu, duzeltme_kasa_etkisi
       FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ', 'ONAYLI')`
    )
    .all() as OfisKasaOzetSatir[];
  const now = new Date();
  const ayPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let toplamGelir = 0;
  let toplamGider = 0;
  let buAyGelir = 0;
  let buAyGider = 0;
  let duzeltmeEtkisi = 0;
  for (const r of rows) {
    const t = String(r.tarih ?? "").slice(0, 10);
    const inAy = t.startsWith(ayPrefix);
    if (r.islem_tipi === "GELIR" && !r.duzeltme_mi) {
      toplamGelir += r.tutar;
      if (inAy) buAyGelir += r.tutar;
    } else if (r.islem_tipi === "GIDER" && !r.duzeltme_mi) {
      toplamGider += r.tutar;
      if (inAy) buAyGider += r.tutar;
    } else if (r.islem_tipi === "DUZELTME" && r.duzeltme_mi) {
      duzeltmeEtkisi += ofisKasaSatirKasaEtkisi(r);
    }
  }
  const kasaBakiyesi = toplamGelir - toplamGider + duzeltmeEtkisi;
  return { toplamGelir, toplamGider, duzeltmeEtkisi, kasaBakiyesi, buAyGelir, buAyGider };
}

export function ofisKasaAnaSayfaOzet(): OfisKasaAnaSayfaOzet {
  const ust = ofisKasaUstOzet();
  const d = getDb();
  const bugun = bugunYerelIso();
  const now = new Date();
  const ayPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = d
    .prepare(
      `SELECT islem_tipi, tutar, tarih, duzeltme_mi, onay_durumu, duzeltme_kasa_etkisi
       FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ', 'ONAYLI')`
    )
    .all() as OfisKasaOzetSatir[];
  let bugunGider = 0;
  let buAyGider = 0;
  for (const r of rows) {
    const t = String(r.tarih ?? "").slice(0, 10);
    if (r.islem_tipi === "GIDER" && !r.duzeltme_mi) {
      if (t === bugun) bugunGider += r.tutar;
      if (t.startsWith(ayPrefix)) buAyGider += r.tutar;
    }
  }
  return { bugunGider, buAyGider, kasaBakiyesi: ust.kasaBakiyesi };
}

function ofisKasaHareketGet(id: number): OfisKasaHareket | null {
  const r = getDb().prepare(`SELECT * FROM ofis_kasa_hareketleri WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return r ? rowOfisKasaHareket(r) : null;
}

export function ofisKasaHareketEkle(
  input: OfisKasaEkleInput,
  olusturanKullaniciId: number | null,
  olusturanKullaniciAdi: string | null
): OfisKasaIslemSonuc {
  const tarih = (input.tarih ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin (YYYY-AA-GG)." };
  const kat = (input.kategori ?? "").trim();
  if (input.islemTipi === "GELIR") {
    if (!isGecerliOfisGelirKategori(kat)) return { ok: false, error: "Geçerli gelir kategorisi seçin." };
  } else if (!isGecerliOfisGiderKategori(kat)) {
    return { ok: false, error: "Geçerli gider kategorisi seçin." };
  }
  const ozel = (input.ozelKategoriAdi ?? "").trim();
  if (kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD) {
    if (!ozel) return { ok: false, error: "Özel kategori adı zorunludur." };
  }
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalıdır." };
  }
  const od = (input.odemeYontemi ?? "").trim();
  if (!isOfisOdemeYontemiGecerli(od)) return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
  const d = getDb();
  const t = nowIso();
  const ozelDb = kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD ? ozel : null;
  try {
    const rIns = d
      .prepare(
        `INSERT INTO ofis_kasa_hareketleri (
          islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, odeme_yontemi, belge_no, not_metni,
          onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
          olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
          onaylayan_kullanici_id, onaylayan_kullanici_adi
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        input.islemTipi,
        tarih,
        kat,
        ozelDb,
        (input.aciklama ?? "").trim() || null,
        input.tutar,
        od,
        (input.belgeNo ?? "").trim() || null,
        (input.not ?? "").trim() || null,
        "ONAYSIZ",
        0,
        null,
        0,
        null,
        t,
        t,
        olusturanKullaniciId,
        olusturanKullaniciAdi,
        null,
        null
      );
    const id = Number(rIns.lastInsertRowid);
    const row = ofisKasaHareketGet(id);
    return row ? { ok: true, row } : { ok: false, error: "Kayıt oluşturulamadı." };
  } catch (e) {
    console.error("[ofisKasaHareketEkle]", e);
    return { ok: false, error: "Kayıt oluşturulamadı." };
  }
}

export function ofisKasaHareketGuncelle(id: number, patch: OfisKasaGuncellePatch): OfisKasaIslemSonuc {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Onaylı işlem düzenlenemez." };
  if (cur.islemTipi === "DUZELTME") return { ok: false, error: "Düzeltme kaydı düzenlenemez." };
  const d = getDb();
  let kat = cur.kategori;
  if (patch.kategori !== undefined) kat = patch.kategori.trim();
  const tip = cur.islemTipi;
  if (patch.kategori !== undefined || patch.tutar !== undefined || patch.ozelKategoriAdi !== undefined) {
    if (tip === "GELIR" && !isGecerliOfisGelirKategori(kat)) {
      return { ok: false, error: "Geçerli gelir kategorisi seçin." };
    }
    if (tip === "GIDER" && !isGecerliOfisGiderKategori(kat)) {
      return { ok: false, error: "Geçerli gider kategorisi seçin." };
    }
  }
  const ozelRaw = patch.ozelKategoriAdi !== undefined ? patch.ozelKategoriAdi : cur.ozelKategoriAdi;
  const ozel = (ozelRaw ?? "").trim();
  if (kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD) {
    if (!ozel) return { ok: false, error: "Özel kategori adı zorunludur." };
  }
  if (patch.tutar !== undefined && (!Number.isFinite(patch.tutar) || patch.tutar <= 0)) {
    return { ok: false, error: "Tutar sıfırdan büyük olmalıdır." };
  }
  if (patch.odemeYontemi !== undefined && !isOfisOdemeYontemiGecerli(patch.odemeYontemi.trim())) {
    return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
  }
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.tarih !== undefined) {
    const tarih = patch.tarih.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin." };
    fields.push("tarih = ?");
    vals.push(tarih);
  }
  if (patch.kategori !== undefined) {
    fields.push("kategori = ?");
    vals.push(kat);
  }
  if (patch.ozelKategoriAdi !== undefined) {
    fields.push("ozel_kategori_adi = ?");
    vals.push(kat === DIGER_GELIR_KOD || kat === DIGER_GIDER_KOD ? ozel : null);
  }
  if (patch.aciklama !== undefined) {
    fields.push("aciklama = ?");
    vals.push((patch.aciklama ?? "").trim() || null);
  }
  if (patch.tutar !== undefined) {
    fields.push("tutar = ?");
    vals.push(patch.tutar);
  }
  if (patch.odemeYontemi !== undefined) {
    fields.push("odeme_yontemi = ?");
    vals.push(patch.odemeYontemi.trim());
  }
  if (patch.belgeNo !== undefined) {
    fields.push("belge_no = ?");
    vals.push((patch.belgeNo ?? "").trim() || null);
  }
  if (patch.not !== undefined) {
    fields.push("not_metni = ?");
    vals.push((patch.not ?? "").trim() || null);
  }
  if (fields.length === 0) return { ok: true, row: cur };
  const t = nowIso();
  fields.push("guncelleme_tarihi = ?");
  vals.push(t);
  vals.push(id);
  d.prepare(`UPDATE ofis_kasa_hareketleri SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const row = ofisKasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı." };
}

export function ofisKasaHareketSil(id: number): { ok: true } | { ok: false; error: string } {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (cur.onayDurumu === "ONAYLI") {
    return { ok: false, error: "Onaylı işlem silinemez. Düzeltme kaydı oluşturun." };
  }
  getDb().prepare(`DELETE FROM ofis_kasa_hareketleri WHERE id = ?`).run(id);
  return { ok: true };
}

export function ofisKasaHareketOnayla(
  id: number,
  onaylayanKullaniciId: number | null,
  onaylayanKullaniciAdi: string | null
): OfisKasaIslemSonuc {
  const cur = ofisKasaHareketGet(id);
  if (!cur) return { ok: false, error: "İşlem bulunamadı." };
  if (cur.onayDurumu === "ONAYLI") return { ok: false, error: "Zaten onaylı." };
  const t = nowIso();
  getDb()
    .prepare(
      `UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 0,
       onaylayan_kullanici_id = ?, onaylayan_kullanici_adi = ?, guncelleme_tarihi = ? WHERE id = ?`
    )
    .run(t, onaylayanKullaniciId, onaylayanKullaniciAdi, t, id);
  const row = ofisKasaHareketGet(id);
  return row ? { ok: true, row } : { ok: false, error: "İşlem bulunamadı." };
}

export function ofisKasaDuzeltmeEkle(
  input: OfisKasaDuzeltmeInput,
  olusturanKullaniciId: number | null,
  olusturanKullaniciAdi: string | null
): OfisKasaIslemSonuc {
  const ref = ofisKasaHareketGet(input.orijinalHareketId);
  if (!ref) return { ok: false, error: "Düzeltilen işlem bulunamadı." };
  if (ref.onayDurumu !== "ONAYLI") {
    return { ok: false, error: "Düzeltme yalnızca onaylı işlemler için kaydedilebilir." };
  }
  if (ref.islemTipi === "DUZELTME") {
    return { ok: false, error: "Düzeltme kaydı üzerinden yeni düzeltme açılamaz." };
  }
  if (ref.islemTipi !== "GELIR" && ref.islemTipi !== "GIDER") {
    return { ok: false, error: "Geçersiz işlem tipi." };
  }
  const d = getDb();
  const mevcutDuz = d
    .prepare(
      `SELECT 1 AS x FROM ofis_kasa_hareketleri WHERE islem_tipi = 'DUZELTME' AND duzeltme_mi = 1 AND orijinal_hareket_id = ?`
    )
    .get(input.orijinalHareketId);
  if (mevcutDuz) {
    return { ok: false, error: "Bu kayıt için zaten düzeltme yapılmış." };
  }
  const hesap = hesaplaOfisKasaDuzeltme(ref.islemTipi, ref.tutar, input.dogruTutar);
  if (!hesap.ok) return { ok: false, error: hesap.error };
  const tarih = (input.tarih ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { ok: false, error: "Geçerli tarih girin." };
  const refTipLabel = ref.islemTipi === "GELIR" ? "Gelir" : "Gider";
  const katEtiket = kategoriEtiketi(ref.kategori, ref.ozelKategoriAdi);
  const notMetni = (input.not ?? "").trim();
  const aciklama =
    notMetni ||
    `${formatDateTrSimple(ref.tarih)} tarihli ${refTipLabel} / ${katEtiket} / ${formatTrySimple(ref.tutar)} kaydı için düzeltme`;
  const t = nowIso();
  try {
    const belgeNo = allocateDztBelgeNo(d);
    const rIns = d
      .prepare(
        `INSERT INTO ofis_kasa_hareketleri (
          islem_tipi, tarih, kategori, ozel_kategori_adi, aciklama, tutar, odeme_yontemi, belge_no, not_metni,
          onay_durumu, duzeltme_mi, orijinal_hareket_id, otomatik_onay_mi, onay_tarihi,
          olusturma_tarihi, guncelleme_tarihi, olusturan_kullanici_id, olusturan_kullanici_adi,
          onaylayan_kullanici_id, onaylayan_kullanici_adi,
          duzeltme_yonu, duzeltme_orijinal_tutar, duzeltme_dogru_tutar, duzeltme_fark_tutar, duzeltme_kasa_etkisi,
          duzeltme_ref_tipi
        ) VALUES ('DUZELTME',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        tarih,
        ref.kategori,
        ref.ozelKategoriAdi,
        aciklama,
        hesap.kasaEtkisi,
        ref.odemeYontemi,
        belgeNo,
        notMetni || null,
        "ONAYSIZ",
        1,
        input.orijinalHareketId,
        0,
        null,
        t,
        t,
        olusturanKullaniciId,
        olusturanKullaniciAdi,
        null,
        null,
        hesap.yon,
        ref.tutar,
        input.dogruTutar,
        hesap.farkTutar,
        hesap.kasaEtkisi,
        ref.islemTipi
      );
    const id = Number(rIns.lastInsertRowid);
    const row = ofisKasaHareketGet(id);
    return row ? { ok: true, row } : { ok: false, error: "Düzeltme kaydı oluşturulamadı." };
  } catch (e) {
    console.error("[ofisKasaDuzeltmeEkle]", e);
    return { ok: false, error: "Düzeltme kaydı oluşturulamadı." };
  }
}

export function getOfisKasaRaporPaketi(tarihBas: string, tarihBit: string): OfisKasaRaporPaketi {
  const tb = (tarihBas ?? "").trim().slice(0, 10);
  const te = (tarihBit ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tb) || !/^\d{4}-\d{2}-\d{2}$/.test(te)) {
    return { ok: false, mesaj: "Geçersiz tarih aralığı." };
  }
  const office = officeSettingsGetForMakbuz();
  const liste = ofisKasaHareketList({ tarihBas: tb, tarihBit: te, islemTipi: "TUMU", kategori: "", q: "" });
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT islem_tipi, tutar, duzeltme_mi, onay_durumu, duzeltme_kasa_etkisi
       FROM ofis_kasa_hareketleri WHERE onay_durumu IN ('ONAYSIZ', 'ONAYLI') AND tarih >= ? AND tarih <= ?`
    )
    .all(tb, te) as OfisKasaOzetSatir[];
  let toplamGelir = 0;
  let toplamGider = 0;
  let duzeltmeEtkisi = 0;
  for (const r of rows) {
    if (r.islem_tipi === "GELIR" && !r.duzeltme_mi) toplamGelir += r.tutar;
    else if (r.islem_tipi === "GIDER" && !r.duzeltme_mi) toplamGider += r.tutar;
    else if (r.islem_tipi === "DUZELTME" && r.duzeltme_mi) duzeltmeEtkisi += ofisKasaSatirKasaEtkisi(r);
  }
  const kasaBakiyesi = toplamGelir - toplamGider + duzeltmeEtkisi;
  return {
    ok: true,
    tarihBas: tb,
    tarihBit: te,
    yazdirmaTarihi: nowIso(),
    office,
    toplamGelir,
    toplamGider,
    duzeltmeEtkisi,
    kasaBakiyesi,
    hareketler: liste,
  };
}
