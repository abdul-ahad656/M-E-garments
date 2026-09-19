---
name: Cart IDs in URLs
description: Why opaque cart IDs must not be placed in generated path segments.
---

Pass cart IDs as query parameters or request-body values, not as OpenAPI path parameters.

**Why:** Some cart ID formats historically contained slash characters. The generated client did not encode those path values, so Express matched the wrong route and valid carts appeared missing.

**How to apply:** Keep cart identity on `GET /storefront/cart?cartId=` and cart mutation bodies. Prefer UUID cart IDs from Supabase; still treat them as opaque strings in the client.
