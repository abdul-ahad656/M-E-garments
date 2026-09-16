---
name: Commerce integration boundaries
description: Durable platform constraints for the M&E Shopify integration.
---

Shopify remains the system of record for products, variants, prices, inventory, carts, checkout, orders, payments, and fulfillment. Buyer requests use the connector-provided Storefront configuration. Staff-authenticated Admin GraphQL reads and writes are proxied through the API server (`SHOPIFY_ADMIN_ACCESS_TOKEN`) and never invent parallel commerce rows in Supabase. Customer order lookup still requires a verified server-derived identity, an exact unambiguous customer match, a customer-scoped order request, and ownership validation on every returned order. Treat catalog and order synchronization as pull/revalidation because this connector path does not support Shopify webhooks.

**Why:** These are connector-specific platform boundaries that are not evident from the storefront code and prevent unsafe auth handling or a false real-time synchronization design.

**How to apply:** Use Shopify-hosted checkout and verified Storefront data for buyer flows. Route Admin reads and staff commerce writes through the API proxy, fail closed on ambiguous customer identity, never fabricate commerce records or create parallel order/product truth in Supabase, and do not promise webhook-driven freshness.
