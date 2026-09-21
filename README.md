# M&E Garments

AI-assisted premium kidswear storefront with Supabase as the commerce source of truth, Cloudflare R2 for product images, and Clerk for identity.

## Stack

- npm workspaces, Node.js 20+, TypeScript 5.9
- Frontend: React + Vite (`frontend/me-garments`)
- API: Express 5 (`backend/api-server`)
- Commerce + app data: Supabase/PostgreSQL (`backend/supabase/migrations`)
- Image files: Cloudflare R2
- Auth: Clerk
- API contract: OpenAPI → Orval (`backend/api-spec`)

## Setup

```bash
npm install
# fill in Supabase, Clerk, OpenAI, R2, and STORE_CURRENCY (default PKR)
```

Apply SQL migrations in `backend/supabase/migrations` (including `0003_commerce_core.sql`) to your Supabase project before running commerce flows.

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

## Production URLs

Leave `VITE_API_BASE_URL` empty locally so Vite proxies `/api` to the API.
In production:

- Set `VITE_API_BASE_URL` to the public API origin on the frontend host (e.g. Vercel).
- Set `FRONTEND_URL` to the public storefront origin on the API host (restricts CORS when set).
- Allow both URLs in the Clerk dashboard (origins / redirects).
- On Vercel, root `vercel.json` sets the build output to `frontend/me-garments/dist/public` and an SPA fallback rewrite only (`/(.*)` → `/index.html`); do not hardcode an `/api` proxy rewrite.
- Set Vercel env: `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_BASE_URL` (public API origin, no trailing slash).

## Useful scripts

```bash
npm run typecheck
npm run codegen
npm run validate
```

## Where things live

| Path | Purpose |
|------|---------|
| `frontend/me-garments` | React storefront + admin portal |
| `backend/api-server` | Express API (commerce, cart, orders, assistant, account) |
| `frontend/mockup-sandbox` | UI component sandbox |
| `backend/api-spec` | OpenAPI source of truth |
| `frontend/api-client-react` | Generated React Query hooks |
| `backend/api-zod` | Generated Zod schemas |
| `backend/db` | Drizzle / Postgres helpers |
| `backend/supabase/migrations` | Application SQL migrations |
| `backend/Image_Generation_Module` | Python on-model image generation |

## Architecture notes

- Supabase owns products, variants, prices, inventory, carts, checkout, and orders (`products`, `product_variants`, `product_images`, `carts`, `orders`, …).
- Checkout requires a signed-in Clerk customer and creates an **unpaid** order; staff can **Mark paid** in admin until Stripe is added later.
- Staff portal at `/admin` uses Supabase-backed product, inventory, and order ops (fulfill / mark paid / refund / cancel). Clerk `owner` / `admin` / `staff` roles gate access.
- Cloudflare R2 stores product image files (`POST /admin/media/upload`). Public URLs are saved on `product_images` when the product is created or updated.
- Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for commerce and app data.
- Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` for admin image uploads (bucket must be publicly readable).
- Set `STORE_CURRENCY` (default `PKR`) for cart and order money amounts.
- Set `VITE_CLERK_PUBLISHABLE_KEY` for storefront auth.
- Set `VITE_API_BASE_URL` (frontend) and `FRONTEND_URL` (API) in production; see **Production URLs**.
- Change `backend/api-spec/openapi.yaml` first, then run `npm run codegen`.
