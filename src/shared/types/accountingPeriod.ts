export type AccountingPeriodMode = "MONTHLY" | "YEARLY";

export type AccountingPeriod = {
  mode: AccountingPeriodMode;
  /** YYYY-MM-DD */
  bas: string;
  /** YYYY-MM-DD */
  bit: string;
  /** örn. "Temmuz 2026" veya "2026 Yılı" */
  etiket: string;
};

export type AccountingPeriodSummary = {
  mode: AccountingPeriodMode;
  period: AccountingPeriod;
  isCurrent: boolean;
  canGoNext: boolean;
  devredenBakiye: number;
  donemGelir: number;
  donemGider: number;
  donemDuzeltmeEtkisi: number;
  /** gelir - gider + düzeltme (kasa bakiyesi ile uyumlu) */
  donemNetSonucu: number;
  kasaBakiyesi: number;
  bugunGider: number;
};
