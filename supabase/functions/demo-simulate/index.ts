import { adminClient, corsHeaders, DEMO_SIGN_KEY, functionsUrl, getApiToken, json } from "../_shared/common.ts";
import { computeSign } from "../_shared/sign.ts";

// DEMO MODE ONLY. Plays the role of SilkPay: builds a payload, signs it exactly like the real
// gateway would, and POSTs it to our own silkpay-webhook so the whole flow can be shown for free.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (getApiToken()) return json({ error: "Simulator is disabled when a real SILKPAY_API_TOKEN is configured." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const merchantOrderNo = String(body.merchantOrderNo ?? "");
  const outcome = body.outcome === "fail" ? "fail" : "success";

  const db = adminClient();
  const { data: order } = await db.from("orders").select("*").eq("merchant_order_no", merchantOrderNo).maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);

  const ok = outcome === "success";
  const payload: Record<string, unknown> = {
    merchantOrderNo, gatewayOrderNo: order.gateway_order_no, amount: Number(order.amount).toFixed(2),
    currency: "INR", payinState: ok ? 2 : 3, isPaid: ok,
    utr: ok ? String(Math.floor(1e11 + Math.random() * 9e11)) : "",
    paidAt: ok ? new Date().toISOString() : "",
  };
  payload.sign = computeSign(payload, DEMO_SIGN_KEY);

  const res = await fetch(`${functionsUrl()}/silkpay-webhook`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return json({ webhookStatus: res.status, webhookBody: await res.text() });
});
