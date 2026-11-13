import { useState, type FormEvent, type ReactNode } from "react";
import { callFn } from "../lib/api";
import { fmtTime, inr, type ApiLog, type Order, type WebhookLog } from "../lib/types";
import { Empty, ErrorBox, Spinner, StatusBadge } from "../components/ui";

interface Data { orders: Order[]; webhookLogs: WebhookLog[]; apiLogs: ApiLog[] }
const KEY = "paydemo.adminKey";
const readKey = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };

export default function Admin() {
  const [key, setKey] = useState(readKey);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"orders" | "webhooks" | "api">("orders");

  const load = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true); setError(null);
    const res = await callFn<Data & { error?: string }>("get-logs", {}, { "x-admin-key": key });
    if (res.ok) { setData(res.data); try { sessionStorage.setItem(KEY, key); } catch { /* ignore */ } }
    else { setData(null); setError(res.data.error ?? "Could not load data."); }
    setLoading(false);
  };

  const tabs = [["orders", "Orders"], ["webhooks", "Webhook logs"], ["api", "API logs"]] as const;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">Admin / Logs</h1>
      <form onSubmit={load} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="ak">Admin key (the ADMIN_KEY secret)</label>
          <input id="ak" type="password" className="input" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <button className="btn" disabled={loading || !key}>{data ? "Reload" : "Load data"}</button>
      </form>

      {loading && <Spinner />}
      {error && <ErrorBox>{error}</ErrorBox>}
      {data && (
        <>
          <div className="flex gap-1 border-b border-slate-200">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "orders" && (data.orders.length === 0 ? <Empty title="No orders yet" /> : (
            <Table head={["Created", "Order", "Product", "Amount", "Customer", "State", "UTR"]}>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-top">
                  <td className="p-2 whitespace-nowrap">{fmtTime(o.created_at)}</td>
                  <td className="p-2"><a href={`/how-it-works/${o.merchant_order_no}`} className="break-all text-xs">{o.merchant_order_no}</a></td>
                  <td className="p-2">{o.product_name}</td>
                  <td className="p-2">{inr(o.amount)}</td>
                  <td className="p-2 text-xs">{o.customer_name}<br />{o.customer_phone}<br />{o.customer_email}</td>
                  <td className="p-2"><StatusBadge state={o.payin_state} /></td>
                  <td className="p-2 break-all text-xs">{o.utr ?? "-"}</td>
                </tr>
              ))}
            </Table>
          ))}

          {tab === "webhooks" && (data.webhookLogs.length === 0 ? <Empty title="No webhooks received yet" /> : (
            <Table head={["Time", "Order", "Signature", "Handler note", "Raw payload"]}>
              {data.webhookLogs.map((w) => (
                <tr key={w.id} className="border-t border-slate-100 align-top">
                  <td className="p-2 whitespace-nowrap">{fmtTime(w.created_at)}</td>
                  <td className="p-2 break-all text-xs">{w.merchant_order_no ?? "-"}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.signature_valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{w.signature_valid ? "valid" : "invalid"}</span>
                  </td>
                  <td className="p-2 text-xs">{w.note ?? "-"}</td>
                  <td className="p-2"><Raw value={w.raw_payload} /></td>
                </tr>
              ))}
            </Table>
          ))}

          {tab === "api" && (data.apiLogs.length === 0 ? <Empty title="No API calls logged yet" /> : (
            <Table head={["Time", "Order", "Endpoint", "Request", "Response"]}>
              {data.apiLogs.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 align-top">
                  <td className="p-2 whitespace-nowrap">{fmtTime(a.created_at)}</td>
                  <td className="p-2 break-all text-xs">{a.merchant_order_no ?? "-"}</td>
                  <td className="p-2 text-xs">{a.endpoint}</td>
                  <td className="p-2"><Raw value={a.request_body} /></td>
                  <td className="p-2"><Raw value={a.response_body} /></td>
                </tr>
              ))}
            </Table>
          ))}
        </>
      )}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white text-sm">
      <table className="w-full min-w-[720px] text-left">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{head.map((h) => <th key={h} className="p-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Raw({ value }: { value: unknown }) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-indigo-600">view JSON</summary>
      <pre className="mt-1 max-h-64 max-w-md overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
