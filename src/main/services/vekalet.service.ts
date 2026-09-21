import { getDb, nowIso } from "../db/connection";
import { authGetSession } from "./auth.service";
import { writeAuditLog } from "./auditLog.service";
import { ofisKasaVekaletTahsilatEkleInTx } from "./ofisKasa.service";
import { migration009VekaletOfisKasa } from "../migrations/009_vekalet_ofis_kasa";
import { isOdemeYontemiGecerli } from "@shared/constants/kasa";
import type {
  SmmBekleyenSatir,
  TaksitDurum,
  TaksitEkleInput,
  TaksitGuncelleInput,
  TaksitOdemeAlInput,
  TaksitOdemeGuncelleInput,
  TaksitSmmDurum,
  VekaletIslemSonuc,
  VekaletKaydetInput,
  VekaletOzet,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletTaksitUyariOzet,
  VekaletTaksitUyariSatir,
  VekaletTaksitUyariSonuc,
  VekaletUcreti,
} from "@shared/types/vekalet";
import {
  bugunYmdLocal,
  siniflaVekaletTaksitUyari,
  vekaletTaksitUyariSonucFromKayitlar,
} from "@shared/lib/vekaletTaksitUyari";
import { fromKurus, kurusBuyuktur, toKurus } from "@shared/lib/moneyKurus";
import {
  resolveParaBirimi,
  resolvePaymentAmounts,
  tryResolveParaBirimi,
} from "@shared/lib/paraBirimi";
import {
  isTahsilatOdemeAktifRow,
  ODEME_AKTIF_OFIS_SQL,
  TAKSIT_AKTIF_SQL,
  VEKALET_AKTIF_SQL,
} from "@shared/lib/tahsilatOdemeAktif";

function ensureVekaletOfisKasaSchema(d: ReturnType<typeof getDb>): void {
  migration009VekaletOfisKasa.up(d);
}

function formatTryTr(n: number): string {
  return (
    n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺"
  );
}

/** Anlaşılan − mevcut taksit tutarları toplamı (hariç tutulacak taksit opsiyonel). Kuruş güvenli. */
function planlanabilirKalanTl(
  d: ReturnType<typeof getDb>,
  vekaletUcretiId: number,
  anlasilanTl: number,
  haricTaksitId?: number
): number {
  const row = (
    haricTaksitId != null
      ? d
          .prepare(
            `SELECT COALESCE(SUM(tutar), 0) AS s FROM vekalet_ucreti_taksit t
             WHERE t.vekalet_ucreti_id = ? AND t.id != ? AND ${TAKSIT_AKTIF_SQL}`
          )
          .get(vekaletUcretiId, haricTaksitId)
      : d
          .prepare(
            `SELECT COALESCE(SUM(tutar), 0) AS s FROM vekalet_ucreti_taksit t WHERE t.vekalet_ucreti_id = ? AND ${TAKSIT_AKTIF_SQL}`
          )
          .get(vekaletUcretiId)
  ) as { s: number };
  const mevcut = Number(row.s ?? 0);
  return fromKurus(Math.max(0, toKurus(anlasilanTl) - toKurus(mevcut)));
}

function olusturanBilgisi(): { id: number | null; adi: string | null } {
  const u = authGetSession();
  if (!u) return { id: null, adi: null };
  return { id: u.id, adi: u.adSoyad?.trim() || u.kullaniciAdi };
}

function muvekkilGorunenAdInTx(d: ReturnType<typeof getDb>, muvekkilId: number): string {
  const r = d
    .prepare(`SELECT muvekkil_turu, ad_soyad, sirket_unvani FROM muvekkil WHERE id = ?`)
    .get(muvekkilId) as { muvekkil_turu: string; ad_soyad: string; sirket_unvani: string | null } | undefined;
  if (!r) return "—";
  if (r.muvekkil_turu === "TUZEL_KISI") {
    const unvan = (r.sirket_unvani ?? "").trim();
    if (unvan) return unvan;
  }
  const ad = (r.ad_soyad ?? "").trim();
  return ad || "—";
}

function dosyaKonuBasligiInTx(d: ReturnType<typeof getDb>, dosyaId: number): string {
  const r = d.prepare(`SELECT konu_basligi FROM dosya WHERE id = ?`).get(dosyaId) as { konu_basligi: string | null } | undefined;
  const konu = (r?.konu_basligi ?? "").trim();
  return konu || "—";
}

function rowVekalet(r: Record<string, unknown>): VekaletUcreti {
  return {
    id: Number(r.id),
    dosyaId: Number(r.dosya_id),
    muvekkilId: Number(r.muvekkil_id),
    anlasilanTutar: Number(r.anlasilan_tutar ?? 0),
    paraBirimi: tryResolveParaBirimi(r.para_birimi),
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
    kasaTutari: Number(r.kasa_tutari ?? r.tutar ?? 0),
    alacakParaBirimi: tryResolveParaBirimi(r.alacak_para_birimi),
    odemeParaBirimi: tryResolveParaBirimi(r.odeme_para_birimi),
    kur: r.kur == null ? null : Number(r.kur),
    kurBazParaBirimi: r.kur_baz_para_birimi == null ? null : tryResolveParaBirimi(r.kur_baz_para_birimi),
    kurKarsiParaBirimi: r.kur_karsi_para_birimi == null ? null : tryResolveParaBirimi(r.kur_karsi_para_birimi),
    kurKaynagi: r.kur_kaynagi === "TCMB" || r.kur_kaynagi === "MANUEL" ? r.kur_kaynagi : null,
    tcmbKurTarihi: r.tcmb_kur_tarihi == null ? null : String(r.tcmb_kur_tarihi),
    tcmbReferansKur: r.tcmb_referans_kur == null ? null : Number(r.tcmb_referans_kur),
    odemeYontemi: isOdemeYontemiGecerli(String(r.odeme_yontemi ?? "")) ? (String(r.odeme_yontemi) as VekaletTaksitOdeme["odemeYontemi"]) : "NAKIT",
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    smmKesildiMi: Number(r.smm_kesildi_mi) === 1,
    kasaHareketId: r.kasa_hareket_id == null ? null : Number(r.kasa_hareket_id),
    ofisKasaHareketId: r.ofis_kasa_hareket_id == null ? null : Number(r.ofis_kasa_hareket_id),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    makbuzDurumu: String(r.makbuz_durumu ?? "AKTIF") === "IPTAL" ? "IPTAL" : "AKTIF",
    iptalTarihi: r.iptal_tarihi == null ? null : String(r.iptal_tarihi),
    iptalEdenKullaniciId: r.iptal_eden_kullanici_id == null ? null : Number(r.iptal_eden_kullanici_id),
    iptalNedeni: r.iptal_nedeni == null ? null : String(r.iptal_nedeni),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function taksitOdemeleriAll(taksitId: number): VekaletTaksitOdeme[] {
  const rows = getDb()
    .prepare(
      `SELECT o.*,
        ok.silinme_tarihi AS ofis_silinme_tarihi,
        dk.silinme_tarihi AS kasa_silinme_tarihi
       FROM vekalet_taksit_odeme o
       LEFT JOIN ofis_kasa_hareketleri ok ON ok.id = o.ofis_kasa_hareket_id
       LEFT JOIN dosya_kasa_hareket dk ON dk.id = o.kasa_hareket_id
       WHERE o.taksit_id = ?
       ORDER BY o.odeme_tarihi DESC, o.id DESC`,
    )
    .all(taksitId) as Record<string, unknown>[];
  return rows.map(rowOdeme);
}

function aktifOdemelerForTaksit(taksitId: number): VekaletTaksitOdeme[] {
  return taksitOdemeleriAll(taksitId).filter((o) =>
    isTahsilatOdemeAktifRow({
      makbuz_durumu: o.makbuzDurumu,
      iptal_tarihi: o.iptalTarihi,
    }),
  );
}

function odenenToplamForTaksit(taksitId: number): number {
  const r = getDb()
    .prepare(
      `SELECT COALESCE(SUM(o.tutar), 0) AS s FROM vekalet_taksit_odeme o
       WHERE o.taksit_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
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
  const odemeler = aktifOdemelerForTaksit(id);
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
    paraBirimi: tryResolveParaBirimi(r.para_birimi),
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
  let r = d
    .prepare(`SELECT * FROM anlasilan_vekalet_ucreti v WHERE v.dosya_id = ? AND ${VEKALET_AKTIF_SQL}`)
    .get(dosyaId) as Record<string, unknown> | undefined;
  if (r) return rowVekalet(r);
  const t = nowIso();
  const ins = d
    .prepare(
      `INSERT INTO anlasilan_vekalet_ucreti (dosya_id, muvekkil_id, anlasilan_tutar, para_birimi, aciklama, kayit_tarihi, guncelleme_tarihi)
       VALUES (?,?,0,'TRY',NULL,?,?)`
    )
    .run(dosyaId, muvekkilId, t, t);
  r = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(ins.lastInsertRowid) as Record<string, unknown>;
  return rowVekalet(r);
}

export function vekaletByDosya(dosyaId: number): VekaletUcreti | null {
  const r = getDb()
    .prepare(`SELECT * FROM anlasilan_vekalet_ucreti v WHERE v.dosya_id = ? AND ${VEKALET_AKTIF_SQL}`)
    .get(dosyaId) as Record<string, unknown> | undefined;
  return r ? rowVekalet(r) : null;
}

export function vekaletOzetHesapla(dosyaId: number): VekaletOzet {
  const v = vekaletByDosya(dosyaId);
  const anlasilanTutar = v?.anlasilanTutar ?? 0;
  const r = getDb()
    .prepare(
      `SELECT COALESCE(SUM(o.tutar), 0) AS s FROM vekalet_taksit_odeme o
       WHERE o.dosya_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
    .get(dosyaId) as { s: number };
  const odenenToplam = Number(r.s ?? 0);
  return {
    paraBirimi: v?.paraBirimi ?? "TRY",
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
  const current = d.prepare(`SELECT para_birimi FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(id) as
    | { para_birimi: string }
    | undefined;
  if (!current) return null;
  const paraBirimi = resolveParaBirimi(input.paraBirimi ?? current.para_birimi);
  if (paraBirimi !== tryResolveParaBirimi(current.para_birimi)) {
    const paid = d
      .prepare(`SELECT 1 AS x FROM vekalet_taksit_odeme o WHERE o.vekalet_id = ? AND ${ODEME_AKTIF_OFIS_SQL} LIMIT 1`)
      .get(id);
    if (paid) throw new Error("Tahsilat bulunduğu için para birimi değiştirilemez");
  }
  d.prepare(
    `UPDATE anlasilan_vekalet_ucreti SET anlasilan_tutar = ?, para_birimi = ?, aciklama = ?, guncelleme_tarihi = ? WHERE id = ?`
  ).run(input.anlasilanTutar, paraBirimi, input.aciklama ?? null, t, id);
  const r = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? rowVekalet(r) : null;
}

export function vekaletTaksitList(vekaletUcretiId: number): VekaletTaksit[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM vekalet_ucreti_taksit t
       WHERE t.vekalet_ucreti_id = ? AND ${TAKSIT_AKTIF_SQL}
       ORDER BY date(substr(coalesce(vade_tarihi,''),1,10)) ASC,
                taksit_no ASC,
                id ASC`,
    )
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
  const anlasilan = Number(vRow.anlasilan_tutar);
  if (anlasilan <= 0) return { ok: false, error: "Önce vekalet ücreti tanımlayın" };
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Taksit tutarı sıfırdan büyük olmalıdır" };
  }
  const kalan = planlanabilirKalanTl(d, vekaletUcretiId, anlasilan);
  if (kurusBuyuktur(input.tutar, kalan)) {
    return {
      ok: false,
      error: `Taksit tutarı, taksitlendirilebilir kalan ${formatTryTr(kalan)} tutarını aşamaz.`,
    };
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
    const tx = d.transaction(() => {
      const kalanTx = planlanabilirKalanTl(d, vekaletUcretiId, anlasilan);
      if (kurusBuyuktur(input.tutar, kalanTx)) {
        throw new Error(
          `Taksit tutarı, taksitlendirilebilir kalan ${formatTryTr(kalanTx)} tutarını aşamaz.`
        );
      }
      const r = d
        .prepare(
          `INSERT INTO vekalet_ucreti_taksit (vekalet_ucreti_id, dosya_id, muvekkil_id, taksit_no, tutar, para_birimi, vade_tarihi, aciklama, kayit_tarihi, guncelleme_tarihi)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          vekaletUcretiId,
          dosyaId,
          muvekkilId,
          taksitNo,
          input.tutar,
          tryResolveParaBirimi(vRow.para_birimi),
          input.vadeTarihi ?? null,
          input.aciklama ?? null,
          t,
          t
        );
      return d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(r.lastInsertRowid) as Record<string, unknown>;
    });
    const row = tx();
    return { ok: true, row: enrichTaksit(row) };
  } catch (e) {
    console.error("[vekaletTaksitEkle]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("taksitlendirilebilir kalan")) {
      return { ok: false, error: msg };
    }
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
    const vekaletUcretiId = Number(cur.vekalet_ucreti_id);
    const vRow = d.prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(vekaletUcretiId) as
      | Record<string, unknown>
      | undefined;
    if (!vRow) return { ok: false, error: "Vekalet kaydı bulunamadı" };
    const anlasilan = Number(vRow.anlasilan_tutar);
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
    const kalan = planlanabilirKalanTl(d, vekaletUcretiId, anlasilan, id);
    if (kurusBuyuktur(tutar, kalan)) {
      return {
        ok: false,
        error: `Taksit tutarı, taksitlendirilebilir kalan ${formatTryTr(kalan)} tutarını aşamaz.`,
      };
    }
    const vade = patch.vadeTarihi !== undefined ? patch.vadeTarihi : cur.vade_tarihi == null ? null : String(cur.vade_tarihi).slice(0, 10);
    const aciklama = patch.aciklama !== undefined ? patch.aciklama : cur.aciklama == null ? null : String(cur.aciklama);
    const t = nowIso();
    const tx = d.transaction(() => {
      const kalanTx = planlanabilirKalanTl(d, vekaletUcretiId, anlasilan, id);
      if (kurusBuyuktur(tutar, kalanTx)) {
        throw new Error(
          `Taksit tutarı, taksitlendirilebilir kalan ${formatTryTr(kalanTx)} tutarını aşamaz.`
        );
      }
      d.prepare(
        `UPDATE vekalet_ucreti_taksit SET taksit_no = ?, tutar = ?, vade_tarihi = ?, aciklama = ?, guncelleme_tarihi = ? WHERE id = ?`
      ).run(taksitNo, tutar, vade, aciklama, t, id);
      return d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(id) as Record<string, unknown>;
    });
    const row = tx();
    return { ok: true, row: enrichTaksit(row) };
  } catch (e) {
    console.error("[vekaletTaksitGuncelle]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("taksitlendirilebilir kalan")) {
      return { ok: false, error: msg };
    }
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

const TOPLU_SIL_ODENE_ENGEL =
  "Ödeme alınmış taksitler bulunduğu için taksitlerin tamamı silinemez. Önce ilgili ödeme kayıtları mevcut kurallara göre düzeltilmelidir.";

/** Aynı vekalet ücretine ait tüm taksitleri siler; ödeme/SMM/makbuz/ofis bağlantısı varsa reddeder. */
export function vekaletTaksitleriTopluSil(
  vekaletUcretiId: number
): { ok: true; silinenAdet: number } | { ok: false; error: string } {
  if (!Number.isFinite(vekaletUcretiId) || vekaletUcretiId <= 0) {
    return { ok: false, error: "Geçersiz vekalet kaydı" };
  }
  const d = getDb();
  const vRow = d.prepare(`SELECT id FROM anlasilan_vekalet_ucreti WHERE id = ?`).get(vekaletUcretiId) as
    | { id: number }
    | undefined;
  if (!vRow) return { ok: false, error: "Vekalet kaydı bulunamadı" };

  try {
    const tx = d.transaction(() => {
      const adetRow = d
        .prepare(`SELECT COUNT(*) AS c FROM vekalet_ucreti_taksit WHERE vekalet_ucreti_id = ?`)
        .get(vekaletUcretiId) as { c: number };
      const adet = Number(adetRow.c ?? 0);
      if (adet <= 0) {
        throw new Error("Silinecek taksit bulunamadı");
      }

      const odemeRow = d
        .prepare(
          `SELECT COUNT(*) AS c
           FROM vekalet_taksit_odeme o
           INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
           WHERE t.vekalet_ucreti_id = ?`
        )
        .get(vekaletUcretiId) as { c: number };
      if (Number(odemeRow.c ?? 0) > 0) {
        throw new Error(TOPLU_SIL_ODENE_ENGEL);
      }

      // Ek güvenlik: ofis kasa / makbuz / SMM alanları da ödeme satırında; yukarıdaki COUNT yeterlidir.
      const r = d.prepare(`DELETE FROM vekalet_ucreti_taksit WHERE vekalet_ucreti_id = ?`).run(vekaletUcretiId);
      return Number(r.changes ?? 0);
    });
    const silinenAdet = tx();
    return { ok: true, silinenAdet };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Taksitler silinemedi";
    if (msg === TOPLU_SIL_ODENE_ENGEL || msg === "Silinecek taksit bulunamadı") {
      return { ok: false, error: msg };
    }
    console.error("[vekaletTaksitleriTopluSil]", e);
    return { ok: false, error: "Taksitler silinemedi" };
  }
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
  ensureVekaletOfisKasaSchema(d);
  const cur = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown> | undefined;
  if (!cur) return { ok: false, error: "Taksit bulunamadı" };
  const tutar = Number(cur.tutar);
  const odenen = odenenToplamForTaksit(taksitId);
  const kalan = Math.max(0, tutar - odenen);
  let payment: ReturnType<typeof resolvePaymentAmounts>;
  try {
    payment = resolvePaymentAmounts({
      alacakParaBirimi: tryResolveParaBirimi(cur.para_birimi),
      mahsupTutari: input.tutar,
      kasaTutari: input.kasaTutari,
      odemeParaBirimi: input.odemeParaBirimi,
      kalanBorc: kalan,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme tutarları geçersiz." };
  }
  const olusturan = olusturanBilgisi();
  const t = nowIso();
  const taksitNo = Number(cur.taksit_no);
  const dosyaId = Number(cur.dosya_id);
  const muvekkilId = Number(cur.muvekkil_id);
  const vekaletId = Number(cur.vekalet_ucreti_id);
  const smmKes = input.smmKesildiMi === true ? 1 : 0;
  const aciklama = (input.aciklama ?? "").trim() || null;
  const muvekkilAd = muvekkilGorunenAdInTx(d, muvekkilId);
  const dosyaKonu = dosyaKonuBasligiInTx(d, dosyaId);
  const ofisAciklama = `Vekalet tahsilatı - ${muvekkilAd} - ${dosyaKonu} - Taksit No: ${taksitNo}`;
  try {
    const result = d.transaction(() => {
      const rIns = d
        .prepare(
          `INSERT INTO vekalet_taksit_odeme (
             taksit_id, vekalet_id, dosya_id, muvekkil_id, odeme_tarihi, tutar, kasa_tutari,
             alacak_para_birimi, odeme_para_birimi, kur, kur_baz_para_birimi, kur_karsi_para_birimi,
             kur_kaynagi, tcmb_kur_tarihi, tcmb_referans_kur, odeme_yontemi, aciklama, makbuz_no,
             smm_kesildi_mi, kasa_hareket_id, ofis_kasa_hareket_id, olusturan_kullanici_id,
             olusturan_kullanici_adi, kayit_tarihi, guncelleme_tarihi
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          taksitId,
          vekaletId,
          dosyaId,
          muvekkilId,
          od,
          payment.mahsupTutari,
          payment.kasaTutari,
          payment.alacakParaBirimi,
          payment.odemeParaBirimi,
          payment.kur,
          payment.kurBazParaBirimi,
          payment.kurKarsiParaBirimi,
          payment.isCrossCurrency ? (input.kurKaynagi ?? "MANUEL") : null,
          payment.isCrossCurrency ? (input.tcmbKurTarihi ?? null) : null,
          payment.isCrossCurrency ? (input.tcmbReferansKur ?? null) : null,
          input.odemeYontemi,
          aciklama,
          null,
          smmKes,
          null,
          null,
          olusturan.id,
          olusturan.adi,
          t,
          t
        );
      const odemeId = Number(rIns.lastInsertRowid);
      const ofisKasaId = ofisKasaVekaletTahsilatEkleInTx(d, {
        vekaletOdemeId: odemeId,
        tutar: payment.kasaTutari,
        paraBirimi: payment.odemeParaBirimi,
        tarih: od,
        odemeYontemi: input.odemeYontemi,
        aciklama: ofisAciklama,
        not: aciklama,
        olusturanKullaniciId: olusturan.id,
        olusturanKullaniciAdi: olusturan.adi,
        t,
      });
      d.prepare(`UPDATE vekalet_taksit_odeme SET ofis_kasa_hareket_id = ? WHERE id = ?`).run(ofisKasaId, odemeId);
      d.prepare(`UPDATE vekalet_ucreti_taksit SET guncelleme_tarihi = ? WHERE id = ?`).run(t, taksitId);
      const odemeRow = d.prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
      if (odemeRow.kasa_hareket_id != null) {
        throw new Error("Vekalet tahsilatı dosya kasasına yazılamaz");
      }
      if (odemeRow.ofis_kasa_hareket_id == null) {
        throw new Error("Vekalet tahsilatı Ofis Kasası kaydı oluşturulamadı");
      }
      const taksitRow = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown>;
      return { odeme: rowOdeme(odemeRow), taksit: enrichTaksit(taksitRow) };
    })();
    return { ok: true, row: { taksit: result.taksit, odeme: result.odeme } };
  } catch (e) {
    console.error("[vekaletTaksitOdemeAl]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme kaydedilemedi" };
  }
}

export function vekaletTaksitOdemeGecmisi(taksitId: number): VekaletTaksitOdeme[] {
  return taksitOdemeleriAll(taksitId);
}

/** SaaS `assertOfisHareketGuncellenebilir` paritesi. */
export const ONAYLI_TAHSILAT_LOCKED_MESAJ =
  "Onaylanmış tahsilat doğrudan değiştirilemez. Önce mevcut tahsilatı güvenli biçimde silip doğru bilgilerle yeniden kaydedin.";

/** Taksit kalanı bu ödeme hariç hesaplanır — kendi tutarı limiti daraltmasın. */
function odenenToplamDigerOdemeler(
  d: ReturnType<typeof getDb>,
  taksitId: number,
  haricOdemeId: number,
): number {
  const r = d
    .prepare(
      `SELECT COALESCE(SUM(o.tutar), 0) AS s FROM vekalet_taksit_odeme o
       WHERE o.taksit_id = ? AND o.id != ? AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
    .get(taksitId, haricOdemeId) as { s: number };
  return Number(r.s ?? 0);
}

/**
 * Tahsilat düzenleme — tutar / tarih / yöntem / açıklama / para birimi (çapraz kur dahil).
 * Makbuz no, SMM durumu ve TCMB kur anlık görüntüsü korunur; onaylı ofis kaydına bağlı
 * tahsilat değiştirilemez (önce güvenli iptal).
 */
export function vekaletTaksitOdemeGuncelle(
  odemeId: number,
  input: TaksitOdemeGuncelleInput,
): VekaletIslemSonuc<{ taksit: VekaletTaksit; odeme: VekaletTaksitOdeme }> {
  const d = getDb();
  ensureVekaletOfisKasaSchema(d);
  const cur = d
    .prepare(
      `SELECT o.*,
        t.tutar AS taksit_tutar,
        t.para_birimi AS taksit_para_birimi,
        t.taksit_no AS taksit_no,
        COALESCE(t.odeme_durumu, 'AKTIF') AS taksit_odeme_durumu,
        ok.onay_durumu AS ofis_onay_durumu,
        ok.silinme_tarihi AS ofis_silinme_tarihi,
        dk.silinme_tarihi AS kasa_silinme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       LEFT JOIN ofis_kasa_hareketleri ok ON ok.id = o.ofis_kasa_hareket_id
       LEFT JOIN dosya_kasa_hareket dk ON dk.id = o.kasa_hareket_id
       WHERE o.id = ?`,
    )
    .get(odemeId) as Record<string, unknown> | undefined;
  if (!cur) return { ok: false, error: "Ödeme kaydı bulunamadı" };

  if (String(cur.taksit_odeme_durumu) === "IPTAL") {
    return { ok: false, error: "İptal edilmiş taksitin tahsilatı düzenlenemez" };
  }
  if (
    !isTahsilatOdemeAktifRow({
      makbuz_durumu: cur.makbuz_durumu == null ? null : String(cur.makbuz_durumu),
      iptal_tarihi: cur.iptal_tarihi == null ? null : String(cur.iptal_tarihi),
      ofis_silinme_tarihi: cur.ofis_silinme_tarihi == null ? null : String(cur.ofis_silinme_tarihi),
      kasa_silinme_tarihi: cur.kasa_silinme_tarihi == null ? null : String(cur.kasa_silinme_tarihi),
    })
  ) {
    return { ok: false, error: "İptal edilmiş tahsilat düzenlenemez" };
  }
  if (String(cur.ofis_onay_durumu ?? "") === "ONAYLI") {
    return { ok: false, error: ONAYLI_TAHSILAT_LOCKED_MESAJ };
  }

  const taksitId = Number(cur.taksit_id);
  const od = (input.odemeTarihi ?? String(cur.odeme_tarihi ?? "")).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(od)) {
    return { ok: false, error: "Geçerli ödeme tarihi girin" };
  }
  const odemeYontemi = input.odemeYontemi ?? String(cur.odeme_yontemi ?? "");
  if (!isOdemeYontemiGecerli(odemeYontemi)) {
    return { ok: false, error: "Geçersiz ödeme yöntemi" };
  }

  const alacakParaBirimi = tryResolveParaBirimi(cur.taksit_para_birimi);
  const odemeParaBirimi = input.odemeParaBirimi
    ? tryResolveParaBirimi(input.odemeParaBirimi)
    : tryResolveParaBirimi(cur.odeme_para_birimi);
  const kalan = Math.max(
    0,
    Number(cur.taksit_tutar ?? 0) - odenenToplamDigerOdemeler(d, taksitId, odemeId),
  );
  let payment: ReturnType<typeof resolvePaymentAmounts>;
  try {
    payment = resolvePaymentAmounts({
      alacakParaBirimi,
      mahsupTutari: input.tutar ?? Number(cur.tutar ?? 0),
      odemeParaBirimi,
      kasaTutari:
        input.kasaTutari ??
        (odemeParaBirimi === alacakParaBirimi ? undefined : Number(cur.kasa_tutari ?? cur.tutar ?? 0)),
      kalanBorc: kalan,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme tutarları geçersiz." };
  }

  const aciklama =
    input.aciklama === undefined
      ? cur.aciklama == null
        ? null
        : String(cur.aciklama)
      : (input.aciklama ?? "").trim() || null;
  const t = nowIso();
  const ofisKasaHareketId = cur.ofis_kasa_hareket_id == null ? null : Number(cur.ofis_kasa_hareket_id);
  const oncekiOzet = {
    tutar: Number(cur.tutar ?? 0),
    kasaTutari: Number(cur.kasa_tutari ?? cur.tutar ?? 0),
    odemeParaBirimi: tryResolveParaBirimi(cur.odeme_para_birimi),
    odemeTarihi: String(cur.odeme_tarihi ?? "").slice(0, 10),
    odemeYontemi: String(cur.odeme_yontemi ?? ""),
    aciklama: cur.aciklama == null ? null : String(cur.aciklama),
  };

  try {
    const result = d.transaction(() => {
      // TCMB anlık görüntüsü (kur_kaynagi / tcmb_*), makbuz no ve SMM alanları korunur.
      d.prepare(
        `UPDATE vekalet_taksit_odeme
         SET odeme_tarihi = ?, tutar = ?, kasa_tutari = ?, alacak_para_birimi = ?, odeme_para_birimi = ?,
             kur = ?, kur_baz_para_birimi = ?, kur_karsi_para_birimi = ?,
             odeme_yontemi = ?, aciklama = ?, guncelleme_tarihi = ?
         WHERE id = ?`,
      ).run(
        od,
        payment.mahsupTutari,
        payment.kasaTutari,
        payment.alacakParaBirimi,
        payment.odemeParaBirimi,
        payment.kur,
        payment.kurBazParaBirimi,
        payment.kurKarsiParaBirimi,
        odemeYontemi,
        aciklama,
        t,
        odemeId,
      );

      if (ofisKasaHareketId != null) {
        const ofisGuncel = d
          .prepare(
            `UPDATE ofis_kasa_hareketleri
             SET tutar = ?, para_birimi = ?, tarih = ?, odeme_yontemi = ?, not_metni = ?,
                 kur = ?, kur_baz_para_birimi = ?, kur_karsi_para_birimi = ?, guncelleme_tarihi = ?
             WHERE id = ? AND onay_durumu = 'ONAYSIZ' AND silinme_tarihi IS NULL`,
          )
          .run(
            payment.kasaTutari,
            payment.odemeParaBirimi,
            od,
            odemeYontemi,
            aciklama,
            payment.kur,
            payment.kurBazParaBirimi,
            payment.kurKarsiParaBirimi,
            t,
            ofisKasaHareketId,
          );
        if (Number(ofisGuncel.changes ?? 0) !== 1) {
          throw new Error(ONAYLI_TAHSILAT_LOCKED_MESAJ);
        }
      }

      // Taksit ödeme durumu türetilmiş alan — damga güncellenir, liste yeniden hesaplar.
      d.prepare(`UPDATE vekalet_ucreti_taksit SET guncelleme_tarihi = ? WHERE id = ?`).run(t, taksitId);

      const odemeRow = d.prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
      const taksitRow = d.prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown>;
      return { odeme: rowOdeme(odemeRow), taksit: enrichTaksit(taksitRow) };
    })();

    const olusturan = olusturanBilgisi();
    writeAuditLog({
      kullaniciId: olusturan.id,
      kullaniciAdi: olusturan.adi,
      eylem: "VEKALET_TAHSILAT_GUNCELLENDI",
      varlikTipi: "vekalet_taksit_odeme",
      varlikId: String(odemeId),
      ozet: `Taksit #${Number(cur.taksit_no)} tahsilatı güncellendi.`,
      detay: {
        taksitId,
        taksitNo: Number(cur.taksit_no),
        makbuzNo: cur.makbuz_no == null ? null : String(cur.makbuz_no),
        ofisKasaHareketId,
        onceki: oncekiOzet,
        yeni: {
          tutar: result.odeme.tutar,
          kasaTutari: result.odeme.kasaTutari,
          odemeParaBirimi: result.odeme.odemeParaBirimi,
          odemeTarihi: result.odeme.odemeTarihi,
          odemeYontemi: result.odeme.odemeYontemi,
          aciklama: result.odeme.aciklama,
        },
      },
    });

    return { ok: true, row: { taksit: result.taksit, odeme: result.odeme } };
  } catch (e) {
    console.error("[vekaletTaksitOdemeGuncelle]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Tahsilat güncellenemedi" };
  }
}

function muvekkilAdFromRow(r: {
  muvekkil_turu: string;
  ad_soyad: string | null;
  sirket_unvani: string | null;
}): string {
  if (r.muvekkil_turu === "TUZEL_KISI") {
    const unvan = (r.sirket_unvani ?? "").trim();
    if (unvan) return unvan;
  }
  const ad = (r.ad_soyad ?? "").trim();
  return ad || "—";
}

/** Ana sayfa taksit uyarıları — tüm vekalet taksitleri (kalan > 0). */
export function vekaletTaksitUyariOzet(): VekaletTaksitUyariSonuc {
  const d = getDb();
  const bugun = bugunYmdLocal();
  const rows = d
    .prepare(
      `SELECT t.id AS taksit_id,
        t.taksit_no,
        t.vade_tarihi,
        t.tutar,
        v.dosya_id,
        v.muvekkil_id,
        d.konu_basligi,
        m.muvekkil_turu,
        m.ad_soyad,
        m.sirket_unvani,
        COALESCE((SELECT SUM(o.tutar) FROM vekalet_taksit_odeme o WHERE o.taksit_id = t.id AND ${ODEME_AKTIF_OFIS_SQL}), 0) AS odenen
       FROM vekalet_ucreti_taksit t
       INNER JOIN anlasilan_vekalet_ucreti v ON v.id = t.vekalet_ucreti_id
       WHERE ${TAKSIT_AKTIF_SQL} AND ${VEKALET_AKTIF_SQL}
       INNER JOIN dosya d ON d.id = v.dosya_id
       INNER JOIN muvekkil m ON m.id = v.muvekkil_id`,
    )
    .all() as {
    taksit_id: number;
    taksit_no: number;
    vade_tarihi: string | null;
    tutar: number;
    dosya_id: number;
    muvekkil_id: number;
    konu_basligi: string | null;
    muvekkil_turu: string;
    ad_soyad: string | null;
    sirket_unvani: string | null;
    odenen: number;
  }[];

  const kayitlar = rows.map((r) => {
    const kalan = Math.max(0, Number(r.tutar ?? 0) - Number(r.odenen ?? 0));
    const vade = r.vade_tarihi == null ? null : String(r.vade_tarihi).slice(0, 10);
    const sinif = siniflaVekaletTaksitUyari(vade, kalan, bugun);
    const satir: VekaletTaksitUyariSatir | null =
      sinif === "vadesiGecmis"
        ? {
            taksitId: Number(r.taksit_id),
            dosyaId: Number(r.dosya_id),
            muvekkilId: Number(r.muvekkil_id),
            muvekkilAdi: muvekkilAdFromRow(r),
            dosyaKonu: (r.konu_basligi ?? "").trim() || "—",
            taksitNo: Number(r.taksit_no),
            vadeTarihi: vade,
            tutar: Number(r.tutar ?? 0),
            odenen: Number(r.odenen ?? 0),
            kalan,
            durum: "GECIKTI",
          }
        : null;
    return { sinif, satir };
  });

  return vekaletTaksitUyariSonucFromKayitlar(kayitlar);
}

export function vekaletSmmBekleyenler(dosyaId?: number): SmmBekleyenSatir[] {
  const d = getDb();
  const sql = dosyaId
    ? `SELECT o.id AS odeme_id, o.taksit_id, o.dosya_id, t.taksit_no, o.tutar, o.odeme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       WHERE o.smm_kesildi_mi = 0 AND o.dosya_id = ? AND ${ODEME_AKTIF_OFIS_SQL}
       ORDER BY o.odeme_tarihi DESC, o.id DESC`
    : `SELECT o.id AS odeme_id, o.taksit_id, o.dosya_id, t.taksit_no, o.tutar, o.odeme_tarihi
       FROM vekalet_taksit_odeme o
       INNER JOIN vekalet_ucreti_taksit t ON t.id = o.taksit_id
       WHERE o.smm_kesildi_mi = 0 AND ${ODEME_AKTIF_OFIS_SQL}
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
