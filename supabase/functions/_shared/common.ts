import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Service-role client. Bypasses RLS: only ever used inside Edge Functions. */
export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export const SILKPAY_BASE = "https://api.silkpay.live";

/** Empty/missing token means DEMO MODE. */
export function getApiToken(): string | null {
  const t = Deno.env.get("SILKPAY_API_TOKEN")?.trim();
  return t ? t : null;
}

/** In demo mode webhooks are signed with this well-known key (never used with a real token). */
export const DEMO_SIGN_KEY = "demo-secret-key";
export function getSignKey(): string {
  return getApiToken() ?? DEMO_SIGN_KEY;
}

export function functionsUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1`;
}

export function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");
}

export const ERROR_MESSAGES: Record<number, string> = {
  1001: "Payment gateway rejected our credentials (bad API token). Check SILKPAY_API_TOKEN.",
  1004: "The merchant account has insufficient balance. Top up the account and retry.",
  1005: "This order number was already used. Please try again.",
  1006: "The amount is below the minimum the gateway allows.",
  1007: "The amount is above the maximum the gateway allows.",
  2001: "The upstream bank failed to process the request. Please try again in a moment.",
};

export function friendlyError(code: number, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? `Gateway returned error code ${code}.`;
}

/** Apply a state change idempotently. Never leaves Success, never creates a second "paid" write. */
export async function applyState(
  db: ReturnType<typeof adminClient>,
  merchantOrderNo: string,
  state: number,
  utr: string | null,
): Promise<"updated" | "already_success" | "no_change" | "not_found"> {
  const { data: order } = await db
    .from("orders").select("payin_state").eq("merchant_order_no", merchantOrderNo).maybeSingle();
  if (!order) return "not_found";
  if (order.payin_state === 2) return "already_success";
  if (order.payin_state === state && !utr) return "no_change";
  const patch: Record<string, unknown> = { payin_state: state };
  if (utr) patch.utr = utr;
  if (state === 2) patch.paid_at = new Date().toISOString();
  // The `.neq("payin_state", 2)` guard makes concurrent duplicate deliveries safe.
  const { data } = await db.from("orders").update(patch)
    .eq("merchant_order_no", merchantOrderNo).neq("payin_state", 2).select("id");
  return data && data.length > 0 ? "updated" : "already_success";
}
