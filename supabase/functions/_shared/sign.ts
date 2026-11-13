// SilkPay webhook signature helpers.
// Pure functions, no Deno-only APIs: runs in Supabase Edge Functions (Deno) AND in Vitest (Node).
import { createHash } from "node:crypto";

export type Payload = Record<string, unknown>;

/** Values that never take part in the signature: null, undefined and "". */
function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function stringify(v: unknown): string {
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/**
 * Steps 1-3 of the SilkPay algorithm: drop `sign`, drop empty values, sort keys A-Z,
 * join as "k1=v1&k2=v2". The secret is NOT included, so this string is safe to store and show.
 */
export function buildStringToSign(payload: Payload): string {
  return Object.keys(payload)
    .filter((k) => k !== "sign" && !isEmpty(payload[k]))
    .sort() // default sort = UTF-16 code unit order = ASCII order for ASCII keys
    .map((k) => `${k}=${stringify(payload[k])}`)
    .join("&");
}

/** Steps 4-5: append "&key=<token>" and take lowercase-hex MD5. */
export function computeSign(payload: Payload, apiToken: string): string {
  const s = `${buildStringToSign(payload)}&key=${apiToken}`;
  return createHash("md5").update(s, "utf8").digest("hex");
}

export interface VerifyResult {
  stringToSign: string; // without the key
  computedSign: string;
  receivedSign: string;
  valid: boolean;
}

/** Compare case-insensitively with the `sign` field the gateway sent. */
export function verifySign(payload: Payload, apiToken: string): VerifyResult {
  const received = payload.sign === undefined || payload.sign === null ? "" : String(payload.sign);
  const computed = computeSign(payload, apiToken);
  return {
    stringToSign: buildStringToSign(payload),
    computedSign: computed,
    receivedSign: received,
    valid: received.length > 0 && received.toLowerCase() === computed.toLowerCase(),
  };
}
