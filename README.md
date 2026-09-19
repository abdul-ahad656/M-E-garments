# M&E Garments

AI-assisted premium kidswear storefront with Supabase as the commerce source of truth, Cloudflare R2 for product images, and Clerk for identity.

## Stack

- npm workspaces, Node.js 20+, TypeScript 5.9
- Frontend: React + Vite (`artifacts/me-garments`)
- API: Express 5 (`artifacts/api-server`)
- Commerce + app data: Supabase/PostgreSQL (`supabase/migrations`)
- Image files: Cloudflare R2
- Auth: Clerk
- API contract: OpenAPI → Orval (`lib/api-spec`)

## Setup

```bash
npm install
cp .env.example .env
# fill in Supabase, Clerk, OpenAI, R2, and STORE_CURRENCY (default PKR)
```

Apply SQL migrations in `supabase/migrations` (including `0003_commerce_core.sql`) to your Supabase project before running commerce flows.

## Run locally

Two terminals from the repo root:

```bash
# API on http://localhost:3001 (loads repo-root .env)
npm run dev:api

# Storefront on http://localhost:25490 (proxies /api → API)
npm run dev:web
```

If `/api` returns Apache HTML 404s, something else is bound to the API port
(common with XAMPP on 8080). Keep `PORT=3001` in `.env`, or set
`API_PROXY_TARGET` to match whatever port the API is using.

## Useful scripts

```bash
npm run typecheck
npm run codegen
npm run validate
```

## Where things live

| Path | Purpose |
|------|---------|
| `artifacts/me-garments` | React storefront + admin portal |
| `artifacts/api-server` | Express API (commerce, cart, orders, assistant, account) |
| `artifacts/mockup-sandbox` | UI component sandbox |
| `lib/api-spec` | OpenAPI source of truth |
| `lib/api-client-react` | Generated React Query hooks |
| `lib/api-zod` | Generated Zod schemas |
| `lib/db` | Drizzle / Postgres helpers |
| `supabase/migrations` | Application SQL migrations |

## Architecture notes

- Supabase owns products, variants, prices, inventory, carts, checkout, and orders (`products`, `product_variants`, `product_images`, `carts`, `orders`, …).
- Checkout requires a signed-in Clerk customer and creates an **unpaid** order; staff can **Mark paid** in admin until Stripe is added later.
- Staff portal at `/admin` uses Supabase-backed product, inventory, and order ops (fulfill / mark paid / refund / cancel). Clerk `owner` / `admin` / `staff` roles gate access.
- Cloudflare R2 stores product image files (`POST /admin/media/upload`). Public URLs are saved on `product_images` when the product is created or updated.
- Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for commerce and app data.
- Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` for admin image uploads (bucket must be publicly readable).
- Set `STORE_CURRENCY` (default `PKR`) for cart and order money amounts.
- Set `VITE_CLERK_PUBLISHABLE_KEY` for storefront auth.
- Change `lib/api-spec/openapi.yaml` first, then run `npm run codegen`.
