import { CodeBlock } from "../components/ui";

// Snippets avoid template literals on purpose, so they stay copy-paste friendly inside this file.
const createOrder = `// Node 18+  (create-order.js)   Run on your SERVER, never in the browser.
import crypto from "node:crypto";

const TOKEN = process.env.SILKPAY_API_TOKEN;           // keep in env / secrets manager
const BASE = "https://api.silkpay.live";

export async function createPayin({ amountRupees, name, phone, email }) {
  const merchantOrderNo = "ORD" + Date.now() + crypto.randomBytes(6).toString("hex"); // unique, <= 64 chars

  // 1. Save the order as PENDING in your database first (omitted here).

  const res = await fetch(BASE + "/merchant/api/payin/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,                 // no request signing needed
    },
    body: JSON.stringify({
      merchantOrderNo,
      amount: amountRupees.toFixed(2),                   // string such as "500.00"
      currency: "INR",
      payinName: name,
      payinPhone: phone,
      payinEmail: email,
      notifyUrl: "https://your-api.example.com/silkpay-webhook",
      returnUrl: "https://your-site.example.com/status/" + merchantOrderNo,
    }),
  });

  const body = await res.json();
  if (body.code !== 0) {
    // 1001 bad token, 1004 insufficient balance, 1005 duplicate order no,
    // 1006 amount too low, 1007 amount too high, 2001 upstream bank failure
    throw new Error("SilkPay error " + body.code + ": " + body.msg);
  }
  // 2. Store body.data.gatewayOrderNo, then send the customer to:
  return { merchantOrderNo, cashierUrl: body.data.cashierUrl };
}`;

const verifier = `// Node 18+ + Express  (webhook.js)
import express from "express";
import crypto from "node:crypto";

const TOKEN = process.env.SILKPAY_API_TOKEN;
const app = express();
app.use(express.json());

function verifySign(payload) {
  const { sign, ...rest } = payload;
  const str = Object.keys(rest)
    .filter((k) => rest[k] !== null && rest[k] !== undefined && rest[k] !== "") // drop empty values
    .sort()                                                                       // ASCII A-Z
    .map((k) => k + "=" + rest[k])
    .join("&");
  const computed = crypto.createHash("md5").update(str + "&key=" + TOKEN).digest("hex");
  return typeof sign === "string" && sign.toLowerCase() === computed.toLowerCase();
}

app.post("/silkpay-webhook", async (req, res) => {
  const payload = req.body;
  // Log the raw payload first (omitted), then verify.
  if (!verifySign(payload)) return res.status(400).send("Invalid signature");

  const order = await db.findOrder(payload.merchantOrderNo);          // your DB
  if (!order) return res.status(404).send("Unknown order");
  if (Number(payload.amount) !== Number(order.amount)) return res.status(400).send("Amount mismatch");

  // Idempotent: delivery is at-least-once (up to 5 retries).
  if (order.state !== "SUCCESS") {
    await db.markPaid(order.id, { utr: payload.utr });                  // UPDATE ... WHERE state <> 'SUCCESS'
  }
  res.status(200).type("text/plain").send("SUCCESS");                   // body must be exactly SUCCESS
});

app.listen(3000);`;

const query = `// Reconcile when the webhook is late or lost (server-side)
const res = await fetch("https://api.silkpay.live/merchant/api/payin/query", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + TOKEN },
  body: JSON.stringify({ orderNo: gatewayOrderNo }),
});
const { code, data } = await res.json();   // data.payinState: 1 Pending, 2 Success, 3 Failed, 4 Expired`;

const steps: { title: string; body: string; code?: { title: string; code: string } }[] = [
  { title: "Get sandbox credentials", body: "Create a SilkPay merchant account and ask for sandbox access. You receive an API token. Treat it like a password: server environment variables or Supabase secrets only, never frontend code, never git." },
  { title: "Create the order in your database", body: "Generate a unique merchantOrderNo (max 64 chars) and store the order as Pending with the amount you decide on the server. Never take the price from the browser." },
  { title: "Call POST /merchant/api/payin/create", body: "Send amount as a string like \"500.00\", currency INR, the payer's name, phone and email, plus your notifyUrl (webhook) and returnUrl. Authenticate with the header Authorization: Bearer <token>.", code: { title: "Node.js: create order", code: createOrder } },
  { title: "Handle the response and errors", body: "code 0 means success. 1001 bad token, 1004 insufficient balance, 1005 duplicate merchantOrderNo, 1006 amount below minimum, 1007 amount above maximum, 2001 upstream bank failure. Show a friendly message and log the call (without the token)." },
  { title: "Redirect the customer to cashierUrl", body: "Store gatewayOrderNo and cashierUrl, then send the browser to cashierUrl. The customer pays by UPI on SilkPay's page. Orders expire after 15 minutes (state 4)." },
  { title: "Treat the returnUrl as a courtesy, not proof", body: "After paying, the customer lands on your returnUrl. Anyone can open that URL, so it must only display the order's current status from your database and never mark it paid." },
  { title: "Receive and verify the webhook", body: "SilkPay POSTs JSON to notifyUrl. Drop sign and empty values, sort keys ASCII A-Z, build k1=v1&k2=v2, append &key=<token>, MD5 to lowercase hex, compare case-insensitively with sign. Reject on mismatch, and check the amount matches your order.", code: { title: "Node.js: webhook verifier", code: verifier } },
  { title: "Update idempotently and reply SUCCESS", body: "Delivery is at-least-once with up to 5 retries, so the same webhook can arrive several times. Update only if the order is not already Success, then answer HTTP 200 with the body exactly SUCCESS so SilkPay stops retrying. Make the webhook endpoint publicly reachable (no login or JWT)." },
  { title: "Reconcile with the query API, then go live", body: "If a webhook is late or lost, call the query endpoint (POST /merchant/api/payin/query or GET /merchant/api/payin/status/{orderNo}) and sync the state. Before launch: swap to production credentials, check balance alerts, monitor webhook logs, and test failure and expiry paths.", code: { title: "Node.js: query status", code: query } },
];

export default function Guide() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integration Guide</h1>
        <p className="mt-1 text-slate-600">The nine steps to take a SilkPay (INR / UPI) payment, with code you can copy.</p>
      </div>
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="card">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
                <p className="text-sm text-slate-600">{s.body}</p>
                {s.code && <CodeBlock title={s.code.title} language="javascript" code={s.code.code} />}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
