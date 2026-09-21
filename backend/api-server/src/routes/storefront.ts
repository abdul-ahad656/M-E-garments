import { Router, type IRouter } from "express";
import {
  GetStorefrontHomeResponse,
  GetStorefrontStatusResponse,
  GetProductParams,
  GetProductResponse,
  SearchProductsQueryParams,
  SearchProductsResponse,
} from "@workspace/api-zod";
import {
  getCatalogHealth,
  getProductByHandle,
  isCommerceReady,
  listActiveProductsForHome,
  searchProducts,
  CommerceNotFoundError,
} from "../lib/commerce-repository";
import { recordAnalyticsEvent } from "../lib/admin-repository";
import { isAiAvailable } from "../lib/ai-status";

const router: IRouter = Router();

router.post("/storefront/analytics", async (req, res): Promise<void> => {
  const body = req.body as {
    eventName?: unknown;
    sessionId?: unknown;
    path?: unknown;
    properties?: unknown;
  };
  const eventName =
    typeof body.eventName === "string" ? body.eventName.trim() : "";
  if (!eventName || eventName.length > 100) {
    res.status(400).json({
      error: "Invalid analytics event.",
      code: "INVALID_EVENT",
    });
    return;
  }

  try {
    await recordAnalyticsEvent({
      eventName,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      path: typeof body.path === "string" ? body.path : null,
      properties:
        body.properties &&
        typeof body.properties === "object" &&
        !Array.isArray(body.properties)
          ? (body.properties as Record<string, unknown>)
          : {},
    });
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Analytics event recording failed");
    // Never break the storefront for analytics failures.
    res.status(204).end();
  }
});

router.get("/storefront/status", async (_req, res) => {
  const ready = await isCommerceReady();
  const data = GetStorefrontStatusResponse.parse({
    aiAvailable: isAiAvailable(),
    catalogReady: ready,
    message: ready
      ? "Catalog is connected. Live product data is available."
      : "Connect Supabase to display live products, prices, and availability.",
  });
  res.json(data);
});

router.get("/storefront/home", async (req, res) => {
  try {
    const products = await listActiveProductsForHome(24);
    const boys = products.filter((p) =>
      p.tags.some((t) => t.toLowerCase() === "boys"),
    );
    const girls = products.filter((p) =>
      p.tags.some((t) => t.toLowerCase() === "girls"),
    );
    const party = products.filter((p) =>
      p.tags.some((t) => ["party", "partywear"].includes(t.toLowerCase())),
    );

    const groups = [
      { title: "New arrivals", handle: "new", products: products.slice(0, 8) },
      { title: "Boys", handle: "boys", products: boys.slice(0, 8) },
      { title: "Girls", handle: "girls", products: girls.slice(0, 8) },
      { title: "Partywear", handle: "partywear", products: party.slice(0, 8) },
    ].filter((group) => group.products.length > 0);

    res.json(
      GetStorefrontHomeResponse.parse({
        groups: groups.length
          ? groups
          : [{ title: "Catalog", handle: "all", products: products.slice(0, 8) }],
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Storefront home failed");
    res.status(503).json({
      error: "The catalog is temporarily unavailable.",
      code: "COMMERCE_UNAVAILABLE",
    });
  }
});

router.get("/storefront/products/:handle", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({
      error: "Invalid product handle.",
      code: "INVALID_HANDLE",
    });
    return;
  }

  try {
    const product = await getProductByHandle(params.data.handle);
    if (!product) {
      res.status(404).json({
        error: "Product not found.",
        code: "PRODUCT_NOT_FOUND",
      });
      return;
    }
    res.json(GetProductResponse.parse(product));
  } catch (error) {
    if (error instanceof CommerceNotFoundError) {
      res.status(404).json({ error: error.message, code: "PRODUCT_NOT_FOUND" });
      return;
    }
    req.log.error({ err: error }, "Product lookup failed");
    res.status(503).json({
      error: "The catalog is temporarily unavailable.",
      code: "COMMERCE_UNAVAILABLE",
    });
  }
});

router.get("/storefront/search", async (req, res): Promise<void> => {
  const parsed = SearchProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search filters.", code: "INVALID_QUERY" });
    return;
  }

  try {
    const { query, collection, age, occasion, limit = 20 } = parsed.data;
    const terms = [query, collection, age, occasion]
      .filter((value): value is string => Boolean(value?.trim()))
      .flatMap((value) => value.split(/\s+/))
      .map((value) => value.trim())
      .filter(Boolean);

    const products = await searchProducts(terms, limit);
    res.json(SearchProductsResponse.parse({ products, total: products.length }));
  } catch (error) {
    req.log.error({ err: error }, "Product search failed");
    res.status(503).json({
      error: "The catalog is temporarily unavailable.",
      code: "COMMERCE_UNAVAILABLE",
    });
  }
});

// Used by admin overview compatibility
export { getCatalogHealth };

export default router;
