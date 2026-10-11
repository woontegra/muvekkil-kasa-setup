export type PaidValidateBody = {
  valid: boolean;
  message?: string;
  expiresAt?: string | null;
  offlineGraceDays?: number;
  status?: string;
};

export type PaidValidateTransientReason =
  | "network"
  | "rate_limited"
  | "server_error"
  | "http_error"
  | "invalid_response";

export type PaidValidateOutcome =
  | { kind: "valid"; body: PaidValidateBody }
  | { kind: "rejected"; body: PaidValidateBody }
  | { kind: "transient"; reason: PaidValidateTransientReason };

/**
 * Yalnızca HTTP 200 + açık `valid: false` gerçek lisans reddidir (LOCKED).
 * 429, 5xx, diğer HTTP durumları ve JSON olmayan / `valid` alanı eksik yanıtlar
 * geçici kabul edilir; çevrimdışı süre kuralı uygulanır.
 */
export function classifyPaidValidateResponse(httpStatus: number, body: unknown): PaidValidateOutcome {
  if (httpStatus === 429) return { kind: "transient", reason: "rate_limited" };
  if (httpStatus >= 500) return { kind: "transient", reason: "server_error" };
  if (httpStatus !== 200) return { kind: "transient", reason: "http_error" };
  if (!body || typeof body !== "object" || typeof (body as { valid?: unknown }).valid !== "boolean") {
    return { kind: "transient", reason: "invalid_response" };
  }
  const parsed = body as PaidValidateBody;
  return parsed.valid ? { kind: "valid", body: parsed } : { kind: "rejected", body: parsed };
}
