import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { callFn } from "../lib/api";
import { useOrder } from "../lib/useOrder";
import { inr } from "../lib/types";
import { Empty, ErrorBox, Spinner } from "../components/ui";

/** Stand-in for the SilkPay hosted cashier. Only used in DEMO MODE. */
export default function FakeCashier() {
  const { merchantOrderNo } = useParams();
  const { order, loading, error } = useOrder(merchantOrderNo);
  const nav = useNavigate();
  const [busy, setBusy] = useState<"success" | "fail" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!order) return <Empty title="Order not found"><Link to="/">Back to the shop</Link></Empty>;

  const simulate = async (outcome: "success" | "fail") => {
    setBusy(outcome); setErr(null);
    const res = await callFn<{ error?: string; webhookStatus?: number }>("demo-simulate", { merchantOrderNo: order.merchant_order_no, outcome });
    if (!res.ok || res.data.webhookStatus !== 200) {
      setErr(res.data.error ?? `The webhook did not accept the fake callback (HTTP ${res.data.webhookStatus}).`);
      setBusy(null);
      return;
    }
    nav(`/status/${order.merchant_order_no}`); // like the real cashier's returnUrl redirect
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-4 border-violet-300 text-center">
        <span className="mx-auto inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">FAKE CASHIER (demo mode)</span>
        <h1 className="text-xl font-bold">Pay {inr(order.amount)}</h1>
        <p className="text-sm text-slate-600">{order.product_name}, order <code className="break-all text-xs">{order.merchant_order_no}</code></p>
        <p className="text-xs text-slate-500">
          This page replaces SilkPay's real UPI cashier. The buttons make a correctly signed fake webhook hit your real
          <code> silkpay-webhook</code> function, exactly like SilkPay would.
        </p>
        {err && <ErrorBox>{err}</ErrorBox>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="btn flex-1 !bg-emerald-600 hover:!bg-emerald-700" disabled={!!busy} onClick={() => simulate("success")}>
            {busy === "success" ? "Sending webhook..." : "Simulate success"}
          </button>
          <button className="btn flex-1 !bg-red-600 hover:!bg-red-700" disabled={!!busy} onClick={() => simulate("fail")}>
            {busy === "fail" ? "Sending webhook..." : "Simulate failure"}
          </button>
        </div>
      </div>
    </div>
  );
}
