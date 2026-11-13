-- PayDemo schema. Run with `supabase db push` (or paste into the SQL editor).

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  merchant_order_no text not null unique,
  gateway_order_no text,
  amount numeric(12,2) not null check (amount > 0),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  product_name text not null,
  cashier_url text,
  payin_state int not null default 1,   -- 1 Pending, 2 Success, 3 Failed, 4 Expired
  utr text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_order_no text,
  raw_payload jsonb,
  string_to_sign text,        -- the sorted k=v string WITHOUT "&key=<token>"
  computed_sign text,
  received_sign text,
  signature_valid boolean,
  note text,                  -- what the handler did (e.g. "duplicate ignored")
  created_at timestamptz not null default now()
);

create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_order_no text,
  endpoint text not null,
  request_body jsonb,         -- body only. The Authorization header is never stored.
  response_body jsonb,
  created_at timestamptz not null default now()
);

create index if not exists webhook_logs_order_idx on public.webhook_logs (merchant_order_no, created_at);
create index if not exists api_logs_order_idx on public.api_logs (merchant_order_no, created_at);

-- ---------------------------------------------------------------- RLS
alter table public.orders enable row level security;
alter table public.webhook_logs enable row level security;
alter table public.api_logs enable row level security;

-- Browsers may SELECT an order only if they present its number in the `x-order-no` header
-- (the supabase-js client in src/lib/supabase.ts sets it). No INSERT/UPDATE/DELETE policies exist,
-- so only the service role (Edge Functions) can write. The log tables have no policies at all,
-- so they are invisible to anon; the `get-logs` Edge Function serves them.
drop policy if exists "read own order" on public.orders;
create policy "read own order" on public.orders
  for select to anon, authenticated
  using (
    merchant_order_no = coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-order-no', ''
    )
  );

revoke all on public.orders, public.webhook_logs, public.api_logs from anon, authenticated;
grant select on public.orders to anon, authenticated;

-- ---------------------------------------------------------------- Realtime
-- Postgres Changes cannot evaluate a per-request header, so a strict "own order only" policy would
-- deliver no events. Instead a trigger broadcasts a PII-free status message on a per-order topic.
-- The order number (96 bits of randomness) is the capability needed to listen.
create or replace function public.broadcast_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'merchant_order_no', new.merchant_order_no,
      'payin_state', new.payin_state,
      'utr', new.utr,
      'paid_at', new.paid_at
    ),
    'status',
    'order:' || new.merchant_order_no,
    false
  );
  return new;
end $$;

drop trigger if exists orders_broadcast on public.orders;
create trigger orders_broadcast
  after insert or update of payin_state, utr, paid_at on public.orders
  for each row execute function public.broadcast_order_status();

-- Also enable classic Realtime on orders (service-role/dashboard consumers; anon sees nothing via RLS).
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
