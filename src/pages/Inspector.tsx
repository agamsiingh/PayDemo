import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { callFn } from "../lib/api";
import { getRecent } from "../lib/recent";
import { fmtTime, inr, STATE_INFO, type ApiLog, type Order, type WebhookLog } from "../lib/types";
import { useOrderEvents } from "../lib/useOrder";
import { CodeBlock, Empty, ErrorBox, Json, Spinner, StatusBadge } from "../components/ui";

interface Logs { order: Order; apiLogs: ApiLog[]; webhookLogs: WebhookLog[] }

function Step({ n, title, explain, status, children }: { n: string; title: string; explain: string; status: "done" | "waiting"; children?: ReactNode }) {
  return (
    <li className="relative pl-12">
      <span className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${status === "done" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>{n}</span>
      <div className="card">
        <h3 className="font-semibold text-slate-900">{title}{status === "waiting" && <span className="ml-2 text-xs font-normal text-slate-400">(not yet)</span>}</h3>
        <p className="mt-1 rounded-md bg-indigo-50 p-2.5 text-sm text-indigo-900">{explain}</p>
        {children && <div className="mt-3 space-y-3 text-sm">{children}</div>}
      </div>
    </li>
  );
}

function Picker({ current }: { current?: string }) {
  const nav = useNavigate();
  const recent = getRecent();
  const [manual, setManual] = useState("");
  return (
    <div className="card space-y-3">
      <p className="text-sm font-medium">Choose an order to inspect</p>
      {recent.length > 0 && (
        <select className="input" value={current ?? ""} onChange={(e) => e.target.value && nav(`/how-it-works/${e.target.value}`)}>
          <option value="">Your recent orders...</option>
          {recent.map((r) => <option key={r.no} value={r.no}>{r.product} - {fmtTime(r.at)}</option>)}
        </select>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) nav(`/how-it-works/${manual.trim()}`); }}>
        <input className="input" placeholder="...or paste a merchant order number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="btn-secondary">Open</button>
      </form>
    </div>
  );
}

export default function Inspector() {
  const { merchantOrderNo } = useParams();
  const [logs, setLogs] = useState<Logs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!merchantOrderNo) return;
    const res = await callFn<Logs & { error?: string }>("get-logs", { merchantOrderNo });
    if (res.ok) { setLogs(res.data); setError(null); } else setError(res.data.error ?? "Could not load the logs.");
    setLoading(false);
  }, [merchantOrderNo]);

  useEffect(() => { setLogs(null); setError(null); setLoading(Boolean(merchantOrderNo)); void load(); }, [merchantOrderNo, load]);
  useOrderEvents(merchantOrderNo, load);
  useEffect(() => { // safety net while nothing final has happened yet
    if (!merchantOrderNo || (logs && logs.order.payin_state !== 1)) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [merchantOrderNo, logs, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">How it works: the Integration Inspector</h1>
        <p className="mt-1 text-slate-600">Every step of one payment, with the real data that was exchanged. The API token is always shown masked.</p>
      </div>
      <Picker current={merchantOrderNo} />
      {!merchantOrderNo && <Empty title="No order selected">Buy something from the <Link to="/">shop</Link> first, then come back here.</Empty>}
      {loading && <Spinner label="Loading the timeline..." />}
      {error && <ErrorBox onRetry={load}>{error}</ErrorBox>}
      {logs && <Timeline logs={logs} />}
    </div>
  );
}

function Timeline({ logs }: { logs: Logs }) {
  const { order, apiLogs, webhookLogs } = logs;
  const create = apiLogs.find((l) => l.endpoint.includes("payin/create"));
  const queries = apiLogs.filter((l) => l.endpoint.includes("payin/query"));
  const demo = typeof (create?.response_body as { msg?: string } | undefined)?.msg === "string" && (create?.response_body as { msg: string }).msg.includes("DEMO MODE");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge state={order.payin_state} />
        <span className="font-medium">{order.product_name}, {inr(order.amount)}</span>
        <code className="break-all text-xs text-slate-500">{order.merchant_order_no}</code>
        {demo && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Demo mode: SilkPay was mocked</span>}
        <Link to={`/status/${order.merchant_order_no}`} className="ml-auto">Open status page</Link>
      </div>

      <ol className="space-y-5">
        <Step n="a" title="Request sent to create-payin (our server to SilkPay)" status={create ? "done" : "waiting"}
          explain="Your server asks SilkPay to create a payment. The secret API token travels in the Authorization header and is never visible to the browser. The amount is a string with two decimals, and merchantOrderNo must be unique.">
          {create && <CodeBlock title="POST https://api.silkpay.live/merchant/api/payin/create" language="http"
            code={`Authorization: Bearer ****\nContent-Type: application/json\n\n${JSON.stringify(create.request_body, null, 2)}`} />}
        </Step>

        <Step n="b" title="SilkPay response" status={create ? "done" : "waiting"}
          explain='code 0 means success. data.cashierUrl is the hosted payment page for the customer; payinState 1 means "pending". Any other code is an error (1001 bad token, 1004 low balance, 1005 duplicate order number, 1006/1007 amount limits, 2001 bank failure).'>
          {create && <Json value={create.response_body} />}
        </Step>

        <Step n="c" title="Redirect to the cashier" status={order.cashier_url ? "done" : "waiting"}
          explain="The browser is sent to cashierUrl, where the customer picks UPI and pays. When finished they come back to your returnUrl, but that redirect is NOT proof of payment.">
          {order.cashier_url && <CodeBlock title="window.location.href =" code={order.cashier_url} />}
        </Step>

        <Step n="d" title="Webhook payload received" status={webhookLogs.length ? "done" : "waiting"}
          explain="SilkPay calls your notifyUrl with the payment result. This is the trustworthy signal, but it can be sent more than once (up to 5 retries), so the handler must be idempotent. The raw body is stored before anything else happens.">
          {webhookLogs.map((w) => (
            <div key={w.id}><p className="mb-1 text-xs text-slate-500">Received {fmtTime(w.created_at)}</p><Json value={w.raw_payload} /></div>
          ))}
        </Step>

        <Step n="e" title="Signature check" status={webhookLogs.length ? "done" : "waiting"}
          explain="Anyone could POST fake JSON to your webhook URL. The sign proves it came from SilkPay: we drop sign and empty values, sort the keys A to Z, join them as k=v&k=v, append &key=<token>, take the MD5 and compare. Only SilkPay and you know the token.">
          {webhookLogs.map((w) => (
            <div key={w.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{fmtTime(w.created_at)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${w.signature_valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {w.signature_valid ? "✓ Signature valid" : "✗ Signature INVALID"}
                </span>
              </div>
              {w.string_to_sign != null && (
                <CodeBlock title="String to sign" code={`${w.string_to_sign}&key=****`} />
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">Computed MD5</p><code className="break-all text-xs">{w.computed_sign ?? "-"}</code></div>
                <div><p className="text-xs text-slate-500">Received sign</p><code className="break-all text-xs">{w.received_sign ?? "-"}</code></div>
              </div>
              {w.note && <p className="text-xs text-slate-600">Handler: <em>{w.note}</em></p>}
            </div>
          ))}
        </Step>

        <Step n="f" title="Final database status change" status={order.payin_state !== 1 ? "done" : "waiting"}
          explain="Only after the signature and amount are verified is the order updated. The update is conditional (never leave Success), so repeated webhooks cannot pay an order twice. If the webhook never arrives, the query API can sync the status.">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">payin_state</p><p>1 Pending to <strong>{order.payin_state} {STATE_INFO[order.payin_state]?.label}</strong></p></div>
            <div><p className="text-xs text-slate-500">UTR</p><p className="break-all">{order.utr ?? "-"}</p></div>
            <div><p className="text-xs text-slate-500">paid_at</p><p>{fmtTime(order.paid_at)}</p></div>
          </div>
          {queries.length > 0 && <p className="text-xs text-slate-500">Also synced via the query API {queries.length}x (see the Admin / Logs page).</p>}
        </Step>
      </ol>
    </div>
  );
}
