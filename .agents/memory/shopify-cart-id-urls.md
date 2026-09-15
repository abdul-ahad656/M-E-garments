---
name: Shopify cart IDs in URLs
description: Why opaque Shopify cart IDs must not be placed in generated path segments.
---

Pass Shopify cart IDs as query parameters or request-body values, not as OpenAPI path parameters.

**Why:** Shopify cart IDs contain slash characters. The generated client did not encode those path values, so Express matched the wrong route and valid carts appeared missing.

**How to apply:** When adding endpoints for opaque provider identifiers, prefer generated query serialization or body fields unless path-encoding behavior is explicitly verified by an integration test.