import { getDb, nowIso } from "../db/connection";
import { isAccountingPeriodMode } from "@shared/lib/accountingPeriod";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";

const KEY_MODE = "accounting_period_mode";
const DEFAULT_MODE: AccountingPeriodMode = "YEARLY";

export function appSettingGet(anahtar: string): string | null {
  const r = getDb().prepare(`SELECT deger FROM app_settings WHERE anahtar = ?`).get(anahtar) as
    | { deger: string }
    | undefined;
  return r?.deger ?? null;
}

export function appSettingSet(anahtar: string, deger: string): void {
  const t = nowIso();
  getDb()
    .prepare(
      `INSERT INTO app_settings (anahtar, deger, guncelleme_tarihi) VALUES (?,?,?)
       ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger, guncelleme_tarihi = excluded.guncelleme_tarihi`,
    )
    .run(anahtar, deger, t);
}

export function getAccountingPeriodMode(): AccountingPeriodMode {
  const v = appSettingGet(KEY_MODE);
  if (isAccountingPeriodMode(v)) return v;
  return DEFAULT_MODE;
}

export function setAccountingPeriodMode(mode: AccountingPeriodMode): AccountingPeriodMode {
  if (!isAccountingPeriodMode(mode)) return getAccountingPeriodMode();
  appSettingSet(KEY_MODE, mode);
  return mode;
}
