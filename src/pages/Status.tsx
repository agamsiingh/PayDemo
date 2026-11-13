import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { callFn } from "../lib/api";
import { useOrder } from "../lib/useOrder";
import { fmtTime, inr, STATE_INFO } from "../lib/types";
import { Empty, ErrorBox, Spinner, StatusBadge } from "../components/ui";

export default function Status() {
  const { merchantOrderNo } = useParams();
  const { order, loading, error, live, reload } = useOrder(merchantOrderNo);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <Spinner label="Loading your order..." />;
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>;
  if (!order) return <Empty title="Order not found"><Link to="/">Back to the shop</Link></Empty>;

  const refresh = async () => {
    setChecking(true); setMsg(null);
    const res = await callFn<{ error?: string }>("query-payin", { merchantOrderNo: order.merchant_order_no });
    if (!res.ok) setMsg(res.data.error ?? "Could not check the status.");
    await reload();
    setChecking(false);
  };

  const info = STATE_INFO[order.payin_state];
  const rows: [string, string][] = [
    ["Order number", order.merchant_order_no],
    ["Gateway order", order.gateway_order_no ?? "-"],
    ["Product", order.product_name],
    ["Amount", inr(order.amount)],
    ["Customer", order.customer_name],
    ["Created", fmtTime(order.created_at)],
    ["UTR (bank reference)", order.utr ?? "-"],
    ["Paid at", fmtTime(order.paid_at)],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="card text-center">
        <p className="text-sm text-slate-500">Payment status</p>
        <div className="mt-2"><StatusBadge state={order.payin_state} large /></div>
        <p className="mt-3 text-sm text-slate-600">{info?.help}</p>
        <p className="mt-2 text-xs text-slate-400">
          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-300"}`} />
          {live ? "Live updates on (Supabase Realtime)" : "Connecting to live updates... (checking every few seconds meanwhile)"}
        </p>
      </div>

      <div className="card">
        <dl className="divide-y divide-slate-100 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">{k}</dt><dd className="break-all font-medium sm:text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <strong>Why you can't trust this page alone:</strong> anyone can type this URL, so arriving here proves nothing. An order
        is only marked paid by SilkPay's signed webhook or by our server-side query to the SilkPay API.
      </div>

      {msg && <ErrorBox title="Status check failed">{msg}</ErrorBox>}
      <div className="flex flex-wrap gap-3">
        <button className="btn" onClick={refresh} disabled={checking}>{checking ? "Checking..." : "Refresh status"}</button>
        <Link to={`/how-it-works/${order.merchant_order_no}`} className="btn-secondary">See how it works for this order</Link>
        <Link to="/" className="btn-secondary">Back to shop</Link>
      </div>
    </div>
  );
}
