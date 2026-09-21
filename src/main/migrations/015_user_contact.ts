import type { Migration } from "../db/migrate";

export const migration015UserContact: Migration = {
  id: "015_user_contact",
  up(db) {
    const cols = db.prepare(`PRAGMA table_info(uygulama_kullanici)`).all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("telefon")) {
      db.exec(`ALTER TABLE uygulama_kullanici ADD COLUMN telefon TEXT`);
    }
  },
};
