import { adminClient, applyState, corsHeaders, friendlyError, getApiToken, json, SILKPAY_BASE } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const merchantOrderNo = String(body.merchantOrderNo ?? "");
  if (!merchantOrderNo) return json({ error: "merchantOrderNo is required" }, 400);

  const db = adminClient();
  const { data: order } = await db.from("orders").select("*").eq("merchant_order_no", merchantOrderNo).maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);

  const token = getApiToken();
  if (!token) {
    // Demo mode: there is no gateway to ask. The DB (fed by the fake webhook) is the truth.
    return json({ payinState: order.payin_state, utr: order.utr, demoMode: true });
  }

  const requestBody = { orderNo: order.gateway_order_no ?? merchantOrderNo };
  // deno-lint-ignore no-explicit-any
  let responseBody: Record<string, any>;
  try {
    const res = await fetch(`${SILKPAY_BASE}/merchant/api/payin/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(requestBody),
    });
    responseBody = await res.json();
  } catch (_e) {
    responseBody = { code: -1, msg: "Network error talking to SilkPay" };
  }

  await db.from("api_logs").insert({
    merchant_order_no: merchantOrderNo, endpoint: "/merchant/api/payin/query",
    request_body: requestBody, response_body: responseBody,
  });

  if (responseBody.code !== 0 || !responseBody.data) {
    const code = Number(responseBody.code ?? -1);
    return json({ error: friendlyError(code, "Could not check the status right now."), code }, 502);
  }

  const state = Number(responseBody.data.payinState);
  const utr = responseBody.data.utr ? String(responseBody.data.utr) : null;
  if (Number.isInteger(state) && state >= 1 && state <= 4) {
    await applyState(db, merchantOrderNo, state, utr);
  }
  const { data: fresh } = await db.from("orders").select("payin_state, utr").eq("merchant_order_no", merchantOrderNo).single();
  return json({ payinState: fresh?.payin_state, utr: fresh?.utr });
});
