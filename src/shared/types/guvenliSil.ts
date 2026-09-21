export type GuvenliSilInput = {
  sifre: string;
  silmeNedeni: string;
};

export type GuvenliSilSonuc =
  | { ok: true; softDeletedIds: number[]; auditMessage: string }
  | { ok: false; error: string };
