import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getDemoMode } from "../lib/api";
import { isConfigured } from "../lib/supabase";
import { ErrorBox } from "./ui";

const links = [
  { to: "/", label: "Shop", end: true },
  { to: "/how-it-works", label: "How it works" },
  { to: "/guide", label: "Integration Guide" },
  { to: "/admin", label: "Admin / Logs" },
];

export default function Layout() {
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => { if (isConfigured) void getDemoMode().then(setDemo); }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
        Demo only. Use sandbox credentials. No real products.
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-slate-900 hover:text-slate-900">💳 PayDemo</NavLink>
          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => `rounded-md px-3 py-1.5 font-medium ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                {l.label}
              </NavLink>
            ))}
            {demo !== null && (
              <span title={demo ? "SILKPAY_API_TOKEN is not set: a fake cashier is used." : "SILKPAY_API_TOKEN is set: real SilkPay API calls."}
                className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${demo ? "bg-violet-100 text-violet-800" : "bg-sky-100 text-sky-800"}`}>
                {demo ? "Demo mode (fake cashier)" : "Sandbox API"}
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {isConfigured ? <Outlet /> : (
          <ErrorBox title="Supabase is not configured">
            Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>. The Integration Guide works without it.
            <div className="mt-3"><NavLink to="/guide" className="font-semibold underline">Open the Integration Guide</NavLink></div>
          </ErrorBox>
        )}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        PayDemo: a learning project for the SilkPay API v2.4. Nothing here sells anything.
      </footer>
    </div>
  );
}
