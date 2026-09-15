import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", fetchMock);

const graphqlResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function loadShopify() {
  vi.resetModules();
  return import("./shopify");
}

beforeEach(() => {
  fetchMock.mockReset();
  process.env.SHOPIFY_SHOP_DOMAIN = "store.example.com";
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "storefront-token";
  delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
});

describe("Shopify Storefront transport", () => {
  it.each([401, 403])(
    "refreshes configuration and retries once after %s",
    async (status) => {
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "expired-token";
      let call = 0;
      fetchMock.mockImplementation(async () => {
        call += 1;
        if (call === 1) {
          process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "refreshed-token";
          return graphqlResponse({}, status);
        }
        return graphqlResponse({ data: { shop: { name: "M&E" } } });
      });
      const { shopifyStorefrontQuery } = await loadShopify();

      await expect(
        shopifyStorefrontQuery<{ shop: { name: string } }>("{ shop { name } }"),
      ).resolves.toEqual({ shop: { name: "M&E" } });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get(
          "X-Shopify-Storefront-Access-Token",
        ),
      ).toBe("expired-token");
      expect(
        new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get(
          "X-Shopify-Storefront-Access-Token",
        ),
      ).toBe("refreshed-token");
    },
  );

  it("fails explicitly when Shopify returns GraphQL errors", async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({ errors: [{ message: "Query failed" }] }),
    );
    const { shopifyStorefrontQuery } = await loadShopify();

    await expect(shopifyStorefrontQuery("{ shop { name } }")).rejects.toThrow(
      /Shopify Storefront API error \(200\).*Query failed/,
    );
  });

  it("fails explicitly when Shopify omits GraphQL data", async () => {
    fetchMock.mockResolvedValueOnce(graphqlResponse({}));
    const { shopifyStorefrontQuery } = await loadShopify();

    await expect(shopifyStorefrontQuery("{ shop { name } }")).rejects.toThrow(
      /Shopify Storefront API error \(200\)/,
    );
  });

  it("bounds Storefront requests with ten-second timeout signals", async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({ data: { shop: { name: "M&E" } } }),
    );
    const { shopifyStorefrontQuery } = await loadShopify();

    await shopifyStorefrontQuery("{ shop { name } }");

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
    }
  });

  it("turns cart userErrors into ShopifyInputError", async () => {
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        data: {
          cartCreate: {
            cart: null,
            userErrors: [
              {
                field: ["input", "lines", "0", "merchandiseId"],
                message: "Variant is unavailable",
              },
            ],
          },
        },
      }),
    );
    const { createShopifyCart, ShopifyInputError } = await loadShopify();

    await expect(createShopifyCart("variant-1", 1)).rejects.toBeInstanceOf(
      ShopifyInputError,
    );
  });
});
