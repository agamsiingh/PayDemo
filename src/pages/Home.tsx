import { Link } from "react-router-dom";
import { PRODUCTS } from "../lib/products";
import { inr } from "../lib/types";

export default function Home() {
  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Learn the SilkPay payment flow</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick a fake product, pay through SilkPay (INR / UPI), then open the{" "}
          <Link to="/how-it-works" className="font-semibold">Integration Inspector</Link> to see every request, webhook and
          signature check behind your order.
        </p>
      </section>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => (
          <div key={p.id} className="card flex flex-col">
            <div className="text-4xl">{p.emoji}</div>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">{p.name}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{p.blurb}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xl font-bold">{inr(p.price)}</span>
              <Link to={`/checkout/${p.id}`} className="btn text-white hover:text-white">Buy now</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
