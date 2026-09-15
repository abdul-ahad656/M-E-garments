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
# API on http://localhost:8080
npm run dev:api

# Storefront on http://localhost:25490 (proxies /api → API)
npm run dev:web
```

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
- Set `SHOPIFY_SHOP_DOMAIN` + `SHOPIFY_STOREFRONT_ACCESS_TOKEN` for catalog/cart.
- Set `SHOPIFY_ADMIN_ACCESS_TOKEN` for order lookup features.
- Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for profiles/wishlist.
- Set `VITE_CLERK_PUBLISHABLE_KEY` for storefront auth.
- Change `lib/api-spec/openapi.yaml` first, then run `npm run codegen`.
