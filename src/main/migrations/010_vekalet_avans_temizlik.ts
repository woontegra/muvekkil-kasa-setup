import type { Migration } from "../db/migrate";

/** Eski sürümde vekalet tahsilatı dosya kasasına (avans) yanlış yazılmış kayıtları temizler. */
export const migration010VekaletAvansTemizlik: Migration = {
  id: "010_vekalet_avans_temizlik",
  up(db) {
    db.transaction(() => {
      const linked = db
        .prepare(`SELECT kasa_hareket_id AS id FROM vekalet_taksit_odeme WHERE kasa_hareket_id IS NOT NULL`)
        .all() as { id: number }[];
      const kasaIds = linked.map((r) => r.id).filter((id) => Number.isFinite(id) && id > 0);

      db.prepare(`UPDATE vekalet_taksit_odeme SET kasa_hareket_id = NULL WHERE kasa_hareket_id IS NOT NULL`).run();

      if (kasaIds.length > 0) {
        const ph = kasaIds.map(() => "?").join(",");
        db.prepare(
          `DELETE FROM dosya_kasa_hareket WHERE islem_tipi = 'DUZELTME' AND duzeltilen_islem_id IN (${ph})`
        ).run(...kasaIds);
        db.prepare(`DELETE FROM dosya_kasa_hareket WHERE id IN (${ph})`).run(...kasaIds);
      }

      db.prepare(
        `DELETE FROM dosya_kasa_hareket
         WHERE islem_tipi = 'AVANS_GIRISI'
           AND aciklama IS NOT NULL
           AND trim(aciklama) != ''
           AND (aciklama LIKE 'Vekalet taksit%' OR aciklama LIKE 'Vekalet tahsilat%')`
      ).run();
    })();
  },
};
