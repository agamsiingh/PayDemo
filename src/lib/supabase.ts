import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Only PUBLIC values live in the frontend. The SilkPay token exists solely in Supabase secrets.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** General client (used for Realtime subscriptions). */
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL ?? "http://localhost:54321",
  SUPABASE_ANON_KEY ?? "missing-anon-key",
  opts,
);

const cache = new Map<string, SupabaseClient>();

/**
 * A client that sends `x-order-no: <order number>` with every request.
 * The RLS policy on `orders` only returns the row whose number matches that header,
 * so a browser can read its own order and nobody else's.
 */
export function orderClient(merchantOrderNo: string): SupabaseClient {
  let c = cache.get(merchantOrderNo);
  if (!c) {
    c = createClient(SUPABASE_URL ?? "http://localhost:54321", SUPABASE_ANON_KEY ?? "missing-anon-key", {
      ...opts,
      global: { headers: { "x-order-no": merchantOrderNo } },
    });
    cache.set(merchantOrderNo, c);
  }
  return c;
}
