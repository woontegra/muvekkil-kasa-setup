import { getDb } from "../db/connection";

import { DOSYA_KASA_VEKALET_HARIC_SQL, kasaHareketOnaylaOtomatik } from "./kasa.service";
import { KASA_AKTIF_SQL, OFIS_KASA_AKTIF_SQL } from "./kasaAktifSql";

import { OFIS_KASA_KAYNAK_VEKALET_TAHSILATI } from "@shared/constants/ofisKasa";

import { nowIso } from "../db/connection";



const OTOMATIK_ONAYLAYAN_AD = "Otomatik (kapanış)";



export type PendingApprovalFinalizeResult = {

  avansApproved: number;

  masrafApproved: number;

  vekaletTahsilatApproved: number;

  ofisDigerApproved: number;

  skippedAlreadyApproved: number;

  errors: Array<{ id: number; kind: "avans" | "masraf" | "ofis"; message: string }>;

};



type AutoApproveResult = { ok: true; already?: boolean } | { ok: false; error: string };



function ofisKasaOnaylaOtomatik(id: number): AutoApproveResult {

  const d = getDb();

  const row = d.prepare(`SELECT onay_durumu FROM ofis_kasa_hareketleri WHERE id = ?`).get(id) as

    | { onay_durumu: string }

    | undefined;

  if (!row) return { ok: false, error: "İşlem bulunamadı" };

  if (row.onay_durumu === "ONAYLI") return { ok: true, already: true };

  const t = nowIso();

  d.prepare(

    `UPDATE ofis_kasa_hareketleri SET onay_durumu = 'ONAYLI', onay_tarihi = ?, otomatik_onay_mi = 1,

     onaylayan_kullanici_id = NULL, onaylayan_kullanici_adi = ?, guncelleme_tarihi = ? WHERE id = ?`,

  ).run(t, OTOMATIK_ONAYLAYAN_AD, t, id);

  return { ok: true };

}



function dosyaKasaOnaylaOtomatik(

  id: number,

  kind: "avans" | "masraf",

  expectedTip: "AVANS_GIRISI" | "MASRAF",

): AutoApproveResult {

  const r = kasaHareketOnaylaOtomatik(id);

  if (!r.ok) return r;

  if (r.already) return { ok: true, already: true };

  if (r.row.islemTipi !== expectedTip) {

    return { ok: false, error: `Beklenen işlem tipi ${expectedTip}, bulunan ${r.row.islemTipi}` };

  }

  return { ok: true };

}



/**

 * Bekleyen dosya avansları, masraflar ve Ofis Kasası (vekalet tahsilatı dahil) kayıtlarını onaylar.

 * Manuel onayla aynı status güncellemesi; ek kasa hareketi oluşturmaz (idempotent).

 */

export function finalizePendingApprovals(): PendingApprovalFinalizeResult {

  const d = getDb();

  const errors: PendingApprovalFinalizeResult["errors"] = [];

  let avansApproved = 0;

  let masrafApproved = 0;

  let vekaletTahsilatApproved = 0;

  let ofisDigerApproved = 0;

  let skippedAlreadyApproved = 0;



  const avansRows = d

    .prepare(

      `SELECT id FROM dosya_kasa_hareket

       WHERE onay_durumu = 'ONAYSIZ' AND islem_tipi = 'AVANS_GIRISI' ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}`,

    )

    .all() as { id: number }[];



  for (const { id } of avansRows) {

    const r = dosyaKasaOnaylaOtomatik(id, "avans", "AVANS_GIRISI");

    if (r.ok) {

      if (r.already) skippedAlreadyApproved += 1;

      else avansApproved += 1;

    } else {

      errors.push({ id, kind: "avans", message: r.error });

    }

  }



  const masrafRows = d

    .prepare(

      `SELECT id FROM dosya_kasa_hareket

       WHERE onay_durumu = 'ONAYSIZ' AND islem_tipi = 'MASRAF' ${KASA_AKTIF_SQL} ${DOSYA_KASA_VEKALET_HARIC_SQL}`,

    )

    .all() as { id: number }[];



  for (const { id } of masrafRows) {

    const r = dosyaKasaOnaylaOtomatik(id, "masraf", "MASRAF");

    if (r.ok) {

      if (r.already) skippedAlreadyApproved += 1;

      else masrafApproved += 1;

    } else {

      errors.push({ id, kind: "masraf", message: r.error });

    }

  }



  const ofisRows = d

    .prepare(`SELECT id, kaynak_tipi FROM ofis_kasa_hareketleri WHERE onay_durumu = 'ONAYSIZ' ${OFIS_KASA_AKTIF_SQL}`)

    .all() as { id: number; kaynak_tipi: string | null }[];



  for (const row of ofisRows) {

    const r = ofisKasaOnaylaOtomatik(row.id);

    if (r.ok) {

      if (r.already) {

        skippedAlreadyApproved += 1;

      } else if (row.kaynak_tipi === OFIS_KASA_KAYNAK_VEKALET_TAHSILATI) {

        vekaletTahsilatApproved += 1;

      } else {

        ofisDigerApproved += 1;

      }

    } else {

      errors.push({ id: row.id, kind: "ofis", message: r.error });

    }

  }



  return {

    avansApproved,

    masrafApproved,

    vekaletTahsilatApproved,

    ofisDigerApproved,

    skippedAlreadyApproved,

    errors,

  };

}



export function logPendingApprovalResult(prefix: string, result: PendingApprovalFinalizeResult): void {

  const total =

    result.avansApproved + result.masrafApproved + result.vekaletTahsilatApproved + result.ofisDigerApproved;

  if (total > 0 || result.errors.length > 0) {

    console.log(

      `[${prefix}] otomatik onay: avans=${result.avansApproved} masraf=${result.masrafApproved} vekalet_tahsilat=${result.vekaletTahsilatApproved} ofis_diger=${result.ofisDigerApproved} atlandi=${result.skippedAlreadyApproved} hata=${result.errors.length}`,

    );

  }

  for (const e of result.errors) {

    console.error(`[${prefix}] otomatik onay hata id=${e.id} kind=${e.kind} msg=${e.message}`);

  }

}


