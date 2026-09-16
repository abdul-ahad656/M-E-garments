# M&E Garments

AI-assisted premium kidswear storefront using Shopify as the commerce source of truth.

## Stack

- npm workspaces, Node.js 20+, TypeScript 5.9
- Frontend: React + Vite (`artifacts/me-garments`)
- API: Express 5 (`artifacts/api-server`)
- App data: Supabase/PostgreSQL (`supabase/migrations`, `lib/db`)
- Auth: Clerk
- API contract: OpenAPI → Orval (`lib/api-spec`)

## Setup

```bash
npm install
cp .env.example .env
# fill in Shopify, Clerk, Supabase, and OpenAI values
```

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
| `artifacts/me-garments` | React storefront |
| `artifacts/api-server` | Express API (Shopify, assistant, account) |
| `artifacts/mockup-sandbox` | UI component sandbox |
| `lib/api-spec` | OpenAPI source of truth |
| `lib/api-client-react` | Generated React Query hooks |
| `lib/api-zod` | Generated Zod schemas |
| `lib/db` | Drizzle / Postgres helpers |
| `supabase/migrations` | Application SQL migrations |

## Architecture notes

- Shopify owns products, variants, prices, inventory, carts, checkout, and orders.
- Staff portal at `/admin` proxies Shopify Admin GraphQL for product, inventory, and order ops (fulfill / refund / cancel). Clerk `owner` / `admin` / `staff` roles gate access.
- Set `SHOPIFY_SHOP_DOMAIN` + `SHOPIFY_STOREFRONT_ACCESS_TOKEN` for catalog/cart.
- Set `SHOPIFY_ADMIN_ACCESS_TOKEN` with Admin API scopes for customer order lookup and staff commerce writes (products, inventory, orders, fulfillments, refunds).
- Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for profiles/wishlist/admin app data.
- Set `VITE_CLERK_PUBLISHABLE_KEY` for storefront auth.
- Change `lib/api-spec/openapi.yaml` first, then run `npm run codegen`.
