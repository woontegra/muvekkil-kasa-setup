import { randomBytes } from "node:crypto";
import {
  formatKurOzeti,
  moneyToFixed2,
  PARA_BIRIMLERI,
  rateToFixed8,
  tryResolveParaBirimi,
  type ParaBirimi,
} from "@shared/lib/paraBirimi";
import { filterAktifTahsilatOdemeleri } from "@shared/lib/tahsilatOdemeAktif";
import type { MuvekkilEkstreDurumLabel, MuvekkilEkstrePayload, MuvekkilEkstreSonuc } from "@shared/types/muvekkilEkstre";
import { getDb } from "../db/connection";
import { KASA_AKTIF_SQL, OFIS_KASA_AKTIF_SQL } from "./kasaAktifSql";
import { DOSYA_KASA_VEKALET_HARIC_SQL } from "./kasa.service";
import { dosyaGet } from "./dosya.service";
import { muvekkilGet } from "./muvekkil.service";
import { officeSettingsGet } from "./office.service";
import { DEFAULT_OFIS_ADI } from "@shared/types/officeDefaults";

const TZ_OFFSET = "+03:00";

function ymdTr(ref: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(ref);
}

function parseItibariyleYmd(itibariyle?: string | null): string {
  if (itibariyle && /^\d{4}-\d{2}-\d{2}$/.test(itibariyle)) return itibariyle;
  return ymdTr(new Date());
}

function endOfItibariyleDay(ymd: string): string {
  return `${ymd}T23:59:59.999${TZ_OFFSET}`;
}

function fmt(n: number): string {
  return moneyToFixed2(n);
}

function makeBelgeRef(now = new Date()): string {
  const y = now.getFullYear();
  const rnd = randomBytes(3).toString("hex").toUpperCase();
  return `EKSTRE-${y}-${rnd}`;
}

function tipEtiket(tip: string, tutar: number): string {
  if (tip === "AVANS_GIRISI") return "Masraf avansı";
  if (tip === "MASRAF") return "Dosya masrafı";
  if (tip === "DUZELTME") return tutar < 0 ? "Avans iadesi" : "Düzeltme";
  return tip;
}

export function buildMuvekkilEkstreForDosya(
  dosyaId: number,
  opts?: { itibariyleTarih?: string | null; belgeRef?: string | null },
): MuvekkilEkstreSonuc {
  const dosya = dosyaGet(dosyaId);
  if (!dosya) {
    return { ok: false, error: "DOSYA_YOK", mesaj: "Dosya bulunamadı." };
  }

  const muvekkil = muvekkilGet(dosya.muvekkilId);
  if (!muvekkil) {
    return { ok: false, error: "MUVEKKIL_YOK", mesaj: "Müvekkil bulunamadı." };
  }

  const itibariyleYmd = parseItibariyleYmd(opts?.itibariyleTarih);
  const cutoff = endOfItibariyleDay(itibariyleYmd);
  const d = getDb();

  const vekalet = d
    .prepare(`SELECT id, anlasilan_tutar, para_birimi FROM anlasilan_vekalet_ucreti WHERE dosya_id = ?`)
    .get(dosyaId) as { id: number; anlasilan_tutar: number; para_birimi: string } | undefined;

  const taksitRows = d
    .prepare(
      `SELECT * FROM vekalet_ucreti_taksit
       WHERE dosya_id = ? AND substr(kayit_tarihi, 1, 10) <= ?
       ORDER BY taksit_no ASC, vade_tarihi ASC`,
    )
    .all(dosyaId, itibariyleYmd) as Record<string, unknown>[];

  const odemeRows = d
    .prepare(
      `SELECT o.*, ok.silinme_tarihi AS ofis_silinme_tarihi
       FROM vekalet_taksit_odeme o
       LEFT JOIN ofis_kasa_hareketleri ok ON ok.id = o.ofis_kasa_hareket_id
       WHERE o.dosya_id = ? AND substr(o.odeme_tarihi, 1, 10) <= ?
       ORDER BY o.odeme_tarihi ASC, o.id ASC`,
    )
    .all(dosyaId, itibariyleYmd) as Record<string, unknown>[];

  const odemelerByTaksit = new Map<number, Record<string, unknown>[]>();
  for (const o of odemeRows) {
    const tid = Number(o.taksit_id);
    const list = odemelerByTaksit.get(tid) ?? [];
    list.push(o);
    odemelerByTaksit.set(tid, list);
  }

  const kasaRows = d
    .prepare(
      `SELECT * FROM dosya_kasa_hareket
       WHERE dosya_id = ? AND onay_durumu = 'ONAYLI' ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}
         AND islem_tipi IN ('AVANS_GIRISI', 'MASRAF', 'DUZELTME')
         AND substr(tarih, 1, 10) <= ?
       ORDER BY tarih ASC, id ASC`,
    )
    .all(dosyaId, itibariyleYmd) as Record<string, unknown>[];

  const ofisGelirRows = d
    .prepare(
      `SELECT * FROM ofis_kasa_hareketleri
       WHERE islem_tipi = 'GELIR' AND onay_durumu = 'ONAYLI' ${OFIS_KASA_AKTIF_SQL}
         AND substr(tarih, 1, 10) <= ?
         AND (
           muvekkil_id = ?
           OR (
             kaynak_tipi = 'VEKALET_TAHSILATI'
             AND kaynak_id IN (SELECT id FROM vekalet_taksit_odeme WHERE muvekkil_id = ?)
           )
         )
       ORDER BY tarih ASC, id ASC`,
    )
    .all(itibariyleYmd, dosya.muvekkilId, dosya.muvekkilId) as Record<string, unknown>[];

  const vekaletParaBirimi = tryResolveParaBirimi(vekalet?.para_birimi);
  const anlasilan = Number(vekalet?.anlasilan_tutar ?? 0);
  let odenenToplam = 0;
  let gecikmisToplam = 0;
  let sonrakiVade: string | null = null;
  let sonrakiTutar: string | null = null;
  const durumRefDay = itibariyleYmd;

  const taksitlerOut: MuvekkilEkstrePayload["taksitler"] = [];

  for (const t of taksitRows) {
    const iptalMi = false;
    const taksitId = Number(t.id);
    const taksitTutari = Number(t.tutar ?? 0);
    const rawOdemeler = odemelerByTaksit.get(taksitId) ?? [];
    const aktifOdemeler = filterAktifTahsilatOdemeleri(
      rawOdemeler.map((o) => ({
        row: o,
        ofisKasaHareketId: o.ofis_kasa_hareket_id == null ? null : Number(o.ofis_kasa_hareket_id),
        ofisSilinmeTarihi: o.ofis_silinme_tarihi == null ? null : String(o.ofis_silinme_tarihi),
      })),
    );
    const odenen = aktifOdemeler.reduce((s, o) => s + Number(o.row.tutar ?? 0), 0);
    const kalan = iptalMi ? 0 : Math.max(0, taksitTutari - odenen);

    if (!iptalMi) odenenToplam += odenen;

    let durum: MuvekkilEkstreDurumLabel;
    if (iptalMi) {
      durum = "İptal";
    } else {
      const vadeRaw = t.vade_tarihi == null ? null : String(t.vade_tarihi).slice(0, 10);
      const vadeYmd = vadeRaw && /^\d{4}-\d{2}-\d{2}$/.test(vadeRaw) ? vadeRaw : durumRefDay;
      if (vadeYmd < durumRefDay && kalan > 0.0001) durum = "Gecikmiş";
      else if (odenen <= 0) durum = "Bekliyor";
      else if (odenen + 0.0001 < taksitTutari) durum = "Kısmi Ödendi";
      else durum = "Tam Ödendi";
    }

    if (!iptalMi && durum === "Gecikmiş") gecikmisToplam += kalan;

    if (!iptalMi && kalan > 0.0001) {
      const vadeRaw = t.vade_tarihi == null ? null : String(t.vade_tarihi).slice(0, 10);
      const vadeYmd = vadeRaw && /^\d{4}-\d{2}-\d{2}$/.test(vadeRaw) ? vadeRaw : durumRefDay;
      if (sonrakiVade == null || vadeYmd < sonrakiVade) {
        sonrakiVade = vadeYmd;
        sonrakiTutar = fmt(kalan);
      }
    }

    taksitlerOut.push({
      id: taksitId,
      taksitNo: Number(t.taksit_no),
      vadeTarihi: String(t.vade_tarihi ?? "").slice(0, 10) || durumRefDay,
      taksitTutari: fmt(taksitTutari),
      odenenToplam: fmt(odenen),
      kalanTutar: fmt(kalan),
      durum,
      iptalMi,
      odemeler: aktifOdemeler.map(({ row: o }) => {
        const alacakPb = tryResolveParaBirimi(o.alacak_para_birimi ?? vekaletParaBirimi);
        const odemePb = tryResolveParaBirimi(o.odeme_para_birimi ?? alacakPb);
        const mahsup = fmt(Number(o.tutar ?? 0));
        const kasa = fmt(Number(o.kasa_tutari ?? o.tutar ?? 0));
        const kurStr = rateToFixed8(o.kur == null ? null : Number(o.kur));
        const isCross = odemePb !== alacakPb;
        const kurOzeti =
          isCross && o.kur != null ? formatKurOzeti(alacakPb, odemePb, Number(o.kur)) : null;
        const caprazOzet = isCross
          ? `Tahsil edilen: ${kasa} ${odemePb} / Borca mahsup: ${mahsup} ${alacakPb}${kurOzeti ? ` / Kur: ${kurOzeti}` : ""}`
          : null;
        return {
          id: Number(o.id),
          odemeTarihi: String(o.odeme_tarihi ?? ""),
          tutar: mahsup,
          alacakParaBirimi: alacakPb,
          odemeParaBirimi: odemePb,
          kasaTutari: kasa,
          kur: kurStr,
          kurOzeti,
          caprazOzet,
          odemeYontemi: String(o.odeme_yontemi ?? "NAKIT"),
          makbuzNo: String(o.makbuz_no ?? "—"),
          aciklama: o.aciklama == null ? null : String(o.aciklama),
        };
      }),
    });
  }

  const kalanVekalet = Math.max(0, anlasilan - odenenToplam);
  const tahsilatOrani = anlasilan > 0 ? Math.round((odenenToplam / anlasilan) * 10000) / 100 : 0;

  let avans = 0;
  let masraf = 0;
  let pozitifDuzeltme = 0;
  let negatifDuzeltme = 0;
  let running = 0;
  const hareketler: MuvekkilEkstrePayload["masrafHareketleri"] = [];

  for (const h of kasaRows) {
    const v = Number(h.tutar ?? 0);
    const tip = String(h.islem_tipi ?? "");
    let giris = 0;
    let cikis = 0;
    if (tip === "AVANS_GIRISI") {
      avans += v;
      giris = v;
      running += v;
    } else if (tip === "MASRAF") {
      masraf += v;
      cikis = v;
      running -= v;
    } else if (tip === "DUZELTME") {
      if (v >= 0) {
        pozitifDuzeltme += v;
        giris = v;
        running += v;
      } else {
        const abs = Math.abs(v);
        negatifDuzeltme += abs;
        cikis = abs;
        running += v;
      }
    }

    const masrafTuru = h.masraf_turu == null ? null : String(h.masraf_turu);
    const aciklama =
      tip === "MASRAF"
        ? [masrafTuru, h.aciklama == null ? null : String(h.aciklama)].filter(Boolean).join(" — ") || null
        : h.aciklama == null
          ? null
          : String(h.aciklama);

    hareketler.push({
      id: Number(h.id),
      tarih: String(h.tarih ?? ""),
      belgeNo: String(h.belge_no ?? "—"),
      islemTuru: tipEtiket(tip, v),
      aciklama,
      giris: fmt(giris),
      cikis: fmt(cikis),
      bakiyeSonrasi: fmt(running),
    });
  }

  const duzeltmeNet = pozitifDuzeltme - negatifDuzeltme;
  const bakiye = avans - masraf + duzeltmeNet;

  const ofisGelirHareketleri = ofisGelirRows.map((h) => {
    const personelAd =
      (h.tahsilati_yapan_kullanici_adi == null ? null : String(h.tahsilati_yapan_kullanici_adi).trim()) ||
      (h.olusturan_kullanici_adi == null ? null : String(h.olusturan_kullanici_adi).trim()) ||
      null;
    const pb = tryResolveParaBirimi(h.para_birimi);
    return {
      id: Number(h.id),
      tarih: String(h.tarih ?? ""),
      belgeNo: String(h.belge_no ?? "—"),
      kategori: (h.ozel_kategori_adi == null ? null : String(h.ozel_kategori_adi).trim()) || String(h.kategori ?? "—"),
      aciklama: h.aciklama == null ? null : String(h.aciklama),
      odemeYontemi: String(h.odeme_yontemi ?? "NAKIT"),
      personelAd,
      tutar: fmt(Number(h.tutar ?? 0)),
      paraBirimi: pb,
    };
  });

  const ofisByCurrency = {} as MuvekkilEkstrePayload["dosyaDisiOfisGelirleri"]["byCurrency"];
  for (const pb of PARA_BIRIMLERI) {
    const pbHareketler = ofisGelirHareketleri.filter((x) => x.paraBirimi === pb);
    const toplam = pbHareketler.reduce((s, x) => s + Number(x.tutar), 0);
    ofisByCurrency[pb] = { toplam: fmt(toplam), hareketler: pbHareketler };
  }
  const ofisGelirToplam = ofisByCurrency.TRY.toplam;

  const office = officeSettingsGet();
  const ekstreTarihi = ymdTr(new Date());
  const belgeRef = opts?.belgeRef?.trim() || makeBelgeRef();

  const gorunenAd =
    muvekkil.muvekkilTuru === "TUZEL_KISI"
      ? (muvekkil.sirketUnvani ?? "").trim() || muvekkil.adSoyad.trim()
      : muvekkil.adSoyad.trim();

  const data: MuvekkilEkstrePayload = {
    belgeRef,
    ekstreTarihi,
    itibariyleTarih: itibariyleYmd,
    itibariyleAciklama: `${itibariyleYmd} tarihi itibarıyla`,
    buro: {
      buroAdi: (office.ofisAdi ?? "").trim() || DEFAULT_OFIS_ADI,
      telefon: office.telefon,
      eposta: office.eposta,
      adres: office.adres,
    },
    muvekkil: {
      id: muvekkil.id,
      gorunenAd: gorunenAd || "—",
      telefonVar: Boolean((muvekkil.telefon ?? "").trim()),
    },
    dosya: {
      id: dosya.id,
      konuBasligi: (dosya.konuBasligi ?? "").trim() || "—",
      dosyaNo: (dosya.dosyaNumarasi ?? "").trim() || null,
      mahkeme: (dosya.mahkemeAdi ?? "").trim() || null,
      icraDairesi: null,
    },
    vekaletOzeti: {
      paraBirimi: vekaletParaBirimi,
      kararlastirilanToplam: fmt(anlasilan),
      tahsilEdilenToplam: fmt(odenenToplam),
      kalanToplam: fmt(kalanVekalet),
      tahsilatOrani,
      gecikmisToplam: fmt(gecikmisToplam),
      sonrakiTaksitVade: sonrakiVade,
      sonrakiTaksitTutar: sonrakiTutar,
    },
    taksitler: taksitlerOut,
    masrafAvansiOzeti: {
      toplamAlinanAvans: fmt(avans),
      toplamMasraf: fmt(masraf),
      pozitifDuzeltme: fmt(pozitifDuzeltme),
      negatifDuzeltme: fmt(negatifDuzeltme),
      muvekkileIade: fmt(negatifDuzeltme),
      guncelBakiye: fmt(bakiye),
    },
    masrafHareketleri: hareketler,
    dosyaDisiOfisGelirleri: {
      toplam: ofisGelirToplam,
      byCurrency: ofisByCurrency,
      hareketler: ofisGelirHareketleri,
    },
    dipnot:
      "Bu ekstre bilgilendirme amaçlıdır; serbest meslek makbuzu veya tahsilat makbuzu yerine geçmez. Dosya dışı ofis gelirleri vekalet ve icra borç/tahsilat toplamlarına dahil edilmez.",
  };

  return { ok: true, data };
}
