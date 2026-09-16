import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

async function loadCommerce() {
  vi.resetModules();
  process.env.SHOPIFY_SHOP_DOMAIN = "store.example.com";
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "admin-token";
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "storefront-token";
  return import("./shopify-admin-commerce");
}

function graphqlResponse(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Shopify Admin commerce GraphQL", () => {
  it("lists products through Admin GraphQL", async () => {
    const { listAdminProducts } = await loadCommerce();
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        products: {
          edges: [
            {
              node: {
                id: "gid://shopify/Product/1",
                handle: "tee",
                title: "Tee",
                status: "ACTIVE",
                productType: "Tops",
                totalInventory: 3,
                updatedAt: "2026-01-01T00:00:00Z",
                featuredImage: { url: "https://cdn.example/tee.jpg" },
              },
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      }),
    );

    const result = await listAdminProducts();
    expect(result.products).toEqual([
      {
        id: "gid://shopify/Product/1",
        handle: "tee",
        title: "Tee",
        status: "ACTIVE",
        productType: "Tops",
        totalInventory: 3,
        featuredImageUrl: "https://cdn.example/tee.jpg",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://store.example.com/admin/api/2026-04/graphql.json",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("creates a product then variants and returns detail", async () => {
    const { createAdminProduct } = await loadCommerce();
    fetchMock
      .mockResolvedValueOnce(
        graphqlResponse({
          productCreate: {
            product: { id: "gid://shopify/Product/9" },
            userErrors: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          productVariantsBulkCreate: {
            productVariants: [{ id: "gid://shopify/ProductVariant/1" }],
            userErrors: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          product: {
            id: "gid://shopify/Product/9",
            handle: "tee",
            title: "Tee",
            descriptionHtml: "<p>Soft</p>",
            status: "DRAFT",
            productType: "Tops",
            tags: ["boys"],
            updatedAt: "2026-01-01T00:00:00Z",
            options: [{ id: "opt1", name: "Size", values: ["S"] }],
            media: { nodes: [] },
            variants: {
              nodes: [
                {
                  id: "gid://shopify/ProductVariant/1",
                  title: "S",
                  sku: "TEE-S",
                  price: "20.00",
                  compareAtPrice: null,
                  inventoryQuantity: 0,
                  selectedOptions: [{ name: "Size", value: "S" }],
                  inventoryItem: { id: "gid://shopify/InventoryItem/1" },
                },
              ],
            },
          },
        }),
      );

    const product = await createAdminProduct({
      title: "Tee",
      descriptionHtml: "<p>Soft</p>",
      tags: ["boys"],
      productType: "Tops",
      variants: [{ optionValues: ["S"], price: "20.00", sku: "TEE-S" }],
    });

    expect(product.id).toBe("gid://shopify/Product/9");
    expect(product.variants[0]?.price).toBe("20.00");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces Shopify userErrors when creating a product", async () => {
    const commerce = await loadCommerce();
    const { ShopifyAdminUserError } = await import("./shopify");
    fetchMock.mockResolvedValueOnce(
      graphqlResponse({
        productCreate: {
          product: null,
          userErrors: [{ message: "Title can't be blank" }],
        },
      }),
    );

    await expect(
      commerce.createAdminProduct({
        title: "Tee",
        variants: [{ optionValues: ["S"], price: "10.00" }],
      }),
    ).rejects.toBeInstanceOf(ShopifyAdminUserError);
  });

  it("adjusts inventory at the primary location", async () => {
    const { adjustAdminInventory } = await loadCommerce();
    fetchMock
      .mockResolvedValueOnce(
        graphqlResponse({
          locations: {
            edges: [{ node: { id: "gid://shopify/Location/1", name: "Shop", isActive: true } }],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          inventoryAdjustQuantities: {
            userErrors: [],
            inventoryAdjustmentGroup: {
              changes: [
                {
                  name: "available",
                  delta: 2,
                  quantityAfterChange: 5,
                  item: { id: "gid://shopify/InventoryItem/7" },
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          locations: {
            edges: [{ node: { id: "gid://shopify/Location/1", name: "Shop", isActive: true } }],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          productVariants: {
            edges: [
              {
                node: {
                  id: "gid://shopify/ProductVariant/3",
                  title: "S",
                  sku: "TEE-S",
                  inventoryQuantity: 5,
                  inventoryItem: { id: "gid://shopify/InventoryItem/7" },
                  product: { id: "gid://shopify/Product/9", title: "Tee" },
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        }),
      );

    const item = await adjustAdminInventory({
      inventoryItemId: "gid://shopify/InventoryItem/7",
      delta: 2,
    });
    expect(item.available).toBe(5);
    expect(item.productTitle).toBe("Tee");
  });

  it("fulfills an order using an open fulfillment order", async () => {
    const { fulfillAdminOrder } = await loadCommerce();
    const orderNode = {
      id: "gid://shopify/Order/99",
      name: "#1001",
      processedAt: "2026-01-01T00:00:00Z",
      displayFinancialStatus: "PAID",
      displayFulfillmentStatus: "UNFULFILLED",
      cancelledAt: null,
      totalPriceSet: { shopMoney: { amount: "24.00", currencyCode: "USD" } },
      email: "buyer@example.com",
      customer: { displayName: "Buyer" },
      lineItems: {
        nodes: [
          {
            id: "li1",
            title: "Tee",
            variantTitle: "S",
            quantity: 1,
            fulfillableQuantity: 1,
            originalUnitPriceSet: { shopMoney: { amount: "24.00", currencyCode: "USD" } },
            variant: { id: "gid://shopify/ProductVariant/1" },
          },
        ],
      },
      fulfillments: [],
      fulfillmentOrders: {
        nodes: [
          {
            id: "gid://shopify/FulfillmentOrder/5",
            status: "OPEN",
            lineItems: { nodes: [{ id: "foli1", remainingQuantity: 1 }] },
          },
        ],
      },
    };

    fetchMock
      .mockResolvedValueOnce(graphqlResponse({ order: orderNode }))
      .mockResolvedValueOnce(
        graphqlResponse({
          fulfillmentCreate: {
            fulfillment: { id: "gid://shopify/Fulfillment/1" },
            userErrors: [],
          },
        }),
      )
      .mockResolvedValueOnce(
        graphqlResponse({
          order: {
            ...orderNode,
            displayFulfillmentStatus: "FULFILLED",
            fulfillments: [
              {
                id: "gid://shopify/Fulfillment/1",
                status: "SUCCESS",
                trackingInfo: [
                  {
                    company: "UPS",
                    number: "1Z",
                    url: "https://track.example/1Z",
                  },
                ],
              },
            ],
          },
        }),
      );

    const updated = await fulfillAdminOrder("99", {
      trackingCompany: "UPS",
      trackingNumber: "1Z",
    });
    expect(updated.displayFulfillmentStatus).toBe("FULFILLED");
    expect(updated.fulfillments[0]?.tracking[0]?.number).toBe("1Z");
  });
});
