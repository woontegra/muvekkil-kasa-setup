import { getDb, nowIso } from "../db/connection";
import type { KasaMakbuzPaketi, MakbuzEnsureSonuc } from "@shared/types/makbuz";
import { dosyaGet } from "./dosya.service";
import { kasaHareketGet } from "./kasa.service";
import { muvekkilGet } from "./muvekkil.service";
import { officeSettingsGetForMakbuz } from "./office.service";

function bugunYmd(): string {
  return nowIso().slice(0, 10);
}

function makbuzTipiUygun(islemTipi: string): boolean {
  return islemTipi === "AVANS_GIRISI" || islemTipi === "MASRAF" || islemTipi === "DUZELTME";
}

export function makbuzNoAtaEgerYoksa(hareketId: number): MakbuzEnsureSonuc {
  const cur = kasaHareketGet(hareketId);
  if (!cur) return { ok: false, error: "İşlem bulunamadı" };
  if (!makbuzTipiUygun(cur.islemTipi)) {
    return { ok: false, error: "Bu işlem tipi için makbuz üretilemez" };
  }
  if (cur.onayDurumu !== "ONAYLI") {
    return { ok: false, error: "Makbuz yalnızca onaylı işlemler için düzenlenebilir" };
  }
  if (cur.makbuzNo?.trim()) return { ok: true, makbuzNo: cur.makbuzNo.trim() };
  const yil = new Date().getFullYear();
  const makbuzGun = bugunYmd();
  const d = getDb();
  try {
    const makbuzNo = d.transaction(() => {
      const row = d.prepare(`SELECT son_sira FROM makbuz_sayac WHERE yil = ?`).get(yil) as { son_sira: number } | undefined;
      const next = (row?.son_sira ?? 0) + 1;
      if (row) {
        d.prepare(`UPDATE makbuz_sayac SET son_sira = ? WHERE yil = ?`).run(next, yil);
      } else {
        d.prepare(`INSERT INTO makbuz_sayac (yil, son_sira) VALUES (?, ?)`).run(yil, next);
      }
      const no = `MAK-${yil}-${String(next).padStart(6, "0")}`;
      d.prepare(
        `UPDATE dosya_kasa_hareket SET makbuz_no = ?, makbuz_olusturuldu_mu = 1, makbuz_tarihi = ? WHERE id = ?`
      ).run(no, makbuzGun, hareketId);
      return no;
    })();
    return { ok: true, makbuzNo };
  } catch (e) {
    console.error("[makbuzNoAtaEgerYoksa]", e);
    return { ok: false, error: "Makbuz numarası oluşturulamadı" };
  }
}

export const ensureReceiptNumberForTransaction = makbuzNoAtaEgerYoksa;

export function makbuzYazdirmaPaketiGetir(hareketId: number): KasaMakbuzPaketi {
  const cur = kasaHareketGet(hareketId);
  if (!cur) return { ok: false, error: "ISLEM_YOK", mesaj: "İşlem bulunamadı." };
  if (!makbuzTipiUygun(cur.islemTipi)) {
    return { ok: false, error: "TIP_UYGUN_DEGIL", mesaj: "Bu işlem tipi için makbuz düzenlenemez." };
  }
  if (cur.onayDurumu !== "ONAYLI") {
    return { ok: false, error: "ONAYSIZ", mesaj: "Makbuz yalnızca onaylı işlemler için düzenlenebilir." };
  }
  const at = makbuzNoAtaEgerYoksa(hareketId);
  if (!at.ok) return { ok: false, error: "ISLEM_YOK", mesaj: at.error };
  const h = kasaHareketGet(hareketId);
  if (!h) return { ok: false, error: "ISLEM_YOK", mesaj: "İşlem bulunamadı." };
  const dosyaRow = dosyaGet(h.dosyaId);
  const muvekkilRow = muvekkilGet(h.muvekkilId);
  if (!dosyaRow || !muvekkilRow) {
    return { ok: false, error: "ISLEM_YOK", mesaj: "Dosya veya müvekkil bulunamadı." };
  }
  return {
    ok: true,
    office: officeSettingsGetForMakbuz(),
    muvekkil: muvekkilRow,
    dosya: dosyaRow,
    hareket: h,
  };
}

export function getReceiptDataByTransactionId(hareketId: number): KasaMakbuzPaketi {
  return makbuzYazdirmaPaketiGetir(hareketId);
}
