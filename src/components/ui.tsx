import { useState, type ReactNode } from "react";
import { STATE_INFO } from "../lib/types";

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function ErrorBox({ title = "Something went wrong", children, onRetry }: { title?: string; children?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1">{children}</div>}
      {onRetry && <button className="btn-secondary mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function StatusBadge({ state, large }: { state: number; large?: boolean }) {
  const s = STATE_INFO[state] ?? { label: `Unknown (${state})`, classes: "bg-slate-100 text-slate-700 ring-slate-300" };
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${s.classes} ${large ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}>
      {s.label}
    </span>
  );
}

export function CodeBlock({ code, language, title }: { code: string; language?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: user can still select the text */
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
        <span>{title ?? language ?? "code"}</span>
        <button onClick={copy} className="rounded px-2 py-0.5 font-medium hover:bg-slate-700">{copied ? "Copied!" : "Copy"}</button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-slate-100"><code>{code}</code></pre>
    </div>
  );
}

export function Json({ value }: { value: unknown }) {
  return <CodeBlock code={JSON.stringify(value, null, 2)} language="json" />;
}
