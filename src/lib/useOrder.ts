import { useCallback, useEffect, useRef, useState } from "react";
import { orderClient, supabase } from "./supabase";
import type { Order } from "./types";

/**
 * Subscribes to the per-order Realtime channel. A database trigger on `orders` broadcasts a
 * PII-free "status" message whenever payin_state / utr / paid_at change. Returns whether the
 * socket is currently subscribed.
 */
export function useOrderEvents(merchantOrderNo: string | undefined, onEvent: () => void): boolean {
  const [live, setLive] = useState(false);
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!merchantOrderNo) return;
    const channel = supabase
      .channel(`order:${merchantOrderNo}`)
      .on("broadcast", { event: "status" }, () => cb.current())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [merchantOrderNo]);

  return live;
}

/** Loads one order (own-order RLS) and keeps it fresh via Realtime, with a polling safety net. */
export function useOrder(merchantOrderNo: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!merchantOrderNo) return;
    const { data, error } = await orderClient(merchantOrderNo)
      .from("orders").select("*").eq("merchant_order_no", merchantOrderNo).maybeSingle();
    if (error) setError(error.message);
    else { setError(null); setOrder((data as Order | null) ?? null); }
    setLoading(false);
  }, [merchantOrderNo]);

  useEffect(() => { setLoading(true); setOrder(null); void load(); }, [load]);
  const live = useOrderEvents(merchantOrderNo, load);

  // Safety net: Realtime can drop; while the order is still pending, re-check every 6s.
  useEffect(() => {
    if (order && order.payin_state !== 1) return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [order, load]);

  return { order, loading, error, live, reload: load };
}
