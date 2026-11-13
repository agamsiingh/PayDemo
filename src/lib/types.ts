export interface Order {
  id: string;
  merchant_order_no: string;
  gateway_order_no: string | null;
  amount: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  product_name: string;
  cashier_url: string | null;
  payin_state: number;
  utr: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface ApiLog {
  id: string;
  merchant_order_no: string | null;
  endpoint: string;
  request_body: unknown;
  response_body: unknown;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  merchant_order_no: string | null;
  raw_payload: Record<string, unknown> | null;
  string_to_sign: string | null;
  computed_sign: string | null;
  received_sign: string | null;
  signature_valid: boolean | null;
  note: string | null;
  created_at: string;
}

export const STATE_INFO: Record<number, { label: string; classes: string; help: string }> = {
  1: { label: "Pending", classes: "bg-amber-100 text-amber-800 ring-amber-300", help: "Waiting for the customer to pay (orders expire after 15 minutes)." },
  2: { label: "Success", classes: "bg-emerald-100 text-emerald-800 ring-emerald-300", help: "Payment confirmed by SilkPay (webhook or query API)." },
  3: { label: "Failed", classes: "bg-red-100 text-red-800 ring-red-300", help: "The payment failed. No money was taken." },
  4: { label: "Expired", classes: "bg-slate-200 text-slate-700 ring-slate-300", help: "The 15-minute payment window ended." },
};

export const inr = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n));

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" }) : "-";
