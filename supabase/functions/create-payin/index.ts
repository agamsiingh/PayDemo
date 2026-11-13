import { adminClient, corsHeaders, friendlyError, functionsUrl, getApiToken, json, SILKPAY_BASE, siteUrl } from "../_shared/common.ts";
import { PRODUCTS } from "../_shared/products.ts";

function newOrderNo(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `PD${Date.now().toString(36).toUpperCase()}${rand}`; // < 64 chars, unguessable
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const token = getApiToken();
  const demoMode = token === null;

  // Lets the UI show a "Demo mode" badge without ever seeing the token.
  if (body.ping) return json({ demoMode });

  // ---- validate input
  const product = PRODUCTS[String(body.productId ?? "")];
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").replace(/[\s-]/g, "").replace(/^(\+91|91)(?=\d{10}$)/, "");
  const email = String(body.email ?? "").trim();
  const errors: Record<string, string> = {};
  if (!product) errors.productId = "Unknown product.";
  if (name.length < 2 || name.length > 80) errors.name = "Enter your name (2-80 characters).";
  if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) errors.email = "Enter a valid email address.";
  if (Object.keys(errors).length) return json({ error: "Please fix the highlighted fields.", fields: errors }, 400);

  const db = adminClient();
  const merchantOrderNo = newOrderNo();
  const amount = product.price.toFixed(2);

  // ---- 1) insert the order as Pending BEFORE calling the gateway
  const { error: insErr } = await db.from("orders").insert({
    merchant_order_no: merchantOrderNo, amount: product.price, customer_name: name,
    customer_phone: phone, customer_email: email, product_name: product.name, payin_state: 1,
  });
  if (insErr) return json({ error: "Could not create the order. Please try again." }, 500);

  // ---- 2) call SilkPay (or mock it)
  const requestBody = {
    merchantOrderNo, amount, currency: "INR", payinName: name, payinPhone: phone, payinEmail: email,
    notifyUrl: `${functionsUrl()}/silkpay-webhook`,
    returnUrl: `${siteUrl()}/status/${merchantOrderNo}`,
  };

  // deno-lint-ignore no-explicit-any
  let responseBody: Record<string, any>;
  if (demoMode) {
    responseBody = {
      code: 0, msg: "success (DEMO MODE - mocked, no request was sent to SilkPay)",
      data: {
        merchantOrderNo, gatewayOrderNo: `DEMO${Date.now()}`,
        cashierUrl: `${siteUrl()}/fake-cashier/${merchantOrderNo}`,
        amount, payinState: 1, createdAt: new Date().toISOString(),
      },
    };
  } else {
    try {
      const res = await fetch(`${SILKPAY_BASE}/merchant/api/payin/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      responseBody = await res.json();
    } catch (_e) {
      responseBody = { code: -1, msg: "Network error talking to SilkPay" };
    }
  }

  // ---- 3) log it (request body only; the Authorization header is never stored)
  await db.from("api_logs").insert({
    merchant_order_no: merchantOrderNo, endpoint: "/merchant/api/payin/create",
    request_body: requestBody, response_body: responseBody,
  });

  if (responseBody.code !== 0 || !responseBody.data?.cashierUrl) {
    await db.from("orders").update({ payin_state: 3 }).eq("merchant_order_no", merchantOrderNo);
    const code = Number(responseBody.code ?? -1);
    return json({ error: friendlyError(code, "Could not start the payment. Please try again."), code, merchantOrderNo }, 502);
  }

  // ---- 4) store gateway ids, return the cashier URL
  await db.from("orders").update({
    gateway_order_no: responseBody.data.gatewayOrderNo ?? null,
    cashier_url: responseBody.data.cashierUrl,
  }).eq("merchant_order_no", merchantOrderNo);

  return json({ cashierUrl: responseBody.data.cashierUrl, merchantOrderNo, demoMode });
});
