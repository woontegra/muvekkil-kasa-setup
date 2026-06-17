import { getDb, nowIso } from "../db/connection";
import { authGetSession } from "./auth.service";
import { kasaAvansEkleInTx } from "./kasa.service";
import { isOdemeYontemiGecerli } from "@shared/constants/kasa";
import type {
  SmmBekleyenSatir,
  TaksitDurum,
  TaksitEkleInput,
  TaksitGuncelleInput,
  TaksitOdemeAlInput,
  TaksitSmmDurum,
  VekaletIslemSonuc,
  VekaletKaydetInput,
  VekaletOzet,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletUcreti,
} from "@shared/types/vekalet";

function olusturanBilgisi(): { id: number | null; adi: string | null } {
  const u = authGetSession();
  if (!u) return { id: null, adi: null };
  return { id: u.id, adi: u.adSoyad?.trim() || u.kullaniciAdi };
}

function rowVekalet(r: Record<string, unknown>): VekaletUcreti {
  return {
    id: Number(r.id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    anlasilanTutar: Number(r.anlasilan_tutar ?? 0),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function rowOdeme(r: Record<string, unknown>): VekaletTaksitOdeme {
  return {
    id: Number(r.id),
    taksitId: Number(r.taksit_id),
    vekaletId: Number(r.vekalet_id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    odemeTarihi: String(r.odeme_tarihi ?? "").slice(0, 10),
    tutar: Number(r.tutar ?? 0),
    odemeYontemi: isOdemeYontemiGecerli(String(r.odeme_yontemi ?? "")) ? (String(r.odeme_yontemi) as VekaletTaksitOdeme["odemeYontemi"]) : "NAKIT",
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    smmKesildiMi: Number(r.smm_kesildi_mi) === 1,
    kasaHareketId: r.kasa_hareket_id == null ? null : Number(r.kasa_hareket_id),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function taksitOdemeleri(taksitId: number): VekaletTaksitOdeme[] {
  const rows = getDb()
    .prepare(`SELECT * FROM vekalet_taksit_odeme WHERE taksit_id = ? ORDER BY odeme_tarihi DESC, id DESC`)
    .all(taksitId) as Record<string, unknown>[];
  return rows.map(rowOdeme);
}

function odenenToplamForTaksit(taksitId: number): number {
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM vekalet_taksit_odeme WHERE taksit_id = ?`)
    .get(taksitId) as { s: number };
  return Number(r.s ?? 0);
}

function hesaplaDurum(tutar: number, odenen: number, vadeTarihi: string | null): TaksitDurum {
  const kalan = Math.max(0, tutar - odenen);
  if (odenen <= 0) {
    if (vadeGecmisMi(vadeTarihi) && kalan > 0) return "GECIKTI";
    return "ODENMEDI";
  }
  if (odenen >= tutar - 0.001) return "ODENDI";
  if (vadeGecmisMi(vadeTarihi) && kalan > 0) return "GECIKTI";
  return "KISMI_ODENDI";
}

function vadeGecmisMi(vade: string | null): boolean {
  if (!vade) return false;
  const v = vade.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const bugun = nowIso().slice(0, 10);
  return v < bugun;
}

function hesaplaSmmDurumu(odemeler: VekaletTaksitOdeme[]): { smmDurumu: TaksitSmmDurum; smmBekleyenOdemeId: number | null } {
  if (odemeler.length === 0) return { smmDurumu: "YOK", smmBekleyenOdemeId: null };
  const bekleyen = odemeler.find((o) => !o.smmKesildiMi);
  if (bekleyen) return { smmDurumu: "BEKLIYOR", smmBekleyenOdemeId: bekleyen.id };
  return { smmDurumu: "KESILDI", smmBekleyenOdemeId: null };
}

function enrichTaksit(r: Record<string, unknown>): VekaletTaksit {
  const id = Number(r.id);
  const tutar = Number(r.tutar ?? 0);
  const odemeler = taksitOdemeleri(id);
  const odenenToplam = odemeler.reduce((s, o) => s + o.tutar, 0);
  const kalanTutar = Math.max(0, tutar - odenenToplam);
  const sonOdeme = odemeler[0] ?? null;
  const { smmDurumu, smmBekleyenOdemeId } = hesaplaSmmDurumu(odemeler);
  return {
    id,
    vekaletUcretiId: Number(r.vekalet_ucreti_id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    taksitNo: Number(r.taksit_no),
    tutar,
    vadeTarihi: r.vade_tarihi == null ? null : String(r.vade_tarihi).slice(0, 10),
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
    odenenToplam,
    kalanTutar,
    durum: hesaplaDurum(tutar, odenenToplam, r.vade_tarihi == null ? null : String(r.vade_tarihi).slice(0, 10)),
    smmDurumu,
    sonOdemeTarihi: sonOdeme?.odemeTarihi ?? null,
    sonMakbuzNo: sonOdeme?.makbuzNo ?? null,
    sonOdemeId: sonOdeme?.id ?? null,
    smmBekleyenOdemeId,
  };
}

export function vekaletGetOrCreate(dosyaId: number, muvekkilId: number): VekaletUcreti {
  const d = getDb();
  let r = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`).get(dosyaId) as Record<string, unknown> | undefined;
  if (r) return rowVekalet(r);
  const t = nowIso();
  const ins = d
    .prepare(
      `INSERT INTO anlasilan_vekalet_ucreti (dosya_id, muvekkil_id, anlasilan_tutar, aciklama, kayit_tarihi, guncelleme_tarihi)
       VALUES (?,?,0,NULL,?,?)`
    )
    .run(dosyaId, muvekkilId, t, t);
  r = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(ins.lastInsertRowid) as Record<string, unknown>;
  return rowVekalet(r);
}

export function vekaletByDosya(dosyaId: number): VekaletUcreti | null {
  const r = getDb().prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`).get(dosyaId) as Record<string, unknown> | undefined;
  return r ? rowVekalet(r) : null;
}

export function vekaletOzetHesapla(dosyaId: number): VekaletOzet {
  const v = vekaletByDosya(dosyaId);
  const anlasilanTutar = v?.anlasilanTutar ?? 0;
  const r = getDb()
    .prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM vekalet_taksit_odeme WHERE dosya_id = ?`)
    .get(dosyaId) as { s: number };
  const odenenToplam = Number(r.s ?? 0);
  return {
    anlasilanTutar,
    odenenToplam,
    kalanVekalet: Math.max(0, anlasilanTutar - odenenToplam),
  };
}

export function vekaletKaydet(
  dosyaId: number,
  muvekkilId: number,
  input: VekaletKaydetInput
): VekaletIslemSonuc<VekaletUcreti> {
  if (!Number.isFinite(input.anlasilanTutar) || input.anlasilanTutar <= 0) {
    return { ok: false, error: "Anlaşılan vekalet ücreti sıfırdan büyük olmalıdır" };
  }
  try {
    const base = vekaletGetOrCreate(dosyaId, muvekkilId);
    const row = vekaletGuncelle(base.id, input);
    return row ? { ok: true, row } : { ok: false, error: "Kayıt yapılamadı" };
  } catch (e) {
    console.error("[vekaletKaydet]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Kayıt yapılamadı" };
  }
}

export function vekaletGuncelle(id: number, input: VekaletKaydetInput): VekaletUcreti | null {
  const d = getDb();
  const t = nowIso();
  d.prepare(
    `UPDATE anlasilan_vekalet_ucreti SET anlasilan_tutar = ?, aciklama = ?, guncelleme_tarihi = ? WHERE id = ?`
  ).run(input.anlasilanTutar, input.aciklama ?? null, t, id);
  const r = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? rowVekalet(r) : null;
}

export function vekaletTaksitList(vekaletUcretiId: number): VekaletTaksit[] {
  const rows = getDb()
    .prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE vekalet_ucreti_id = ? ORDER BY taksit_no`)
    .all(vekaletUcretiId) as Record<string, unknown>[];
  return rows.map(enrichTaksit);
}

export function vekaletTaksitEkle(
  vekaletUcretiId: number,
  input: TaksitEkleInput
): VekaletIslemSonuc<VekaletTaksit> {
  const d = getDb();
  const vRow = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(vekaletUcretiId) as Record<string, unknown> | undefined;
  if (!vRow) return { ok: false, error: "Vekalet kaydı bulunamadı" };
  if (Number(vRow.anlasilan_tutar) <= 0) return { ok: false, error: "Önce vekalet ücreti tanımlayın" };
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Taksit tutarı sıfırdan büyük olmalıdır" };
  }
  const dosyaId = Number(vRow.dosya_id);
  const muvekkilId = Number(vRow.muvekkil_id);
  const maxM =
    (d.prepare(`SELECT COALESCE(MAX(taksit_no),0) as m FROM vekalet_ucreti_taksit WHERE vekalet_ucreti_id = ?`).get(vekaletUcretiId) as { m: number }).m + 1;
  const taksitNo =
    input.taksitNo != null && Number.isFinite(input.taksitNo) && input.taksitNo > 0
      ? Math.floor(Number(input.taksitNo))
      : maxM;
  if (taksitNo < 1) return { ok: false, error: "Geçerli taksit numarası girin" };
  const t = nowIso();
  try {
    const r = d
      .prepare(
        `INSERT INTO vekalet_ucreti_taksit (vekalet_ucreti_id, dosya_id, muvekkil_id, taksit_no, tutar, vade_tarihi, aciklama, kayit_tarihi, guncelleme_tarihi)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(
        vekaletUcretiId,
        dosyaId,
        muvekkilId,
        taksitNo,
        input.tutar,
        input.vadeTarihi ?? null,
        input.aciklama ?? null,
        t,
        t
      );
    const row = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(r.lastInsertRowid) as Record<string, unknown>;
    return { ok: true, row: enrichTaksit(row) };
  } catch (e) {
    console.error("[vekaletTaksitEkle]", e);
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { ok: false, error: "Bu taksit numarası bu dosyada zaten kullanılıyor" };
    }
    return { ok: false, error: "Taksit eklenemedi" };
  }
}

export function vekaletTaksitGuncelle(id: number, patch: TaksitGuncelleInput): VekaletIslemSonuc<VekaletTaksit> {
  try {
    const d = getDb();
    const cur = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!cur) return { ok: false, error: "Taksit bulunamadı" };
    const odenen = odenenToplamForTaksit(id);
    let taksitNo = Number(cur.taksit_no);
    if (patch.taksitNo !== undefined) {
      const n = Math.floor(Number(patch.taksitNo));
      if (!Number.isFinite(n) || n < 1) return { ok: false, error: "Geçerli taksit numarası girin" };
      taksitNo = n;
    }
    const tutar = patch.tutar ?? Number(cur.tutar);
    if (tutar < odenen - 0.001) {
      return { ok: false, error: "Taksit tutarı ödenen tutardan küçük olamaz" };
    }
    const vade = patch.vadeTarihi !== undefined ? patch.vadeTarihi : cur.vade_tarihi == null ? null : String(cur.vade_tarihi).slice(0, 10);
    const aciklama = patch.aciklama !== undefined ? patch.aciklama : cur.aciklama == null ? null : String(cur.aciklama);
    const t = nowIso();
    d.prepare(
      `UPDATE vekalet_ucreti_taksit SET taksit_no = ?, tutar = ?, vade_tarihi = ?, aciklama = ?, guncelleme_tarihi = ? WHERE id = ?`
    ).run(taksitNo, tutar, vade, aciklama, t, id);
    const row = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(id) as Record<string, unknown>;
    return { ok: true, row: enrichTaksit(row) };
  } catch (e) {
    console.error("[vekaletTaksitGuncelle]", e);
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { ok: false, error: "Bu taksit numarası bu dosyada zaten kullanılıyor" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Taksit güncellenemedi" };
  }
}

export function vekaletTaksitSil(id: number): { ok: true } | { ok: false; error: string } {
  const d = getDb();
  const cur = d.prepare(`SELECT id FROM vekalet_ucreti_taksit WHERE id = ?`).get(id);
  if (!cur) return { ok: false, error: "Taksit bulunamadı" };
  const odemeSay = d.prepare(`SELECT COUNT(*) AS c FROM vekalet_taksit_odeme WHERE taksit_id = ?`).get(id) as { c: number };
  if (Number(odemeSay.c) > 0) {
    return { ok: false, error: "Ödeme kaydı olan taksit silinemez" };
  }
  d.prepare(`DELETE FROM vekalet_ucreti_taksit WHERE id = ?`).run(id);
  return { ok: true };
}

export function vekaletTaksitOdemeAl(
  taksitId: number,
  input: TaksitOdemeAlInput
): VekaletIslemSonuc<{ taksit: VekaletTaksit; odeme: VekaletTaksitOdeme }> {
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Bugün tahsil edilen tutar sıfırdan büyük olmalıdır" };
  }
  const od = (input.odemeTarihi ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(od)) {
    return { ok: false, error: "Geçerli ödeme tarihi girin" };
  }
  if (!isOdemeYontemiGecerli(input.odemeYontemi)) {
    return { ok: false, error: "Geçersiz ödeme yöntemi" };
  }
  const d = getDb();
  const cur = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown> | undefined;
  if (!cur) return { ok: false, error: "Taksit bulunamadı" };
  const tutar = Number(cur.tutar);
  const odenen = odenenToplamForTaksit(taksitId);
  const kalan = Math.max(0, tutar - odenen);
  if (input.tutar > kalan + 0.001) {
    return { ok: false, error: "Bugün tahsil edilen tutar kalan taksit tutarını aşamaz." };
  }
  const olusturan = olusturanBilgisi();
  const t = nowIso();
  const taksitNo = Number(cur.taksit_no);
  const dosyaId = Number(cur.dosya_id);
  const muvekkilId = Number(cur.muvekkil_id);
  const vekaletId = Number(cur.vekalet_ucreti_id);
  const smmKes = input.smmKesildiMi === true ? 1 : 0;
  const aciklama = (input.aciklama ?? "").trim() || null;
  try {
    const result = d.transaction(() => {
      const kasa = kasaAvansEkleInTx(d, {
        dosyaId,
        muvekkilId,
        tutar: input.tutar,
        tarih: od,
        odemeYontemi: input.odemeYontemi,
        aciklama: `Vekalet taksit #${taksitNo} tahsilatı`,
        t,
        olusturan,
      });
      const rIns = d
        .prepare(
          `INSERT INTO vekalet_taksit_odeme (taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, odeme_yontemi, aciklama, makbuz_no, smm_kesildi_mi, kasa_hareket_id, olusturan_kullanici_id, olusturan_kullanici_adi, kayit_tarihi, guncelleme_tarihi)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          taksitId,
          vekaletId,
          dosyaId,
          muvekkilId,
          od,
          input.tutar,
          input.odemeYontemi,
          aciklama,
          null,
          smmKes,
          kasa.id,
          olusturan.id,
          olusturan.adi,
          t,
          t
        );
      const odemeId = Number(rIns.lastInsertRowid);
      d.prepare(`UPDATE vekalet_ucreti_taksit SET guncelleme_tarihi = ? WHERE id = ?`).run(t, taksitId);
      const odemeRow = d.prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
      const taksitRow = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown>;
      return { odeme: rowOdeme(odemeRow), taksit: enrichTaksit(taksitRow), belgeNo: kasa.belgeNo };
    })();
    return { ok: true, row: { taksit: result.taksit, odeme: result.odeme } };
  } catch (e) {
    console.error("[vekaletTaksitOdemeAl]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme kaydedilemedi" };
  }
}

export function vekaletTaksitOdemeGecmisi(taksitId: number): VekaletTaksitOdeme[] {
  return taksitOdemeleri(taksitId);
}

export function vekaletSmmBekleyenler(dosyaId?: number): SmmBekleyenSatir[] {
  const d = getDb();
  const sql = dosyaId
    ? `SELECT o.id AS odeme_id, o.taksit_id, o.dosya_id, t.taksit_no, o.tutar, o.odeme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       WHERE o.smm_kesildi_mi = 0 AND o.dosya_id = ?
       ORDER BY o.odeme_tarihi DESC, o.id DESC`
    : `SELECT o.id AS odeme_id, o.taksit_id, o.dosya_id, t.taksit_no, o.tutar, o.odeme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       WHERE o.smm_kesildi_mi = 0
       ORDER BY o.odeme_tarihi DESC, o.id DESC`;
  const rows = (dosyaId ? d.prepare(sql).all(dosyaId) : d.prepare(sql).all()) as Record<string, unknown>[];
  return rows.map((r) => ({
    odemeId: Number(r.odeme_id),
    taksitId: Number(r.taksit_id),
    dosyaId: Number(r.dosya_id),
    taksitNo: Number(r.taksit_no),
    tutar: Number(r.tutar),
    odemeTarihi: String(r.odeme_tarihi ?? "").slice(0, 10),
  }));
}

export function vekaletSmmKesildi(odemeId: number): VekaletIslemSonuc<VekaletTaksitOdeme> {
  const d = getDb();
  const cur = d.prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown> | undefined;
  if (!cur) return { ok: false, error: "Ödeme kaydı bulunamadı" };
  if (Number(cur.smm_kesildi_mi) === 1) {
    return { ok: true, row: rowOdeme(cur) };
  }
  const t = nowIso();
  d.prepare(`UPDATE vekalet_taksit_odeme SET smm_kesildi_mi = 1, guncelleme_tarihi = ? WHERE id = ?`).run(t, odemeId);
  const row = d.prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
  return { ok: true, row: rowOdeme(row) };
}
