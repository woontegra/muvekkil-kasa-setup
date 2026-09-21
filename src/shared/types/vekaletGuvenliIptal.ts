import type { GuvenliSilInput } from "./guvenliSil";

export type VekaletGuvenliIptalSonuc =
  | { ok: true; alreadyDone?: boolean; softDeletedIds?: number[]; auditMessage: string }
  | { ok: false; error: string };

export type { GuvenliSilInput as VekaletGuvenliIptalInput };
