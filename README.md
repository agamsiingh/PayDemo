# PayDemo: learn the SilkPay integration

A demo store (React + Vite + TypeScript + Tailwind, Supabase Postgres / Edge Functions / Realtime) that teaches how to integrate the **SilkPay** payment gateway (INR / UPI, API v2.4). Nothing real is sold.

| Page | Route |
| --- | --- |
| Shop | `/` |
| Checkout | `/checkout/:productId` |
| Payment status (the `returnUrl`) | `/status/:merchantOrderNo` |
| **Integration Inspector** | `/how-it-works`, `/how-it-works/:merchantOrderNo` |
| Admin / Logs | `/admin` |
| Integration Guide | `/guide` |
| Fake cashier (demo mode only) | `/fake-cashier/:merchantOrderNo` |

## Architecture

```
Browser --create-payin--> Edge Function --Bearer token--> SilkPay API
   ^                          | insert order (pending) + api_logs
   |  redirect to cashierUrl  v
   +---------- SilkPay cashier (customer pays) --notifyUrl--> silkpay-webhook
Browser <-- Realtime broadcast + returnUrl -- orders row updated only by webhook / query-payin
```

Edge Functions: `create-payin`, `silkpay-webhook`, `query-payin`, plus two helpers: `get-logs` (serves the Inspector and Admin because the log tables have no public RLS policy) and `demo-simulate` (demo mode only).

## Setup

1. **Install**: `npm install`
2. **Create a Supabase project**, then install the [Supabase CLI](https://supabase.com/docs/guides/cli) and link it:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```
3. **Create the tables, RLS and Realtime trigger**: `supabase db push` (runs `supabase/migrations/0001_init.sql`).
4. **Set secrets** (never in the frontend):
   ```bash
   supabase secrets set SITE_URL=http://localhost:5173 ADMIN_KEY=choose-a-long-random-string
   # Real/sandbox gateway. Skip this line to stay in DEMO MODE:
   supabase secrets set SILKPAY_API_TOKEN=your-sandbox-token
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions automatically.
5. **Deploy the functions**:
   ```bash
   supabase functions deploy create-payin
   supabase functions deploy silkpay-webhook --no-verify-jwt
   supabase functions deploy query-payin
   supabase functions deploy get-logs
   supabase functions deploy demo-simulate
   ```
   `supabase/config.toml` already sets `verify_jwt = false` for the webhook (SilkPay sends no Supabase JWT; the MD5 `sign` is the authentication). `--no-verify-jwt` makes it explicit. In the dashboard: Edge Functions, `silkpay-webhook`, Details, turn **Enforce JWT Verification** off.
6. **Frontend env**: `cp .env.example .env`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public values only), then `npm run dev`.

The webhook URL SilkPay calls is `https://YOUR-PROJECT-REF.supabase.co/functions/v1/silkpay-webhook`. It is sent automatically as `notifyUrl`, so give SilkPay nothing else unless they require a whitelist.

### Demo mode

If `SILKPAY_API_TOKEN` is **not set**, `create-payin` skips SilkPay and returns a cashier URL pointing at the built-in `/fake-cashier/...` page. Its "Simulate success / failure" buttons call `demo-simulate`, which sends a **correctly signed fake webhook** to your real `silkpay-webhook`, so the full flow (including the Inspector's signature check) works without real money. Demo webhooks are signed with a public demo key. Setting a real token switches to the real API and disables the simulator. The header shows which mode is active.

To go live-ish: `supabase secrets set SILKPAY_API_TOKEN=...` (no redeploy needed). To return to demo: `supabase secrets unset SILKPAY_API_TOKEN`.

### Local testing of the webhook with a real gateway

SilkPay must reach your `notifyUrl` from the internet, so test against the deployed functions (or tunnel `supabase functions serve` with ngrok and override the URL). Set `SITE_URL` to your deployed site so `returnUrl` is right.

## Tests

```bash
npm test
```
Checks the MD5 signature function (`supabase/functions/_shared/sign.ts`) against a known payload and its edge cases (empty values dropped, key order, case-insensitive compare, tampering).

## Security notes

- The token is read only inside Edge Functions via `Deno.env`. It is never sent to the browser, stored in `api_logs` (request **bodies** only), or stored in `webhook_logs` (the string-to-sign is saved **without** `&key=...`).
- Prices come from the server (`_shared/products.ts`); the browser only sends a product id.
- Only the webhook or the query API can mark an order paid. The status page is just a viewer.
- The webhook is idempotent (conditional `UPDATE ... WHERE payin_state <> 2`), verifies the amount, and logs every call (valid or not) before acting.
- **RLS**: no write policies exist, so only the service role writes. `orders` can be read only when the request carries a matching `x-order-no` header. `webhook_logs` and `api_logs` have no policies.
- **Trade-off to know about**: Realtime "Postgres Changes" cannot evaluate that per-request header, so live updates use a database trigger that broadcasts a PII-free `{payin_state, utr, paid_at}` message on a per-order topic (`order:<merchantOrderNo>`). The 96-bit random order number acts as the capability, and the status page also polls every 6s as a fallback. `get-logs` returns one order's logs to anyone holding its number (the Inspector's design); the all-orders Admin view needs `ADMIN_KEY`.
- The browser-facing functions use `verify_jwt = false` because the demo has no user login. For a real product, add authentication and rate limiting.

## Deploying the frontend

`npm run build` outputs `dist/`. Any static host works; `public/_redirects` handles SPA routing on Netlify/Cloudflare (on Vercel add a rewrite of `/(.*)` to `/index.html`). Set the two `VITE_` variables in the host, and set the `SITE_URL` secret to the final URL.

## Notes on assumptions

The webhook payload field names are not fully documented, so the handler looks for several spellings (`merchantOrderNo`, `payinState`/`status`, `utr`, `amount`, ...) and stores the full raw payload. If your sandbox payload differs, adjust `pick(...)` in `supabase/functions/silkpay-webhook/index.ts`; the Admin page shows exactly what arrived. The query endpoint is called with `{ orderNo: <gatewayOrderNo> }`; change it to the merchant order number if SilkPay expects that.
