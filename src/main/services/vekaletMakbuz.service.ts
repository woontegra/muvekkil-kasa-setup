import { getDb, nowIso } from "../db/connection";
import type { MakbuzEnsureSonuc, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import { dosyaGet } from "./dosya.service";
import { muvekkilGet } from "./muvekkil.service";
import { officeSettingsGetForMakbuz } from "./office.service";
import {
  vekaletTaksitList,
} from "./vekalet.service";
import { tryResolveParaBirimi } from "@shared/lib/paraBirimi";

function bugunYmd(): string {
  return nowIso().slice(0, 10);
}

function rowOdemeRaw(r: Record<string, unknown>) {
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
    kurKaynagi:
      r.kur_kaynagi === "TCMB" || r.kur_kaynagi === "MANUEL"
        ? (r.kur_kaynagi as import("@shared/lib/paraBirimi").KurKaynagi)
        : null,
    tcmbKurTarihi: r.tcmb_kur_tarihi == null ? null : String(r.tcmb_kur_tarihi),
    tcmbReferansKur: r.tcmb_referans_kur == null ? null : Number(r.tcmb_referans_kur),
    odemeYontemi: String(r.odeme_yontemi ?? "NAKIT") as import("@shared/types/vekalet").VekaletTaksitOdeme["odemeYontemi"],
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    smmKesildiMi: Number(r.smm_kesildi_mi) === 1,
    kasaHareketId: r.kasa_hareket_id == null ? null : Number(r.kasa_hareket_id),
    ofisKasaHareketId: r.ofis_kasa_hareket_id == null ? null : Number(r.ofis_kasa_hareket_id),
    olusturanKullaniciId: r.olusturan_kullanici_id == null ? null : Number(r.olusturan_kullanici_id),
    olusturanKullaniciAdi: r.olusturan_kullanici_adi == null ? null : String(r.olusturan_kullanici_adi),
    kayitTarihi: String(r.kayit_tarihi ?? ""),
    guncellemeTarihi: String(r.guncelleme_tarihi ?? ""),
  };
}

function odemeGet(odemeId: number) {
  const r = getDb().prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as
    | Record<string, unknown>
    | undefined;
  return r ? rowOdemeRaw(r) : null;
}

export function ensureVekaletReceiptNumberForOdeme(odemeId: number): MakbuzEnsureSonuc {
  const cur = odemeGet(odemeId);
  if (!cur) return { ok: false, error: "Ödeme kaydı bulunamadı" };
  if (cur.makbuzNo?.trim()) return { ok: true, makbuzNo: cur.makbuzNo.trim() };
  const yil = new Date().getFullYear();
  const makbuzGun = bugunYmd();
  const d = getDb();
  const t = nowIso();
  try {
    const makbuzNo = d.transaction(() => {
      const row = d.prepare(`SELECT son_sira FROM vekalet_makbuz_sayac WHERE yil = ?`).get(yil) as
        | { son_sira: number }
        | undefined;
      const next = (row?.son_sira ?? 0) + 1;
      if (row) {
        d.prepare(`UPDATE vekalet_makbuz_sayac SET son_sira = ? WHERE yil = ?`).run(next, yil);
      } else {
        d.prepare(`INSERT INTO vekalet_makbuz_sayac (yil, son_sira) VALUES (?, ?)`).run(yil, next);
      }
      const no = `VEK-${yil}-${String(next).padStart(6, "0")}`;
      d.prepare(`UPDATE vekalet_taksit_odeme SET makbuz_no = ?, guncelleme_tarihi = ? WHERE id = ?`).run(no, t, odemeId);
      return no;
    })();
    return { ok: true, makbuzNo };
  } catch (e) {
    console.error("[ensureVekaletReceiptNumberForOdeme]", e);
    return { ok: false, error: "Makbuz numarası oluşturulamadı" };
  }
}

/** Eski kanal — taksitin son ödemesi için makbuz no */
export function ensureVekaletReceiptNumberForInstallment(taksitId: number): MakbuzEnsureSonuc {
  const r = getDb()
    .prepare(`SELECT id FROM vekalet_taksit_odeme WHERE taksit_id = ? ORDER BY odeme_tarihi DESC, id DESC LIMIT 1`)
    .get(taksitId) as { id: number } | undefined;
  if (!r) return { ok: false, error: "Bu taksit için ödeme kaydı yok" };
  return ensureVekaletReceiptNumberForOdeme(Number(r.id));
}

function buildVekaletPaket(odemeId: number): VekaletMakbuzPaketi {
  const ens = ensureVekaletReceiptNumberForOdeme(odemeId);
  if (!ens.ok) return { ok: false, error: "ODEME_YOK", mesaj: ens.error };
  const raw = getDb().prepare(`SELECT * FROM vekalet_taksit_odeme WHERE id = ?`).get(odemeId) as
    | Record<string, unknown>
    | undefined;
  if (!raw) return { ok: false, error: "ODEME_YOK", mesaj: "Ödeme kaydı bulunamadı." };
  const odeme = rowOdemeRaw(raw);
  const taksitRow = getDb().prepare(`SELECT * FROM vekalet_ucreti_taksit WHERE id = ?`).get(odeme.taksitId) as
    | Record<string, unknown>
    | undefined;
  if (!taksitRow) return { ok: false, error: "TAKSIT_YOK", mesaj: "Taksit bulunamadı." };
  const vRow = getDb()
    .prepare(`SELECT * FROM anlasilan_vekalet_ucreti WHERE id = ?`)
    .get(odeme.vekaletId) as Record<string, unknown> | undefined;
  if (!vRow) return { ok: false, error: "EKSIK_VERI", mesaj: "Vekalet kaydı bulunamadı." };
  const vekalet = {
    id: Number(vRow.id),
    dosyaId: Number(vRow.dosya_id),
    muvekkilId: Number(vRow.muvekkil_id),
    anlasilanTutar: Number(vRow.anlasilan_tutar ?? 0),
    paraBirimi: tryResolveParaBirimi(vRow.para_birimi),
    aciklama: vRow.aciklama == null ? null : String(vRow.aciklama),
    kayitTarihi: String(vRow.kayit_tarihi ?? ""),
    guncellemeTarihi: String(vRow.guncelleme_tarihi ?? ""),
  };
  const dosyaRow = dosyaGet(vekalet.dosyaId);
  const muvekkilRow = muvekkilGet(vekalet.muvekkilId);
  if (!dosyaRow || !muvekkilRow) {
    return { ok: false, error: "EKSIK_VERI", mesaj: "Dosya veya müvekkil bulunamadı." };
  }
  const taksitler = vekaletTaksitList(vekalet.id);
  const taksit = taksitler.find((t) => t.id === odeme.taksitId);
  if (!taksit) return { ok: false, error: "TAKSIT_YOK", mesaj: "Taksit bilgisi alınamadı." };
  const odenenToplam = taksitler.reduce((s, t) => s + t.odenenToplam, 0);
  const kalanVekalet = Math.max(0, vekalet.anlasilanTutar - odenenToplam);
  const odemeFull = {
    ...odeme,
    makbuzNo: ens.makbuzNo,
    kasaHareketId: raw.kasa_hareket_id == null ? null : Number(raw.kasa_hareket_id),
    ofisKasaHareketId: raw.ofis_kasa_hareket_id == null ? null : Number(raw.ofis_kasa_hareket_id),
  };
  return {
    ok: true,
    office: officeSettingsGetForMakbuz(),
    muvekkil: muvekkilRow,
    dosya: dosyaRow,
    vekalet,
    taksit,
    odeme: odemeFull,
    odenenToplam,
    kalanVekalet,
  };
}

export function getVekaletPrintPackageByOdemeId(odemeId: number): VekaletMakbuzPaketi {
  const cur = odemeGet(odemeId);
  if (!cur) return { ok: false, error: "ODEME_YOK", mesaj: "Ödeme kaydı bulunamadı." };
  return buildVekaletPaket(odemeId);
}

export function getVekaletReceiptDataByInstallmentId(taksitId: number): VekaletMakbuzPaketi {
  const r = getDb()
    .prepare(`SELECT id FROM vekalet_taksit_odeme WHERE taksit_id = ? ORDER BY odeme_tarihi DESC, id DESC LIMIT 1`)
    .get(taksitId) as { id: number } | undefined;
  if (!r) return { ok: false, error: "ODENMEDI", mesaj: "Bu taksit için ödeme kaydı yok." };
  return buildVekaletPaket(Number(r.id));
}
