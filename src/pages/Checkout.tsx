import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { callFn } from "../lib/api";
import { findProduct } from "../lib/products";
import { addRecent } from "../lib/recent";
import { inr } from "../lib/types";
import { Empty, ErrorBox } from "../components/ui";

type Fields = { name: string; phone: string; email: string };

function validate(f: Fields): Partial<Fields> {
  const e: Partial<Fields> = {};
  if (f.name.trim().length < 2) e.name = "Enter your name (at least 2 characters).";
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/[\s-]/g, "").replace(/^(\+91|91)(?=\d{10}$)/, ""))) e.phone = "Enter a valid 10-digit Indian mobile number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
  return e;
}

export default function Checkout() {
  const { productId } = useParams();
  const product = findProduct(productId);
  const [form, setForm] = useState<Fields>({ name: "", phone: "", email: "" });
  const [errors, setErrors] = useState<Partial<Fields>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) return <Empty title="Product not found"><Link to="/">Back to the shop</Link></Empty>;

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    // Only the product id is sent. The server decides the price.
    const res = await callFn<{ cashierUrl?: string; merchantOrderNo?: string; error?: string; fields?: Partial<Fields> }>(
      "create-payin", { productId: product.id, ...form },
    );
    if (res.ok && res.data.cashierUrl && res.data.merchantOrderNo) {
      addRecent({ no: res.data.merchantOrderNo, product: product.name, at: new Date().toISOString() });
      window.location.href = res.data.cashierUrl; // hand the customer over to the SilkPay cashier
      return;
    }
    if (res.data.fields) setErrors(res.data.fields);
    if (res.data.merchantOrderNo) addRecent({ no: res.data.merchantOrderNo, product: product.name, at: new Date().toISOString() });
    setError(res.data.error ?? "Could not start the payment.");
    setBusy(false);
  };

  const field = (k: keyof Fields, label: string, type: string, auto: string, ph: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="input" type={type} autoComplete={auto} placeholder={ph} value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!errors[k]} />
      {errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>}
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-5">
      <form onSubmit={submit} className="card space-y-4 md:col-span-3" noValidate>
        <h1 className="text-xl font-bold">Checkout</h1>
        {field("name", "Full name", "text", "name", "Asha Verma")}
        {field("phone", "Mobile number", "tel", "tel", "9876543210")}
        {field("email", "Email", "email", "email", "asha@example.com")}
        {error && <ErrorBox title="Payment could not be started">{error}</ErrorBox>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Creating your order..." : "Pay with SilkPay"}
        </button>
        <p className="text-xs text-slate-500">You will be redirected to the SilkPay cashier to complete the payment.</p>
      </form>
      <aside className="card h-fit md:col-span-2">
        <h2 className="font-semibold">Order summary</h2>
        <div className="mt-3 flex justify-between text-sm"><span>{product.emoji} {product.name}</span><span>{inr(product.price)}</span></div>
        <div className="mt-3 flex justify-between border-t pt-3 font-bold"><span>Total</span><span>{inr(product.price)}</span></div>
        <p className="mt-3 text-xs text-slate-500">Price is looked up on the server from the product id; it cannot be edited in the browser.</p>
      </aside>
    </div>
  );
}
