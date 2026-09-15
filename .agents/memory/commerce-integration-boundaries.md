---
name: Commerce integration boundaries
description: Durable platform constraints for the M&E Shopify integration.
---

Shopify remains the system of record for products, variants, prices, inventory, carts, checkout, orders, payments, and fulfillment. Buyer requests use the connector-provided Storefront configuration. Admin reads use the connector's authenticated proxy rather than exposing or minting Admin tokens. Customer order lookup requires a verified server-derived identity, an exact unambiguous customer match, a customer-scoped order request, and ownership validation on every returned order. Treat catalog and order synchronization as pull/revalidation because this connector path does not support Shopify webhooks.

**Why:** These are connector-specific platform boundaries that are not evident from the storefront code and prevent unsafe auth handling or a false real-time synchronization design.

**How to apply:** Use Shopify-hosted checkout and verified Storefront data for buyer flows. Route Admin reads through the connector, fail closed on ambiguous customer identity, never fabricate commerce records or create parallel order truth, and do not promise webhook-driven freshness.