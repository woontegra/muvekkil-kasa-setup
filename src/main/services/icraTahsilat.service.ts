import { getDb, nowIso } from "../db/connection";
import { authGetSession } from "./auth.service";
import { ofisKasaIcraTahsilatEkleInTx } from "./ofisKasa.service";
import { migration011IcraTahsilat } from "../migrations/011_icra_tahsilat";
import { isOdemeYontemiGecerli } from "@shared/constants/kasa";
import {
  ICRA_ALACAK_TURU_ETIKET,
  icraAlacakTuruOfisKategori,
  isGecerliIcraAlacakTuru,
  type IcraAlacakDurumKodu,
  type IcraAlacakTuruKodu,
} from "@shared/constants/icraTahsilat";
import { isOfisOdemeYontemiGecerli } from "@shared/constants/ofisKasa";
import { getAccountingPeriod } from "@shared/lib/accountingPeriod";
import { bugunYmdLocal } from "@shared/lib/vekaletTaksitUyari";
import { getAccountingPeriodMode } from "./appSettings.service";
import type {
  IcraTahsilatAlacakOlusturInput,
  IcraTahsilatIslemSonuc,
  IcraTahsilatListeFiltre,
  IcraTahsilatListeSatir,
  IcraTahsilatOdeme,
  IcraTahsilatOdemeAlInput,
  IcraTahsilatTaksit,
  IcraTahsilatTaksitGuncelleInput,
  IcraTahsilatUstOzet,
  IcraTaksitDurum,
  IcraTaksitSmmDurum,
} from "@shared/types/icraTahsilat";
import {
  PARA_BIRIMLERI,
  resolveParaBirimi,
  resolvePaymentAmounts,
  roundMoney,
  tryResolveParaBirimi,
  type KurKaynagi,
  type ParaBirimi,
} from "@shared/lib/paraBirimi";

function ensureIcraSchema(d: ReturnType<typeof getDb>): void {
  migration011IcraTahsilat.up(d);
}

function olusturanBilgisi(): { id: number | null; adi: string | null } {
  const u = authGetSession();
  if (!u) return { id: null, adi: null };
  return { id: u.id, adi: u.adSoyad?.trim() || u.kullaniciAdi };
}

function vadeEkleAy(ymd: string, ay: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1 + ay, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const gg = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${gg}`;
}

function bolTaksitTutarlari(toplam: number, adet: number): number[] {
  if (adet < 1) return [];
  const birim = Math.round((toplam / adet) * 100) / 100;
  const tutarlar = Array.from({ length: adet }, () => birim);
  const fark = Math.round((toplam - birim * adet) * 100) / 100;
  if (tutarlar.length > 0) tutarlar[tutarlar.length - 1] = Math.round((tutarlar[tutarlar.length - 1] + fark) * 100) / 100;
  return tutarlar;
}

function muvekkilAdFromRow(r: {
  muvekkil_turu?: string | null;
  ad_soyad?: string | null;
  sirket_unvani?: string | null;
}): string {
  if (r.muvekkil_turu === "TUZEL_KISI") {
    const unvan = (r.sirket_unvani ?? "").trim();
    if (unvan) return unvan;
  }
  const ad = (r.ad_soyad ?? "").trim();
  return ad || "—";
}

function vadeGecmisMi(vade: string | null): boolean {
  if (!vade) return false;
  const v = vade.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return v < bugunYmdLocal();
}

function hesaplaTaksitDurum(tutar: number, odenen: number, vade: string | null): IcraTaksitDurum {
  const kalan = Math.max(0, tutar - odenen);
  if (odenen <= 0) {
    if (vadeGecmisMi(vade) && kalan > 0) return "GECIKTI";
    return "ODENMEDI";
  }
  if (odenen >= tutar - 0.001) return "ODENDI";
  if (vadeGecmisMi(vade) && kalan > 0) return "GECIKTI";
  return "KISMI_ODENDI";
}

function odenenToplamForTaksit(d: ReturnType<typeof getDb>, taksitId: number): number {
  const r = d
    .prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM icra_tahsilat_odeme WHERE taksit_id = ?`)
    .get(taksitId) as { s: number };
  return Number(r.s ?? 0);
}

function odenenToplamForAlacak(d: ReturnType<typeof getDb>, alacakId: number): number {
  const r = d
    .prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM icra_tahsilat_odeme WHERE alacak_id = ?`)
    .get(alacakId) as { s: number };
  return Number(r.s ?? 0);
}

function taksitOdemeleri(d: ReturnType<typeof getDb>, taksitId: number): IcraTahsilatOdeme[] {
  const rows = d
    .prepare(`SELECT * FROM icra_tahsilat_odeme WHERE taksit_id = ? ORDER BY odeme_tarihi DESC, id DESC`)
    .all(taksitId) as Record<string, unknown>[];
  return rows.map(rowOdeme);
}

function rowOdeme(r: Record<string, unknown>): IcraTahsilatOdeme {
  return {
    id: Number(r.id),
    alacakId: Number(r.alacak_id),
    taksitId: r.taksit_id == null ? null : Number(r.taksit_id),
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
    odemeYontemi: isOdemeYontemiGecerli(String(r.odeme_yontemi ?? ""))
      ? (String(r.odeme_yontemi) as IcraTahsilatOdeme["odemeYontemi"])
      : "NAKIT",
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    makbuzNo: r.makbuz_no == null ? null : String(r.makbuz_no),
    smmKesildiMi: Number(r.smm_kesildi_mi) === 1,
    ofisKasaHareketId: r.ofis_kasa_hareket_id == null ? null : Number(r.ofis_kasa_hareket_id),
    pesinatMi: Number(r.pesinat_mi) === 1,
    kayitTarihi: String(r.kayit_tarihi ?? ""),
  };
}

function hesaplaSmmDurumu(odemeler: IcraTahsilatOdeme[]): {
  smmDurumu: IcraTaksitSmmDurum;
  smmBekleyenOdemeId: number | null;
} {
  if (odemeler.length === 0) return { smmDurumu: "YOK", smmBekleyenOdemeId: null };
  const bekleyen = odemeler.find((o) => !o.smmKesildiMi);
  if (bekleyen) return { smmDurumu: "BEKLIYOR", smmBekleyenOdemeId: bekleyen.id };
  return { smmDurumu: "KESILDI", smmBekleyenOdemeId: null };
}

function enrichTaksit(d: ReturnType<typeof getDb>, r: Record<string, unknown>): IcraTahsilatTaksit {
  const id = Number(r.id);
  const tutar = Number(r.tutar ?? 0);
  const odemeler = taksitOdemeleri(d, id);
  const odenenToplam = odemeler.reduce((s, o) => s + o.tutar, 0);
  const kalanTutar = Math.max(0, tutar - odenenToplam);
  const sonOdeme = odemeler[0] ?? null;
  const { smmDurumu, smmBekleyenOdemeId } = hesaplaSmmDurumu(odemeler);
  const vade = r.vade_tarihi == null ? null : String(r.vade_tarihi).slice(0, 10);
  return {
    id,
    alacakId: Number(r.alacak_id),
    taksitNo: Number(r.taksit_no),
    tutar,
    paraBirimi: tryResolveParaBirimi(r.para_birimi),
    vadeTarihi: vade,
    aciklama: r.aciklama == null ? null : String(r.aciklama),
    odenenToplam,
    kalanTutar,
    durum: hesaplaTaksitDurum(tutar, odenenToplam, vade),
    smmDurumu,
    sonOdemeTarihi: sonOdeme?.odemeTarihi ?? null,
    sonMakbuzNo: sonOdeme?.makbuzNo ?? null,
    sonOdemeId: sonOdeme?.id ?? null,
    smmBekleyenOdemeId,
  };
}

function hesaplaAlacakDurum(
  d: ReturnType<typeof getDb>,
  alacakId: number,
  toplam: number,
  storedDurum: string,
): IcraAlacakDurumKodu {
  if (storedDurum === "IPTAL") return "IPTAL";
  const odenen = odenenToplamForAlacak(d, alacakId);
  const kalan = Math.max(0, toplam - odenen);
  if (kalan <= 0.001) return "ODENDI";
  const gecikmis = d
    .prepare(
      `SELECT COUNT(*) AS c FROM icra_tahsilat_taksit t
       WHERE t.alacak_id = ?
         AND t.vade_tarihi IS NOT NULL
         AND date(substr(t.vade_tarihi,1,10)) < date(?)
         AND (SELECT COALESCE(SUM(o.tutar),0) FROM icra_tahsilat_odeme o WHERE o.taksit_id = t.id) < t.tutar - 0.001`,
    )
    .get(alacakId, bugunYmdLocal()) as { c: number };
  if (Number(gecikmis.c) > 0) return "GECIKTI";
  if (odenen > 0.001) return "KISMI_ODENDI";
  return "ACIK";
}

function ofisAciklama(
  borclu: string,
  tur: IcraAlacakTuruKodu,
  taksitNo: number | null,
  pesinat: boolean,
): string {
  const turEtiket = ICRA_ALACAK_TURU_ETIKET[tur];
  if (pesinat) return `İcra tahsilat - ${borclu} - ${turEtiket} - Peşinat`;
  return `İcra tahsilat - ${borclu} - ${turEtiket} - Taksit No: ${taksitNo ?? "—"}`;
}

function icraOdemeKaydetInTx(
  d: ReturnType<typeof getDb>,
  opts: {
    alacakId: number;
    taksitId: number | null;
    tutar: number;
    kasaTutari: number;
    alacakParaBirimi: ParaBirimi;
    odemeParaBirimi: ParaBirimi;
    kur: number | null;
    kurBazParaBirimi: ParaBirimi | null;
    kurKarsiParaBirimi: ParaBirimi | null;
    kurKaynagi: KurKaynagi | null;
    tcmbKurTarihi: string | null;
    tcmbReferansKur: number | null;
    odemeTarihi: string;
    odemeYontemi: string;
    aciklama: string | null;
    smmKes: number;
    pesinatMi: number;
    borclu: string;
    alacakTuru: IcraAlacakTuruKodu;
    taksitNo: number | null;
    olusturan: { id: number | null; adi: string | null };
    t: string;
  },
): IcraTahsilatOdeme {
  const rIns = d
    .prepare(
      `INSERT INTO icra_tahsilat_odeme (
        alacak_id, taksit_id, odeme_tarihi, tutar, kasa_tutari, alacak_para_birimi, odeme_para_birimi,
        kur, kur_baz_para_birimi, kur_karsi_para_birimi, kur_kaynagi, tcmb_kur_tarihi, tcmb_referans_kur,
        odeme_yontemi, aciklama, makbuz_no, smm_kesildi_mi,
        pesinat_mi, ofis_kasa_hareket_id, olusturan_kullanici_id, olusturan_kullanici_adi, kayit_tarihi, guncelleme_tarihi
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      opts.alacakId,
      opts.taksitId,
      opts.odemeTarihi,
      opts.tutar,
      opts.kasaTutari,
      opts.alacakParaBirimi,
      opts.odemeParaBirimi,
      opts.kur,
      opts.kurBazParaBirimi,
      opts.kurKarsiParaBirimi,
      opts.kurKaynagi,
      opts.tcmbKurTarihi,
      opts.tcmbReferansKur,
      opts.odemeYontemi,
      opts.aciklama,
      null,
      opts.smmKes,
      opts.pesinatMi,
      null,
      opts.olusturan.id,
      opts.olusturan.adi,
      opts.t,
      opts.t,
    );
  const odemeId = Number(rIns.lastInsertRowid);
  const ofisKasaId = ofisKasaIcraTahsilatEkleInTx(d, {
    icraOdemeId: odemeId,
    tutar: opts.kasaTutari,
    paraBirimi: opts.odemeParaBirimi,
    tarih: opts.odemeTarihi,
    odemeYontemi: opts.odemeYontemi,
    kategori: icraAlacakTuruOfisKategori(opts.alacakTuru),
    aciklama: ofisAciklama(opts.borclu, opts.alacakTuru, opts.taksitNo, opts.pesinatMi === 1),
    not: opts.aciklama,
    olusturanKullaniciId: opts.olusturan.id,
    olusturanKullaniciAdi: opts.olusturan.adi,
    t: opts.t,
  });
  d.prepare(`UPDATE icra_tahsilat_odeme SET ofis_kasa_hareket_id = ? WHERE id = ?`).run(ofisKasaId, odemeId);
  const row = d.prepare(`SELECT * FROM icra_tahsilat_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
  return rowOdeme(row);
}

export function icraTahsilatUstOzet(): IcraTahsilatUstOzet {
  const d = getDb();
  ensureIcraSchema(d);
  const bugun = bugunYmdLocal();
  const period = getAccountingPeriod(getAccountingPeriodMode(), bugun);
  const rows = d
    .prepare(`SELECT id, toplam_tutar, durum, COALESCE(para_birimi, 'TRY') AS para_birimi FROM icra_tahsilat_alacak WHERE durum != 'IPTAL'`)
    .all() as { id: number; toplam_tutar: number; durum: string; para_birimi: string }[];
  const byCurrency = Object.fromEntries(PARA_BIRIMLERI.map((pb) => [pb, {
    toplamAlacak: 0, tahsilEdilen: 0, kalanAlacak: 0, buAyTahsilat: 0,
  }])) as IcraTahsilatUstOzet["byCurrency"];
  let vadesiGecmisTaksit = 0;
  for (const a of rows) {
    const pb = tryResolveParaBirimi(a.para_birimi);
    byCurrency[pb].toplamAlacak = roundMoney(byCurrency[pb].toplamAlacak + Number(a.toplam_tutar ?? 0));
    byCurrency[pb].tahsilEdilen = roundMoney(byCurrency[pb].tahsilEdilen + odenenToplamForAlacak(d, a.id));
    const g = d
      .prepare(
        `SELECT COUNT(*) AS c FROM icra_tahsilat_taksit t
         WHERE t.alacak_id = ?
           AND t.vade_tarihi IS NOT NULL
           AND date(substr(t.vade_tarihi,1,10)) < date(?)
           AND (SELECT COALESCE(SUM(o.tutar),0) FROM icra_tahsilat_odeme o WHERE o.taksit_id = t.id) < t.tutar - 0.001`,
      )
      .get(a.id, bugun) as { c: number };
    vadesiGecmisTaksit += Number(g.c ?? 0);
  }
  const donemBit = period.bit < bugun ? period.bit : bugun;
  const buAy = d
    .prepare(
      `SELECT COALESCE(alacak_para_birimi, 'TRY') AS para_birimi, COALESCE(SUM(tutar), 0) AS s
       FROM icra_tahsilat_odeme
       WHERE date(substr(odeme_tarihi,1,10)) >= date(?) AND date(substr(odeme_tarihi,1,10)) <= date(?)
       GROUP BY COALESCE(alacak_para_birimi, 'TRY')`,
    )
    .all(period.bas, donemBit) as { para_birimi: string; s: number }[];
  for (const r of buAy) byCurrency[tryResolveParaBirimi(r.para_birimi)].buAyTahsilat = Number(r.s ?? 0);
  for (const pb of PARA_BIRIMLERI) {
    byCurrency[pb].kalanAlacak = roundMoney(byCurrency[pb].toplamAlacak - byCurrency[pb].tahsilEdilen);
  }
  const legacy = byCurrency.TRY;
  return {
    toplamAlacak: legacy.toplamAlacak,
    tahsilEdilen: legacy.tahsilEdilen,
    kalanAlacak: Math.max(0, legacy.kalanAlacak),
    vadesiGecmisTaksit,
    buAyTahsilat: legacy.buAyTahsilat,
    bakiyeler: Object.fromEntries(PARA_BIRIMLERI.map((pb) => [pb, byCurrency[pb].kalanAlacak])) as Record<ParaBirimi, number>,
    byCurrency,
  };
}

export function icraTahsilatList(filtre: IcraTahsilatListeFiltre = {}): IcraTahsilatListeSatir[] {
  const d = getDb();
  ensureIcraSchema(d);
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  if (filtre.tarihBas?.trim()) {
    where.push(`date(substr(a.kayit_tarihi,1,10)) >= date(?)`);
    params.push(filtre.tarihBas.trim().slice(0, 10));
  }
  if (filtre.tarihBit?.trim()) {
    where.push(`date(substr(a.kayit_tarihi,1,10)) <= date(?)`);
    params.push(filtre.tarihBit.trim().slice(0, 10));
  }
  if (filtre.alacakTuru?.trim() && filtre.alacakTuru !== "TUMU") {
    where.push(`a.alacak_turu = ?`);
    params.push(filtre.alacakTuru.trim());
  }
  const q = (filtre.q ?? "").trim();
  if (q) {
    where.push(`(a.borclu_adi LIKE ? OR m.ad_soyad LIKE ? OR m.sirket_unvani LIKE ? OR d.konu_basligi LIKE ?)`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const rows = d
    .prepare(
      `SELECT a.*, m.muvekkil_turu, m.ad_soyad, m.sirket_unvani, d.konu_basligi,
        (SELECT COUNT(*) FROM icra_tahsilat_taksit t WHERE t.alacak_id = a.id) AS taksit_sayisi
       FROM icra_tahsilat_alacak a
       LEFT JOIN muvekkil m ON m.id = a.muvekkil_id
       LEFT JOIN dosya d ON d.id = a.dosya_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.id DESC`,
    )
    .all(...params) as Record<string, unknown>[];

  const liste = rows.map((r) => {
    const id = Number(r.id);
    const toplam = Number(r.toplam_tutar ?? 0);
    const odenen = odenenToplamForAlacak(d, id);
    const durum = hesaplaAlacakDurum(d, id, toplam, String(r.durum ?? "ACIK"));
    return {
      id,
      borcluAdi: String(r.borclu_adi ?? ""),
      muvekkilId: r.muvekkil_id == null ? null : Number(r.muvekkil_id),
      muvekkilAdi: r.muvekkil_id == null ? null : muvekkilAdFromRow(r),
      dosyaId: r.dosya_id == null ? null : Number(r.dosya_id),
      dosyaKonu: r.konu_basligi == null ? null : String(r.konu_basligi).trim() || null,
      alacakTuru: String(r.alacak_turu) as IcraAlacakTuruKodu,
      paraBirimi: tryResolveParaBirimi(r.para_birimi),
      toplamTutar: toplam,
      pesinatTutar: Number(r.pesinat_tutar ?? 0),
      odenenToplam: odenen,
      kalanTutar: Math.max(0, toplam - odenen),
      taksitSayisi: Number(r.taksit_sayisi ?? 0),
      durum,
      kayitTarihi: String(r.kayit_tarihi ?? ""),
    } satisfies IcraTahsilatListeSatir;
  });

  if (filtre.durum?.trim() && filtre.durum !== "TUMU") {
    return liste.filter((x) => x.durum === filtre.durum);
  }
  return liste;
}

export function icraTahsilatTaksitList(alacakId: number): IcraTahsilatTaksit[] {
  const d = getDb();
  ensureIcraSchema(d);
  const rows = d
    .prepare(`SELECT * FROM icra_tahsilat_taksit WHERE alacak_id = ? ORDER BY taksit_no`)
    .all(alacakId) as Record<string, unknown>[];
  return rows.map((r) => enrichTaksit(d, r));
}

export function icraTahsilatAlacakOlustur(
  input: IcraTahsilatAlacakOlusturInput,
): IcraTahsilatIslemSonuc<IcraTahsilatListeSatir> {
  if (!isGecerliIcraAlacakTuru(input.alacakTuru)) {
    return { ok: false, error: "Geçerli alacak türü seçin." };
  }
  const borclu = (input.borcluAdi ?? "").trim();
  if (!borclu) return { ok: false, error: "Borçlu / karşı taraf adı zorunludur." };
  if (!Number.isFinite(input.toplamTutar) || input.toplamTutar <= 0) {
    return { ok: false, error: "Toplam alacak tutarı sıfırdan büyük olmalıdır." };
  }
  const pesinat = input.pesinatVar ? Number(input.pesinatTutar ?? 0) : 0;
  if (pesinat < 0 || pesinat > input.toplamTutar + 0.001) {
    return { ok: false, error: "Peşinat tutarı geçersiz." };
  }
  const taksitSayisi = Math.floor(Number(input.taksitSayisi));
  if (!Number.isFinite(taksitSayisi) || taksitSayisi < 1 || taksitSayisi > 120) {
    return { ok: false, error: "Taksit sayısı 1–120 arasında olmalıdır." };
  }
  const ilkVade = (input.ilkVadeTarihi ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ilkVade)) {
    return { ok: false, error: "Geçerli ilk vade tarihi girin." };
  }
  const odemeYontemi = String(input.odemeYontemi ?? "NAKIT");
  if (!isOfisOdemeYontemiGecerli(odemeYontemi) && !isOdemeYontemiGecerli(odemeYontemi)) {
    return { ok: false, error: "Geçerli ödeme yöntemi seçin." };
  }
  const kalanTaksitlendir = Math.round((input.toplamTutar - pesinat) * 100) / 100;
  if (kalanTaksitlendir <= 0.001 && taksitSayisi > 0) {
    return { ok: false, error: "Peşinat toplam tutarı karşılıyorsa taksit oluşturulamaz." };
  }
  const tutarlar = bolTaksitTutarlari(kalanTaksitlendir, taksitSayisi);
  let paraBirimi: ParaBirimi;
  let pesinatPayment: ReturnType<typeof resolvePaymentAmounts> | null = null;
  try {
    paraBirimi = resolveParaBirimi(input.paraBirimi);
    if (pesinat > 0.001) {
      pesinatPayment = resolvePaymentAmounts({
        alacakParaBirimi: paraBirimi,
        mahsupTutari: pesinat,
        kasaTutari: input.kasaTutari,
        odemeParaBirimi: input.odemeParaBirimi,
        kalanBorc: input.toplamTutar,
      });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Para birimi bilgileri geçersiz." };
  }
  const d = getDb();
  ensureIcraSchema(d);
  const olusturan = olusturanBilgisi();
  const t = nowIso();
  const aciklama = (input.aciklama ?? "").trim() || null;
  try {
    const alacakId = d.transaction(() => {
      const ins = d
        .prepare(
          `INSERT INTO icra_tahsilat_alacak (
            alacak_turu, borclu_adi, muvekkil_id, dosya_id, toplam_tutar, para_birimi, pesinat_tutar, taksit_sayisi,
            ilk_vade_tarihi, varsayilan_odeme_yontemi, aciklama, durum, kayit_tarihi, guncelleme_tarihi
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          input.alacakTuru,
          borclu,
          input.muvekkilId ?? null,
          input.dosyaId ?? null,
          input.toplamTutar,
          paraBirimi,
          pesinat,
          taksitSayisi,
          ilkVade,
          odemeYontemi,
          aciklama,
          "ACIK",
          t,
          t,
        );
      const aid = Number(ins.lastInsertRowid);
      for (let i = 0; i < tutarlar.length; i += 1) {
        const vade = vadeEkleAy(ilkVade, i);
        d.prepare(
          `INSERT INTO icra_tahsilat_taksit (alacak_id, taksit_no, tutar, para_birimi, vade_tarihi, aciklama, kayit_tarihi, guncelleme_tarihi)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(aid, i + 1, tutarlar[i], paraBirimi, vade, null, t, t);
      }
      if (pesinat > 0.001) {
        const odTarih = bugunYmdLocal();
        icraOdemeKaydetInTx(d, {
          alacakId: aid,
          taksitId: null,
          tutar: pesinatPayment!.mahsupTutari,
          kasaTutari: pesinatPayment!.kasaTutari,
          alacakParaBirimi: pesinatPayment!.alacakParaBirimi,
          odemeParaBirimi: pesinatPayment!.odemeParaBirimi,
          kur: pesinatPayment!.kur,
          kurBazParaBirimi: pesinatPayment!.kurBazParaBirimi,
          kurKarsiParaBirimi: pesinatPayment!.kurKarsiParaBirimi,
          kurKaynagi: pesinatPayment!.isCrossCurrency ? (input.kurKaynagi ?? "MANUEL") : null,
          tcmbKurTarihi: pesinatPayment!.isCrossCurrency ? (input.tcmbKurTarihi ?? null) : null,
          tcmbReferansKur: pesinatPayment!.isCrossCurrency ? (input.tcmbReferansKur ?? null) : null,
          odemeTarihi: odTarih,
          odemeYontemi,
          aciklama,
          smmKes: 0,
          pesinatMi: 1,
          borclu,
          alacakTuru: input.alacakTuru,
          taksitNo: null,
          olusturan,
          t,
        });
      }
      return aid;
    })();
    const liste = icraTahsilatList();
    const row = liste.find((x) => x.id === alacakId);
    if (!row) return { ok: false, error: "Alacak oluşturuldu ancak listelenemedi." };
    return { ok: true, row };
  } catch (e) {
    console.error("[icraTahsilatAlacakOlustur]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Alacak oluşturulamadı." };
  }
}

export function icraTahsilatTaksitOdemeAl(
  taksitId: number,
  input: IcraTahsilatOdemeAlInput,
): IcraTahsilatIslemSonuc<{ taksit: IcraTahsilatTaksit; odeme: IcraTahsilatOdeme }> {
  if (!Number.isFinite(input.tutar) || input.tutar <= 0) {
    return { ok: false, error: "Tahsil tutarı sıfırdan büyük olmalıdır." };
  }
  const od = (input.odemeTarihi ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(od)) {
    return { ok: false, error: "Geçerli ödeme tarihi girin." };
  }
  if (!isOdemeYontemiGecerli(input.odemeYontemi) && !isOfisOdemeYontemiGecerli(input.odemeYontemi)) {
    return { ok: false, error: "Geçersiz ödeme yöntemi" };
  }
  const d = getDb();
  ensureIcraSchema(d);
  const cur = d.prepare(`SELECT * FROM icra_tahsilat_taksit WHERE id = ?`).get(taksitId) as
    | Record<string, unknown>
    | undefined;
  if (!cur) return { ok: false, error: "Taksit bulunamadı" };
  const tutar = Number(cur.tutar);
  const odenen = odenenToplamForTaksit(d, taksitId);
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
  const alacak = d.prepare(`SELECT * FROM icra_tahsilat_alacak WHERE id = ?`).get(Number(cur.alacak_id)) as
    | Record<string, unknown>
    | undefined;
  if (!alacak || String(alacak.durum) === "IPTAL") {
    return { ok: false, error: "Alacak kaydı bulunamadı veya iptal edilmiş." };
  }
  const olusturan = olusturanBilgisi();
  const t = nowIso();
  const smmKes = input.smmKesildiMi === true ? 1 : 0;
  const aciklama = (input.aciklama ?? "").trim() || null;
  try {
    const result = d.transaction(() => {
      const odeme = icraOdemeKaydetInTx(d, {
        alacakId: Number(cur.alacak_id),
        taksitId,
        tutar: payment.mahsupTutari,
        kasaTutari: payment.kasaTutari,
        alacakParaBirimi: payment.alacakParaBirimi,
        odemeParaBirimi: payment.odemeParaBirimi,
        kur: payment.kur,
        kurBazParaBirimi: payment.kurBazParaBirimi,
        kurKarsiParaBirimi: payment.kurKarsiParaBirimi,
        kurKaynagi: payment.isCrossCurrency ? (input.kurKaynagi ?? "MANUEL") : null,
        tcmbKurTarihi: payment.isCrossCurrency ? (input.tcmbKurTarihi ?? null) : null,
        tcmbReferansKur: payment.isCrossCurrency ? (input.tcmbReferansKur ?? null) : null,
        odemeTarihi: od,
        odemeYontemi: input.odemeYontemi,
        aciklama,
        smmKes,
        pesinatMi: 0,
        borclu: String(alacak.borclu_adi ?? ""),
        alacakTuru: String(alacak.alacak_turu) as IcraAlacakTuruKodu,
        taksitNo: Number(cur.taksit_no),
        olusturan,
        t,
      });
      d.prepare(`UPDATE icra_tahsilat_taksit SET guncelleme_tarihi = ? WHERE id = ?`).run(t, taksitId);
      d.prepare(`UPDATE icra_tahsilat_alacak SET guncelleme_tarihi = ? WHERE id = ?`).run(t, Number(cur.alacak_id));
      const tRow = d.prepare(`SELECT * FROM icra_tahsilat_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown>;
      return { odeme, taksit: enrichTaksit(d, tRow) };
    })();
    return { ok: true, row: result };
  } catch (e) {
    console.error("[icraTahsilatTaksitOdemeAl]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ödeme kaydedilemedi" };
  }
}

export function icraTahsilatTaksitOdemeGecmisi(taksitId: number): IcraTahsilatOdeme[] {
  const d = getDb();
  ensureIcraSchema(d);
  return taksitOdemeleri(d, taksitId);
}

export function icraTahsilatTaksitSil(taksitId: number): { ok: true } | { ok: false; error: string } {
  const d = getDb();
  ensureIcraSchema(d);
  const cur = d.prepare(`SELECT id FROM icra_tahsilat_taksit WHERE id = ?`).get(taksitId);
  if (!cur) return { ok: false, error: "Taksit bulunamadı" };
  const odemeSay = d
    .prepare(`SELECT COUNT(*) AS c FROM icra_tahsilat_odeme WHERE taksit_id = ?`)
    .get(taksitId) as { c: number };
  if (Number(odemeSay.c) > 0) {
    return { ok: false, error: "Ödeme kaydı olan taksit silinemez" };
  }
  d.prepare(`DELETE FROM icra_tahsilat_taksit WHERE id = ?`).run(taksitId);
  return { ok: true };
}

export function icraTahsilatTaksitGuncelle(
  taksitId: number,
  patch: IcraTahsilatTaksitGuncelleInput,
): IcraTahsilatIslemSonuc<IcraTahsilatTaksit> {
  try {
    const d = getDb();
    ensureIcraSchema(d);
    const cur = d.prepare(`SELECT * FROM icra_tahsilat_taksit WHERE id = ?`).get(taksitId) as
      | Record<string, unknown>
      | undefined;
    if (!cur) return { ok: false, error: "Taksit bulunamadı" };

    const alacak = d.prepare(`SELECT * FROM icra_tahsilat_alacak WHERE id = ?`).get(Number(cur.alacak_id)) as
      | Record<string, unknown>
      | undefined;
    if (!alacak) return { ok: false, error: "Alacak kaydı bulunamadı" };
    if (String(alacak.durum) === "IPTAL") return { ok: false, error: "İptal edilmiş alacak düzenlenemez" };

    const odenen = odenenToplamForTaksit(d, taksitId);
    const mevcutTutar = Number(cur.tutar ?? 0);
    const tamOdendi = odenen >= mevcutTutar - 0.001;

    let tutar = patch.tutar ?? mevcutTutar;
    if (patch.tutar !== undefined) {
      if (!Number.isFinite(tutar) || tutar <= 0) {
        return { ok: false, error: "Taksit tutarı sıfırdan büyük olmalıdır" };
      }
      if (tutar < odenen - 0.001) {
        return { ok: false, error: "Taksit tutarı ödenen tutardan küçük olamaz" };
      }
      if (tamOdendi && Math.abs(tutar - mevcutTutar) > 0.001) {
        return { ok: false, error: "Tam ödenmiş taksitte tutar değiştirilemez" };
      }
    }

    const vade =
      patch.vadeTarihi !== undefined
        ? patch.vadeTarihi == null || patch.vadeTarihi === ""
          ? null
          : patch.vadeTarihi.trim().slice(0, 10)
        : cur.vade_tarihi == null
          ? null
          : String(cur.vade_tarihi).slice(0, 10);
    if (vade != null && !/^\d{4}-\d{2}-\d{2}$/.test(vade)) {
      return { ok: false, error: "Geçerli vade tarihi girin" };
    }

    const aciklama =
      patch.aciklama !== undefined ? (patch.aciklama == null ? null : patch.aciklama.trim() || null) : cur.aciklama == null ? null : String(cur.aciklama);

    const alacakId = Number(cur.alacak_id);
    const toplamAlacak = Number(alacak.toplam_tutar ?? 0);
    const pesinat = Number(alacak.pesinat_tutar ?? 0);
    const beklenenTaksitToplam = Math.max(0, toplamAlacak - pesinat);
    const digerToplam = Number(
      (
        d
          .prepare(`SELECT COALESCE(SUM(tutar), 0) AS s FROM icra_tahsilat_taksit WHERE alacak_id = ? AND id != ?`)
          .get(alacakId, taksitId) as { s: number }
      ).s ?? 0,
    );
    const yeniTaksitToplam = digerToplam + tutar;
    if (yeniTaksitToplam > beklenenTaksitToplam + 0.001) {
      return { ok: false, error: "Taksit toplamı alacak tutarını aşamaz" };
    }

    const t = nowIso();
    d.prepare(
      `UPDATE icra_tahsilat_taksit SET tutar = ?, vade_tarihi = ?, aciklama = ?, guncelleme_tarihi = ? WHERE id = ?`,
    ).run(tutar, vade, aciklama, t, taksitId);
    d.prepare(`UPDATE icra_tahsilat_alacak SET guncelleme_tarihi = ? WHERE id = ?`).run(t, alacakId);

    const row = d.prepare(`SELECT * FROM icra_tahsilat_taksit WHERE id = ?`).get(taksitId) as Record<string, unknown>;
    return { ok: true, row: enrichTaksit(d, row) };
  } catch (e) {
    console.error("[icraTahsilatTaksitGuncelle]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Taksit güncellenemedi" };
  }
}

export function icraTahsilatSmmKesildi(odemeId: number): IcraTahsilatIslemSonuc<IcraTahsilatOdeme> {
  const d = getDb();
  ensureIcraSchema(d);
  const cur = d.prepare(`SELECT * FROM icra_tahsilat_odeme WHERE id = ?`).get(odemeId) as
    | Record<string, unknown>
    | undefined;
  if (!cur) return { ok: false, error: "Ödeme kaydı bulunamadı" };
  if (Number(cur.smm_kesildi_mi) === 1) {
    return { ok: false, error: "SMM zaten kesildi" };
  }
  const t = nowIso();
  d.prepare(`UPDATE icra_tahsilat_odeme SET smm_kesildi_mi = 1, guncelleme_tarihi = ? WHERE id = ?`).run(t, odemeId);
  const row = d.prepare(`SELECT * FROM icra_tahsilat_odeme WHERE id = ?`).get(odemeId) as Record<string, unknown>;
  return { ok: true, row: rowOdeme(row) };
}

export function icraTahsilatAlacakIptal(alacakId: number): { ok: true } | { ok: false; error: string } {
  const d = getDb();
  ensureIcraSchema(d);
  const cur = d.prepare(`SELECT id FROM icra_tahsilat_alacak WHERE id = ?`).get(alacakId);
  if (!cur) return { ok: false, error: "Alacak bulunamadı" };
  const t = nowIso();
  d.prepare(`UPDATE icra_tahsilat_alacak SET durum = 'IPTAL', guncelleme_tarihi = ? WHERE id = ?`).run(t, alacakId);
  return { ok: true };
}
