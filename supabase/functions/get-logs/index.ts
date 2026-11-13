import { adminClient, corsHeaders, json } from "../_shared/common.ts";

// Serves the Inspector (one order, identified by its unguessable number) and the Admin page
// (everything, protected by the ADMIN_KEY secret). The log tables have no public RLS policies.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const db = adminClient();

  const merchantOrderNo = body.merchantOrderNo ? String(body.merchantOrderNo) : null;
  if (merchantOrderNo) {
    const [order, api, hooks] = await Promise.all([
      db.from("orders").select("*").eq("merchant_order_no", merchantOrderNo).maybeSingle(),
      db.from("api_logs").select("*").eq("merchant_order_no", merchantOrderNo).order("created_at"),
      db.from("webhook_logs").select("*").eq("merchant_order_no", merchantOrderNo).order("created_at"),
    ]);
    if (!order.data) return json({ error: "Order not found" }, 404);
    return json({ order: order.data, apiLogs: api.data ?? [], webhookLogs: hooks.data ?? [] });
  }

  // Admin listing
  const adminKey = Deno.env.get("ADMIN_KEY");
  const given = req.headers.get("x-admin-key");
  if (!adminKey) return json({ error: "Admin access is disabled: set the ADMIN_KEY secret." }, 403);
  if (given !== adminKey) return json({ error: "Wrong admin key." }, 401);

  const [orders, hooks, api] = await Promise.all([
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("api_logs").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return json({ orders: orders.data ?? [], webhookLogs: hooks.data ?? [], apiLogs: api.data ?? [] });
});
