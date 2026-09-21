/**
 * SaaS maliKontrol.service.ts paritesi — 10 kural, dönem bağımsız canlı snapshot.
 * Rol: çağıran IPC YONETICI olmalı (BURO_SAHIBI | AVUKAT_YONETICI).
 */
import { moneyToFixed2, type ParaBirimi } from "@shared/lib/paraBirimi";
import { ODEME_AKTIF_OFIS_SQL, TAKSIT_AKTIF_SQL, VEKALET_AKTIF_SQL } from "@shared/lib/tahsilatOdemeAktif";
import type {
  MaliKontrolActionPayload,
  MaliKontrolActionTarget,
  MaliKontrolDosyaTab,
  MaliKontrolResponse,
  MaliKontrolSonuc,
  MaliKontrolUyari,
  UyariSeviyesi,
  UyariTuru,
} from "@shared/types/maliKontrol";
import { getDb } from "../db/connection";
const KASA_AKTIF_K = `AND k.silinme_tarihi IS NULL`;
const DOSYA_KASA_VEKALET_HARIC_K = `
  AND k.id NOT IN (SELECT kasa_hareket_id FROM vekalet_taksit_odeme WHERE kasa_hareket_id IS NOT NULL)
  AND NOT (
    k.islem_tipi = 'AVANS_GIRISI'
    AND trim(coalesce(k.aciklama, '')) != ''
    AND (k.aciklama LIKE 'Vekalet taksit%' OR k.aciklama LIKE 'Vekalet tahsilat%')
  )
`;

const EPS = 0.001;

const MUVEKKIL_AD_SQL = `CASE
    WHEN COALESCE(m.muvekkil_turu, 'GERCEK_KISI') = 'TUZEL_KISI'
      AND NULLIF(TRIM(m.sirket_unvani), '') IS NOT NULL
    THEN TRIM(m.sirket_unvani)
    ELSE TRIM(COALESCE(m.ad_soyad, ''))
  END`;

function fmt(n: number): string {
  return moneyToFixed2(n);
}

function fmtTry(n: number): string {
  return `${fmt(n)} TRY`;
}

function ymdLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return ymdLocal(dt);
}

function dosyaBaslik(konu: string | null, no: string | null): string {
  const k = (konu ?? "").trim() || "Dosya";
  const n = (no ?? "").trim();
  return n ? `${k} (${n})` : k;
}

function buildAction(
  muvekkilId: number,
  dosyaId: number,
  target: MaliKontrolActionTarget,
  tab: MaliKontrolDosyaTab,
  extra?: Pick<MaliKontrolActionPayload, "taksitId" | "odemeId" | "kasaHareketiId" | "kasaFilter">,
): { actionTarget: MaliKontrolActionTarget; actionPayload: MaliKontrolActionPayload } {
  return {
    actionTarget: target,
    actionPayload: { muvekkilId, dosyaId, tab, ...extra },
  };
}

function seviyeRank(s: UyariSeviyesi): number {
  if (s === "KRITIK") return 0;
  if (s === "UYARI") return 1;
  return 2;
}

export function getMaliKontrolUyarilari(): MaliKontrolResponse {
  const d = getDb();
  const bugun = ymdLocal();
  const ucGunSonra = addDaysYmd(bugun, 3);
  const doksanGunOnce = addDaysYmd(bugun, -90);

  const uyarilar: MaliKontrolUyari[] = [];
  const seen = new Set<string>();

  function addUyari(u: MaliKontrolUyari) {
    const key = `${u.tur}:${u.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    uyarilar.push(u);
  }

  // Taksitler (iptal hariç) + aktif ödeme toplamı
  const taksitler = d
    .prepare(
      `SELECT t.id, t.taksit_no, t.tutar, t.vade_tarihi, t.dosya_id, t.vekalet_ucreti_id,
              dos.muvekkil_id, dos.konu_basligi, dos.dosya_numarasi, dos.durum AS dosya_durum,
              ${MUVEKKIL_AD_SQL} AS muvekkil_ad,
              COALESCE((
                SELECT SUM(o.tutar) FROM vekalet_taksit_odeme o
                WHERE o.taksit_id = t.id AND ${ODEME_AKTIF_OFIS_SQL}
              ), 0) AS odenen
       FROM vekalet_ucreti_taksit t
       INNER JOIN anlasilan_vekalet_ucreti v ON v.id = t.vekalet_ucreti_id
       INNER JOIN dosya dos ON dos.id = t.dosya_id
       INNER JOIN muvekkil m ON m.id = dos.muvekkil_id
       WHERE ${TAKSIT_AKTIF_SQL} AND ${VEKALET_AKTIF_SQL}`,
    )
    .all() as Record<string, unknown>[];

  for (const t of taksitler) {
    const tutar = Number(t.tutar ?? 0);
    const odenen = Number(t.odenen ?? 0);
    const kalan = Math.max(0, tutar - odenen);
    if (kalan <= EPS) continue;
    const vade = String(t.vade_tarihi ?? "").slice(0, 10);
    const mid = Number(t.muvekkil_id);
    const did = Number(t.dosya_id);
    const tid = Number(t.id);
    const baslik = dosyaBaslik(
      t.konu_basligi == null ? null : String(t.konu_basligi),
      t.dosya_numarasi == null ? null : String(t.dosya_numarasi),
    );
    const mad = String(t.muvekkil_ad ?? "").trim() || "—";
    const tno = Number(t.taksit_no ?? 0);
    const base = {
      muvekkilId: mid,
      muvekkilAd: mad,
      dosyaId: did,
      dosyaBaslik: baslik,
      tutar: fmt(kalan),
      paraBirimi: "TRY" as ParaBirimi,
      tarih: vade || null,
      ...buildAction(mid, did, "VEKALET_TAKSIT", "genel", { taksitId: tid }),
    };

    if (vade && vade < bugun) {
      addUyari({
        id: String(tid),
        tur: "VADESI_GECMIS_TAKSIT",
        seviye: "KRITIK",
        aciklama: `Taksit ${tno} vadesi geçmiş; kalan: ${fmtTry(kalan)}`,
        ...base,
      });
    } else if (vade && vade <= ucGunSonra) {
      addUyari({
        id: String(tid),
        tur: "VAKLASAN_VADE",
        seviye: "UYARI",
        aciklama: `Taksit ${tno} 3 gün içinde vadesi dolacak; kalan: ${fmtTry(kalan)}`,
        ...base,
      });
    } else if (odenen > EPS) {
      addUyari({
        id: String(tid),
        tur: "KISMI_ODEME_KALAN",
        seviye: "BILGI",
        aciklama: `Taksit ${tno} kısmi ödenmiş; kalan: ${fmtTry(kalan)}`,
        ...base,
      });
    }
  }

  // Avans bakiyesi (dosya bazlı, ONAYLI)
  const kasaRows = d
    .prepare(
      `SELECT k.dosya_id, k.islem_tipi, k.tutar,
              dos.muvekkil_id, dos.konu_basligi, dos.dosya_numarasi, dos.durum,
              ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM dosya_kasa_hareket k
       INNER JOIN dosya dos ON dos.id = k.dosya_id
       INNER JOIN muvekkil m ON m.id = dos.muvekkil_id
       WHERE k.onay_durumu = 'ONAYLI' ${KASA_AKTIF_K} ${DOSYA_KASA_VEKALET_HARIC_K}`,
    )
    .all() as Record<string, unknown>[];

  type AvansAgg = {
    avans: number;
    masraf: number;
    duzeltme: number;
    muvekkilId: number;
    dosyaBaslik: string;
    muvekkilAd: string;
    durum: string;
  };
  const avansMap = new Map<number, AvansAgg>();
  for (const r of kasaRows) {
    const dosyaId = Number(r.dosya_id);
    let e = avansMap.get(dosyaId);
    if (!e) {
      e = {
        avans: 0,
        masraf: 0,
        duzeltme: 0,
        muvekkilId: Number(r.muvekkil_id),
        dosyaBaslik: dosyaBaslik(
          r.konu_basligi == null ? null : String(r.konu_basligi),
          r.dosya_numarasi == null ? null : String(r.dosya_numarasi),
        ),
        muvekkilAd: String(r.muvekkil_ad ?? "").trim() || "—",
        durum: String(r.durum ?? "AKTIF"),
      };
      avansMap.set(dosyaId, e);
    }
    const tip = String(r.islem_tipi);
    const v = Number(r.tutar ?? 0);
    if (tip === "AVANS_GIRISI") e.avans += v;
    else if (tip === "MASRAF") e.masraf += v;
    else if (tip === "DUZELTME") e.duzeltme += v;
  }

  for (const [dosyaId, a] of avansMap) {
    const bakiye = a.avans - a.masraf + a.duzeltme;
    if (bakiye < -EPS) {
      const abs = Math.abs(bakiye);
      addUyari({
        id: `avans-neg-${dosyaId}`,
        tur: "NEGATIF_AVANS",
        seviye: "KRITIK",
        muvekkilId: a.muvekkilId,
        muvekkilAd: a.muvekkilAd,
        dosyaId,
        dosyaBaslik: a.dosyaBaslik,
        tutar: fmt(abs),
        paraBirimi: "TRY",
        tarih: null,
        aciklama: `Masraf avansı negatife düştü; büro ${fmtTry(abs)} karşılıyor`,
        ...buildAction(a.muvekkilId, dosyaId, "DOSYA_MALI", "maliOzet"),
      });
    }
  }

  // Kapalı dosyalar
  const kapali = d
    .prepare(
      `SELECT dos.id, dos.muvekkil_id, dos.konu_basligi, dos.dosya_numarasi, dos.durum,
              ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM dosya dos
       INNER JOIN muvekkil m ON m.id = dos.muvekkil_id
       WHERE UPPER(dos.durum) IN ('KAPANDI', 'PASIF', 'ARSIV')`,
    )
    .all() as Record<string, unknown>[];

  for (const dos of kapali) {
    const dosyaId = Number(dos.id);
    const mid = Number(dos.muvekkil_id);
    const mad = String(dos.muvekkil_ad ?? "").trim() || "—";
    const baslik = dosyaBaslik(
      dos.konu_basligi == null ? null : String(dos.konu_basligi),
      dos.dosya_numarasi == null ? null : String(dos.dosya_numarasi),
    );
    const agg = avansMap.get(dosyaId);
    const bakiye = agg ? agg.avans - agg.masraf + agg.duzeltme : 0;
    if (bakiye > EPS) {
      addUyari({
        id: `kapali-avans-${dosyaId}`,
        tur: "KAPALI_DOSYA_AVANS",
        seviye: "UYARI",
        muvekkilId: mid,
        muvekkilAd: mad,
        dosyaId,
        dosyaBaslik: baslik,
        tutar: fmt(bakiye),
        paraBirimi: "TRY",
        tarih: null,
        aciklama: `Kapalı dosyada ${fmtTry(bakiye)} masraf avansı bakiyesi bulunuyor`,
        ...buildAction(mid, dosyaId, "DOSYA_MALI", "maliOzet"),
      });
    }

    const vekaletRow = d
      .prepare(
        `SELECT id, anlasilan_tutar FROM anlasilan_vekalet_ucreti
         WHERE dosya_id = ? AND COALESCE(durum, 'AKTIF') = 'AKTIF' AND silinme_tarihi IS NULL`,
      )
      .get(dosyaId) as { id: number; anlasilan_tutar: number } | undefined;
    if (vekaletRow) {
      const odenen = Number(
        (
          d
            .prepare(
              `SELECT COALESCE(SUM(o.tutar), 0) AS s FROM vekalet_taksit_odeme o
               WHERE o.dosya_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
            )
            .get(dosyaId) as { s: number }
        ).s ?? 0,
      );
      const toplam = Number(vekaletRow.anlasilan_tutar ?? 0);
      const kalanAlacak = Math.max(0, toplam - odenen);
      if (kalanAlacak > EPS && toplam > EPS) {
        const ilkTaksit = d
          .prepare(
            `SELECT t.id, t.tutar,
                    COALESCE((SELECT SUM(o.tutar) FROM vekalet_taksit_odeme o
                      WHERE o.taksit_id = t.id AND ${ODEME_AKTIF_OFIS_SQL}), 0) AS odenen
             FROM vekalet_ucreti_taksit t
             WHERE t.vekalet_ucreti_id = ? AND ${TAKSIT_AKTIF_SQL}
             ORDER BY t.taksit_no ASC`,
          )
          .all(vekaletRow.id) as { id: number; tutar: number; odenen: number }[];
        let ilkKalanId: number | undefined;
        for (const t of ilkTaksit) {
          if (Number(t.tutar) - Number(t.odenen) > EPS) {
            ilkKalanId = Number(t.id);
            break;
          }
        }
        addUyari({
          id: `kapali-alacak-${dosyaId}`,
          tur: "KAPALI_DOSYA_ALACAK",
          seviye: "UYARI",
          muvekkilId: mid,
          muvekkilAd: mad,
          dosyaId,
          dosyaBaslik: baslik,
          tutar: fmt(kalanAlacak),
          paraBirimi: "TRY",
          tarih: null,
          aciklama: `Kapalı dosyada ${fmtTry(kalanAlacak)} tahsil edilmemiş vekalet ücreti alacağı var`,
          ...(ilkKalanId != null
            ? buildAction(mid, dosyaId, "VEKALET_TAKSIT", "genel", { taksitId: ilkKalanId })
            : buildAction(mid, dosyaId, "DOSYA_VEKALET", "genel")),
        });
      }
    }
  }

  // SMM kesilmemiş
  const smmRows = d
    .prepare(
      `SELECT o.id, o.tutar, o.odeme_tarihi, o.dosya_id, o.muvekkil_id,
              dos.konu_basligi, dos.dosya_numarasi, ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM vekalet_taksit_odeme o
       INNER JOIN dosya dos ON dos.id = o.dosya_id
       INNER JOIN muvekkil m ON m.id = o.muvekkil_id
       WHERE COALESCE(o.smm_kesildi_mi, 0) = 0 AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
    .all() as Record<string, unknown>[];

  for (const o of smmRows) {
    const mid = Number(o.muvekkil_id);
    const did = Number(o.dosya_id);
    const oid = Number(o.id);
    const tutar = Number(o.tutar ?? 0);
    addUyari({
      id: `smm-${oid}`,
      tur: "SMM_KESILMEMIS",
      seviye: "UYARI",
      muvekkilId: mid,
      muvekkilAd: String(o.muvekkil_ad ?? "").trim() || "—",
      dosyaId: did,
      dosyaBaslik: dosyaBaslik(
        o.konu_basligi == null ? null : String(o.konu_basligi),
        o.dosya_numarasi == null ? null : String(o.dosya_numarasi),
      ),
      tutar: fmt(tutar),
      paraBirimi: "TRY",
      tarih: String(o.odeme_tarihi ?? "").slice(0, 10) || null,
      aciklama: `${fmtTry(tutar)} tahsilat için SMM kesilmemiş`,
      ...buildAction(mid, did, "SMM_ODEME", "genel", { odemeId: oid }),
    });
  }

  // Onay bekleyen kasa
  const onaysiz = d
    .prepare(
      `SELECT k.id, k.tutar, k.tarih, k.islem_tipi, k.dosya_id,
              dos.muvekkil_id, dos.konu_basligi, dos.dosya_numarasi, ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM dosya_kasa_hareket k
       INNER JOIN dosya dos ON dos.id = k.dosya_id
       INNER JOIN muvekkil m ON m.id = dos.muvekkil_id
       WHERE k.onay_durumu = 'ONAYSIZ' ${KASA_AKTIF_K}`,
    )
    .all() as Record<string, unknown>[];

  const tipEtiket: Record<string, string> = {
    AVANS_GIRISI: "Avans girişi",
    MASRAF: "Masraf",
    DUZELTME: "Düzeltme",
    VEKALET_TAHSILAT: "Vekalet tahsilatı",
  };
  for (const r of onaysiz) {
    const mid = Number(r.muvekkil_id);
    const did = Number(r.dosya_id);
    const kid = Number(r.id);
    const tutar = Number(r.tutar ?? 0);
    const tip = String(r.islem_tipi ?? "");
    addUyari({
      id: `onay-${kid}`,
      tur: "ONAY_BEKLEYEN_KASA",
      seviye: "BILGI",
      muvekkilId: mid,
      muvekkilAd: String(r.muvekkil_ad ?? "").trim() || "—",
      dosyaId: did,
      dosyaBaslik: dosyaBaslik(
        r.konu_basligi == null ? null : String(r.konu_basligi),
        r.dosya_numarasi == null ? null : String(r.dosya_numarasi),
      ),
      tutar: fmt(tutar),
      paraBirimi: "TRY",
      tarih: String(r.tarih ?? "").slice(0, 10) || null,
      aciklama: `${tipEtiket[tip] ?? tip} onay bekliyor: ${fmtTry(tutar)}`,
      ...buildAction(mid, did, "KASA_HAREKET", "genel", {
        kasaHareketiId: kid,
        kasaFilter: "onaysiz",
      }),
    });
  }

  // Makbuz eksik
  const makbuzEksik = d
    .prepare(
      `SELECT o.id, o.tutar, o.odeme_tarihi, o.dosya_id, o.muvekkil_id,
              dos.konu_basligi, dos.dosya_numarasi, ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM vekalet_taksit_odeme o
       INNER JOIN dosya dos ON dos.id = o.dosya_id
       INNER JOIN muvekkil m ON m.id = o.muvekkil_id
       WHERE TRIM(COALESCE(o.makbuz_no, '')) = '' AND ${ODEME_AKTIF_OFIS_SQL}`,
    )
    .all() as Record<string, unknown>[];

  for (const o of makbuzEksik) {
    const mid = Number(o.muvekkil_id);
    const did = Number(o.dosya_id);
    const oid = Number(o.id);
    const tutar = Number(o.tutar ?? 0);
    addUyari({
      id: `makbuz-${oid}`,
      tur: "MAKBUZ_EKSIK",
      seviye: "BILGI",
      muvekkilId: mid,
      muvekkilAd: String(o.muvekkil_ad ?? "").trim() || "—",
      dosyaId: did,
      dosyaBaslik: dosyaBaslik(
        o.konu_basligi == null ? null : String(o.konu_basligi),
        o.dosya_numarasi == null ? null : String(o.dosya_numarasi),
      ),
      tutar: fmt(tutar),
      paraBirimi: "TRY",
      tarih: String(o.odeme_tarihi ?? "").slice(0, 10) || null,
      aciklama: `${fmtTry(tutar)} tahsilat için makbuz numarası eksik`,
      ...buildAction(mid, did, "MAKBUZ_ODEME", "genel", { odemeId: oid }),
    });
  }

  // Hareketsiz dosya (AKTIF, son aktivite > 90 gün)
  const aktifDosyalar = d
    .prepare(
      `SELECT dos.id, dos.muvekkil_id, dos.konu_basligi, dos.dosya_numarasi,
              dos.kayit_tarihi, dos.guncelleme_tarihi, ${MUVEKKIL_AD_SQL} AS muvekkil_ad
       FROM dosya dos
       INNER JOIN muvekkil m ON m.id = dos.muvekkil_id
       WHERE UPPER(COALESCE(dos.durum, 'AKTIF')) = 'AKTIF'`,
    )
    .all() as Record<string, unknown>[];

  for (const dos of aktifDosyalar) {
    const dosyaId = Number(dos.id);
    const mid = Number(dos.muvekkil_id);
    let last = String(dos.guncelleme_tarihi ?? dos.kayit_tarihi ?? "").slice(0, 10);
    const lastKasa = d
      .prepare(
        `SELECT MAX(substr(tarih,1,10)) AS t FROM dosya_kasa_hareket
         WHERE dosya_id = ? AND silinme_tarihi IS NULL`,
      )
      .get(dosyaId) as { t: string | null } | undefined;
    if (lastKasa?.t && lastKasa.t > last) last = lastKasa.t;
    const lastVade = d
      .prepare(
        `SELECT MAX(substr(t.vade_tarihi,1,10)) AS t FROM vekalet_ucreti_taksit t
         WHERE t.dosya_id = ? AND ${TAKSIT_AKTIF_SQL}`,
      )
      .get(dosyaId) as { t: string | null } | undefined;
    if (lastVade?.t && lastVade.t > last) last = lastVade.t;
    const lastOdeme = d
      .prepare(
        `SELECT MAX(substr(o.odeme_tarihi,1,10)) AS t FROM vekalet_taksit_odeme o
         WHERE o.dosya_id = ? AND ${ODEME_AKTIF_OFIS_SQL}`,
      )
      .get(dosyaId) as { t: string | null } | undefined;
    if (lastOdeme?.t && lastOdeme.t > last) last = lastOdeme.t;

    if (last && last < doksanGunOnce) {
      addUyari({
        id: `hareketsiz-${dosyaId}`,
        tur: "HAREKETSIZ_DOSYA",
        seviye: "BILGI",
        muvekkilId: mid,
        muvekkilAd: String(dos.muvekkil_ad ?? "").trim() || "—",
        dosyaId,
        dosyaBaslik: dosyaBaslik(
          dos.konu_basligi == null ? null : String(dos.konu_basligi),
          dos.dosya_numarasi == null ? null : String(dos.dosya_numarasi),
        ),
        tutar: null,
        paraBirimi: null,
        tarih: last,
        aciklama: `Dosyada 90 günden uzun süredir hareket yok (son: ${last})`,
        ...buildAction(mid, dosyaId, "DOSYA_GENEL", "genel"),
      });
    }
  }

  uyarilar.sort((a, b) => {
    const sr = seviyeRank(a.seviye) - seviyeRank(b.seviye);
    if (sr !== 0) return sr;
    const ta = a.tarih ?? "";
    const tb = b.tarih ?? "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  let kritikUyari = 0;
  let uyariUyari = 0;
  let bilgiUyari = 0;
  for (const u of uyarilar) {
    if (u.seviye === "KRITIK") kritikUyari += 1;
    else if (u.seviye === "UYARI") uyariUyari += 1;
    else bilgiUyari += 1;
  }

  return {
    toplamUyari: uyarilar.length,
    kritikUyari,
    uyariUyari,
    bilgiUyari,
    uyarilar,
  };
}

export function getMaliKontrolUyarilariGuarded(rol: string | null | undefined): MaliKontrolSonuc {
  const r = (rol ?? "").trim();
  if (!r) return { ok: false, error: "OTURUM_YOK", mesaj: "Oturum bulunamadı." };
  if (r !== "BURO_SAHIBI" && r !== "AVUKAT_YONETICI") {
    return { ok: false, error: "YETKISIZ", mesaj: "Mali kontrol yalnızca büro sahibi ve yönetici için açıktır." };
  }
  try {
    return { ok: true, data: getMaliKontrolUyarilari() };
  } catch (e) {
    return {
      ok: false,
      error: "HATA",
      mesaj: e instanceof Error ? e.message : "Mali kontrol yüklenemedi.",
    };
  }
}
