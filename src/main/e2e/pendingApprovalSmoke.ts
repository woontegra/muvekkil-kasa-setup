import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb, getDb, nowIso } from "../db/connection";
import { runMigrations } from "../db/migrate";
import { allMigrations } from "../migrations";
import { kasaAvansEkleInTx, kasaHareketEkle, kasaHareketGet, hesaplaAvansBakiye } from "../services/kasa.service";
import { finalizePendingApprovals } from "../services/pendingApproval.service";
import {
  vekaletKaydet,
  vekaletTaksitEkle,
  vekaletTaksitOdemeAl,
} from "../services/vekalet.service";
import { OFIS_KASA_KAYNAK_VEKALET_TAHSILATI } from "@shared/constants/ofisKasa";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export async function runPendingApprovalSmoke(): Promise<void> {
  const dbPath = join(tmpdir(), `mkd-pending-approval-${Date.now()}.sqlite`);
  process.env.MKD_TEST_DB = dbPath;

  try {
    const db = getDb();
    runMigrations(db, allMigrations, nowIso);
    const t = nowIso();

    db.prepare(
      `INSERT INTO muvekkil (muvekkil_turu, ad_soyad, kayit_tarihi, guncelleme_tarihi) VALUES ('GERCEK_KISI', 'Onay Test', ?, ?)`,
    ).run(t, t);
    const muvekkilId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);
    db.prepare(
      `INSERT INTO dosya (muvekkil_id, konu_basligi, durum, kayit_tarihi, guncelleme_tarihi) VALUES (?, 'Onay Dosya', 'AKTIF', ?, ?)`,
    ).run(muvekkilId, t, t);
    const dosyaId = Number(db.prepare(`SELECT last_insert_rowid() AS id`).get().id);

    const avans = kasaAvansEkleInTx(db, {
      dosyaId,
      muvekkilId,
      tutar: 2500,
      tarih: "2026-07-01",
      odemeYontemi: "NAKIT",
      aciklama: null,
      t,
    });
    const avansRow = kasaHareketGet(avans.id);
    assert(avansRow?.onayDurumu === "ONAYSIZ", "Avans ONAYSIZ başlamalı");

    const masrafRes = kasaHareketEkle({
      dosyaId,
      muvekkilId,
      islemTipi: "MASRAF",
      tutar: 1500,
      tarih: "2026-07-01",
      masrafTuru: "Gider Avansı",
      odemeYontemi: "Nakit",
      aciklama: null,
    });
    assert(masrafRes.ok, masrafRes.ok ? "" : masrafRes.error);
    const masrafId = masrafRes.row.id;
    const masrafBelgeNo = masrafRes.row.belgeNo;
    assert(masrafRes.row.onayDurumu === "ONAYSIZ", "Masraf ONAYSIZ başlamalı");
    const hareketSayisiOnce = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ?`).get(dosyaId).c,
    );
    const ozetOnce = hesaplaAvansBakiye(dosyaId);

    const vk = vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar: 10000 });
    assert(vk.ok, vk.ok ? "" : vk.error);
    const taksit = vekaletTaksitEkle(vk.row.id, { tutar: 5000, taksitNo: 1, vadeTarihi: "2026-07-15" });
    assert(taksit.ok, taksit.ok ? "" : taksit.error);
    const odeme = vekaletTaksitOdemeAl(taksit.row.id, {
      tutar: 5000,
      odemeTarihi: "2026-07-10",
      odemeYontemi: "NAKIT",
      aciklama: null,
    });
    assert(odeme.ok, odeme.ok ? "" : odeme.error);
    assert(odeme.row.odeme.ofisKasaHareketId != null, "Ofis kasa hareketi oluşmalı");

    const ofisId = odeme.row.odeme.ofisKasaHareketId!;
    const ofisOnce = db.prepare(`SELECT onay_durumu, kaynak_tipi FROM ofis_kasa_hareketleri WHERE id = ?`).get(ofisId) as {
      onay_durumu: string;
      kaynak_tipi: string;
    };
    assert(ofisOnce.onay_durumu === "ONAYSIZ", "Vekalet tahsilat ONAYSIZ");
    assert(ofisOnce.kaynak_tipi === OFIS_KASA_KAYNAK_VEKALET_TAHSILATI, "Kaynak tipi vekalet");

    const ofisCountOnce = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri WHERE kaynak_id = ?`).get(odeme.row.odeme.id).c,
    );
    assert(ofisCountOnce === 1, "Tek ofis kasa hareketi");

    const r1 = finalizePendingApprovals();
    assert(r1.avansApproved === 1, `avans onay: ${r1.avansApproved}`);
    assert(r1.masrafApproved === 1, `masraf onay: ${r1.masrafApproved}`);
    assert(r1.vekaletTahsilatApproved === 1, `vekalet onay: ${r1.vekaletTahsilatApproved}`);
    assert(r1.errors.length === 0, `hatalar: ${JSON.stringify(r1.errors)}`);

    const avansSonra = kasaHareketGet(avans.id);
    assert(avansSonra?.onayDurumu === "ONAYLI", "Avans ONAYLI olmalı");
    assert(avansSonra?.otomatikOnayMi === true, "Otomatik onay bayrağı");

    const masrafSonra = kasaHareketGet(masrafId);
    assert(masrafSonra?.onayDurumu === "ONAYLI", "Masraf ONAYLI olmalı");
    assert(masrafSonra?.otomatikOnayMi === true, "Masraf otomatik onay bayrağı");
    assert(masrafSonra?.belgeNo === masrafBelgeNo, "Masraf belge no değişmemeli");
    const hareketSayisiOnaySonra = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM dosya_kasa_hareket WHERE dosya_id = ?`).get(dosyaId).c,
    );
    assert(hareketSayisiOnaySonra === hareketSayisiOnce, "Onayda yeni hareket oluşmamalı");
    const ozetOnaySonra = hesaplaAvansBakiye(dosyaId);
    assert(ozetOnaySonra.toplamMasraf === ozetOnce.toplamMasraf, "Toplam masraf onayda değişmemeli");
    assert(ozetOnaySonra.kalanAvans === ozetOnce.kalanAvans, "Kalan avans onayda değişmemeli");

    const ofisSonra = db.prepare(`SELECT onay_durumu, otomatik_onay_mi FROM ofis_kasa_hareketleri WHERE id = ?`).get(ofisId) as {
      onay_durumu: string;
      otomatik_onay_mi: number;
    };
    assert(ofisSonra.onay_durumu === "ONAYLI", "Vekalet tahsilat ONAYLI");
    assert(ofisSonra.otomatik_onay_mi === 1, "Ofis otomatik onay");

    const r2 = finalizePendingApprovals();
    assert(r2.avansApproved === 0 && r2.masrafApproved === 0 && r2.vekaletTahsilatApproved === 0, "İkinci finalize yeni onay yapmamalı");
    assert(r2.skippedAlreadyApproved >= 0, "Zaten onaylı atlandı");
    const ozetIkinci = hesaplaAvansBakiye(dosyaId);
    assert(ozetIkinci.toplamMasraf === ozetOnaySonra.toplamMasraf, "İkinci finalize toplam masraf değişmemeli");
    assert(ozetIkinci.kalanAvans === ozetOnaySonra.kalanAvans, "İkinci finalize kalan avans değişmemeli");

    const ofisCountSonra = Number(
      db.prepare(`SELECT COUNT(*) AS c FROM ofis_kasa_hareketleri WHERE kaynak_id = ?`).get(odeme.row.odeme.id).c,
    );
    assert(ofisCountSonra === 1, "İkinci onayda ekstra ofis hareketi oluşmamalı");

    console.log("[PASS] Bekleyen avans + masraf + vekalet tahsilat otomatik onay (idempotent)");

    // Başlangıç kurtarma: kapanış finalizer çalışmamış gibi bekleyen kayıtlar
    const avans2 = kasaAvansEkleInTx(db, {
      dosyaId,
      muvekkilId,
      tutar: 100,
      tarih: "2026-07-02",
      odemeYontemi: "NAKIT",
      aciklama: null,
      t: nowIso(),
    });
    const masraf2Res = kasaHareketEkle({
      dosyaId,
      muvekkilId,
      islemTipi: "MASRAF",
      tutar: 200,
      tarih: "2026-07-02",
      masrafTuru: "Harç",
      odemeYontemi: "Nakit",
      aciklama: null,
    });
    assert(masraf2Res.ok, masraf2Res.ok ? "" : masraf2Res.error);
    const rStartup = finalizePendingApprovals();
    assert(rStartup.avansApproved === 1, "Başlangıç kurtarma avans onayı");
    assert(rStartup.masrafApproved === 1, "Başlangıç kurtarma masraf onayı");
    assert(kasaHareketGet(avans2.id)?.onayDurumu === "ONAYLI", "Kurtarma sonrası avans ONAYLI");
    assert(kasaHareketGet(masraf2Res.row.id)?.onayDurumu === "ONAYLI", "Kurtarma sonrası masraf ONAYLI");
    const rStartup2 = finalizePendingApprovals();
    assert(rStartup2.avansApproved === 0 && rStartup2.masrafApproved === 0, "İkinci açılışta yeniden onay yok");

    console.log("[PASS] Başlangıç kurtarma (Test I)");
    console.log("\n=== Pending approval smoke: TÜM ADIMLAR GEÇTİ ===");
  } finally {
    closeDb();
    delete process.env.MKD_TEST_DB;
    try {
      unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  }
}
