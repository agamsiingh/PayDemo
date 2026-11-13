import { adminClient, applyState, getSignKey } from "../_shared/common.ts";
import { verifySign } from "../_shared/sign.ts";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

/** The payload field names are not fully documented, so look for several likely spellings. */
function pick(p: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) if (p[n] !== undefined && p[n] !== null && p[n] !== "") return p[n];
  return undefined;
}

function resolveState(p: Record<string, unknown>): number | null {
  const n = Number(pick(p, "payinState", "payin_state", "orderState", "status", "state"));
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n;
  const paid = pick(p, "isPaid", "is_paid");
  if (paid === true || paid === "true") return 2;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return text("Method not allowed", 405);
  const db = adminClient();

  // 1) Read the RAW body and log it FIRST, so even garbage is kept for debugging.
  const rawText = await req.text();
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch { /* handled below */ }

  const merchantOrderNo = payload
    ? String(pick(payload, "merchantOrderNo", "merchant_order_no", "orderNo") ?? "") || null
    : null;
  const logBase = {
    merchant_order_no: merchantOrderNo,
    raw_payload: payload ?? { _unparseable: rawText.slice(0, 5000) },
  };

  if (!payload) {
    await db.from("webhook_logs").insert({ ...logBase, signature_valid: false, note: "Body was not a JSON object" });
    return text("Bad request", 400);
  }

  // 2) Verify the signature (token comes from secrets; demo key when no token)
  const v = verifySign(payload, getSignKey());
  const log = (note: string) =>
    db.from("webhook_logs").insert({
      ...logBase, string_to_sign: v.stringToSign, computed_sign: v.computedSign,
      received_sign: v.receivedSign, signature_valid: v.valid, note,
    });

  if (!v.valid) {
    await log("REJECTED: signature mismatch");
    return text("Invalid signature", 400);
  }

  // 3) Find the order
  if (!merchantOrderNo) { await log("REJECTED: no merchant order number in payload"); return text("Bad request", 400); }
  const { data: order } = await db.from("orders").select("*").eq("merchant_order_no", merchantOrderNo).maybeSingle();
  if (!order) { await log("REJECTED: unknown order"); return text("Order not found", 404); }

  const state = resolveState(payload);
  if (state === null) { await log("IGNORED: could not determine payment state from payload"); return text("SUCCESS", 200); }

  // 4) For a success, the amount must be present and equal to what we charged
  if (state === 2) {
    const paid = Number(pick(payload, "amount", "payinAmount", "orderAmount"));
    if (!Number.isFinite(paid) || Math.abs(paid - Number(order.amount)) > 0.001) {
      await log(`REJECTED: amount mismatch (payload=${paid}, order=${order.amount})`);
      return text("Amount mismatch", 400);
    }
  }

  // 5) Idempotent update (duplicates / retries are fine)
  const utrRaw = pick(payload, "utr", "UTR", "bankRefNo");
  const utr = utrRaw === undefined ? null : String(utrRaw);
  const result = await applyState(db, merchantOrderNo, state, utr);
  await log(result === "already_success"
    ? "Duplicate delivery ignored (order already Success)"
    : `Order state -> ${state} (${result})`);

  // 6) Plain-text SUCCESS tells SilkPay to stop retrying.
  return text("SUCCESS", 200);
});
