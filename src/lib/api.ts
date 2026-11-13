import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

export interface FnResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

/** Call a Supabase Edge Function. Only the public anon key is sent. */
export async function callFn<T = Record<string, any>>(
  name: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<FnResult<T>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Network error: could not reach the server. Check your connection and that the Edge Functions are deployed." } as T,
    };
  }
}

let demoModeCache: Promise<boolean | null> | null = null;
/** true = demo (no token configured), false = real gateway, null = unknown/unreachable. */
export function getDemoMode(): Promise<boolean | null> {
  demoModeCache ??= callFn<{ demoMode?: boolean }>("create-payin", { ping: true }).then((r) =>
    r.ok && typeof r.data.demoMode === "boolean" ? r.data.demoMode : null,
  );
  return demoModeCache;
}
