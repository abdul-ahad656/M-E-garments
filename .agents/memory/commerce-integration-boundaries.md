---
name: Commerce integration boundaries
description: Durable platform constraints for M&E commerce on Supabase + R2 + Clerk.
---

Supabase Postgres is the system of record for products, variants, prices, inventory, carts, checkout, and orders. The API server reads and writes commerce tables via PostgREST with the service role (`backend/api-server/src/lib/supabase.ts`); do not invent a parallel catalog outside those tables. Cloudflare R2 stores image file bytes only — persist public URLs on `product_images`, never treat R2 as a second product database. Clerk owns customer and staff identity; checkout requires a signed-in customer so account orders stay ownership-safe via `clerk_user_id`. Checkout creates unpaid orders (`payment_status: unpaid`) until Stripe (or another gateway) is added; staff may mark orders paid manually. There is no Shopify dependency.

**Why:** These boundaries keep commerce truth in one place, prevent identity leakage across accounts, and leave a clean hook for future card capture without rewriting the order model.

**How to apply:** Route buyer catalog/cart/checkout and staff product/inventory/order ops through the commerce/cart/order repositories. Use R2 only for media upload URLs saved on products. Scope customer order reads to the authenticated Clerk user. Prefer mark-paid / refund status updates over fabricating payment gateway responses.
