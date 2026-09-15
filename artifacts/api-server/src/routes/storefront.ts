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
  isShopifyConfigured,
  getShopifyProduct,
  mapStorefrontProduct,
  searchShopifyProducts,
  shopifyStorefrontQuery,
  type ShopifyProductNode,
  STOREFRONT_PRODUCT_FIELDS,
} from "../lib/shopify";
import { isAiAvailable } from "../lib/ai-status";

const router: IRouter = Router();

router.get("/storefront/status", (_req, res) => {
  const connected = isShopifyConfigured();
  const data = GetStorefrontStatusResponse.parse({
    shopifyConnected: connected,
    aiAvailable: isAiAvailable(),
    catalogReady: connected,
    message: connected
      ? "Shopify is connected. Live catalog data is available."
      : "Connect Shopify to display live products, prices, and availability.",
  });
  res.json(data);
});

router.get("/storefront/home", async (req, res) => {
  if (!isShopifyConfigured()) {
    res.status(503).json({
      error: "Shopify is not connected yet.",
      code: "SHOPIFY_NOT_CONFIGURED",
    });
    return;
  }

  try {
    const result = await shopifyStorefrontQuery<{
      collections: {
        nodes: Array<{
          title: string;
          handle: string;
          products: { nodes: ShopifyProductNode[] };
        }>;
      };
    }>(`
      query StorefrontHome {
        collections(first: 6, sortKey: UPDATED_AT, reverse: true) {
          nodes {
            title handle
            products(first: 8) { nodes { ${STOREFRONT_PRODUCT_FIELDS} } }
          }
        }
      }
    `);

    const data = GetStorefrontHomeResponse.parse({
      groups: result.collections.nodes.map((collection) => ({
        title: collection.title,
        handle: collection.handle,
        products: collection.products.nodes.map(mapStorefrontProduct),
      })),
    });
    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "Shopify homepage query failed");
    res.status(503).json({
      error: "The live catalog is temporarily unavailable.",
      code: "SHOPIFY_UNAVAILABLE",
    });
  }
});

router.get("/storefront/products/:handle", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({
      error: "Invalid product handle.",
      code: "INVALID_PRODUCT_HANDLE",
    });
    return;
  }

  try {
    const product = await getShopifyProduct(params.data.handle);
    if (!product) {
      res.status(404).json({
        error: "Product not found.",
        code: "PRODUCT_NOT_FOUND",
      });
      return;
    }
    res.json(GetProductResponse.parse(product));
  } catch (error) {
    req.log.error({ err: error }, "Shopify product query failed");
    res.status(503).json({
      error: "Product details are temporarily unavailable.",
      code: "SHOPIFY_UNAVAILABLE",
    });
  }
});

router.get("/storefront/search", async (req, res) => {
  const parsed = SearchProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search filters.", code: "INVALID_QUERY" });
    return;
  }
  if (!isShopifyConfigured()) {
    res.status(503).json({
      error: "Shopify is not connected yet.",
      code: "SHOPIFY_NOT_CONFIGURED",
    });
    return;
  }

  const { query, collection, age, occasion, limit = 20 } = parsed.data;
  const terms = [query, collection, age, occasion].filter(Boolean).join(" ");

  try {
    const products = await searchShopifyProducts(terms, limit);
    res.json(SearchProductsResponse.parse({ products, total: products.length }));
  } catch (error) {
    req.log.error({ err: error }, "Shopify product search failed");
    res.status(503).json({
      error: "Product search is temporarily unavailable.",
      code: "SHOPIFY_UNAVAILABLE",
    });
  }
});

export default router;