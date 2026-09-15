import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

async function loadShopify() {
  vi.resetModules();
  process.env.SHOPIFY_SHOP_DOMAIN = "store.example.com";
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "admin-token";
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "storefront-token";
  return import("./shopify");
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("Shopify Admin order API", () => {
  it("uses customer search then orders, mapping references only", async () => {
    const { getShopifyOrderReferences } = await loadShopify();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customers: [{ id: 42, email: "customer@example.com" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [
              {
                id: 99,
                name: "#1001",
                processed_at: "2026-01-01T00:00:00Z",
                financial_status: "paid",
                fulfillment_status: "fulfilled",
                total_price: "24.00",
                currency: "USD",
                customer: { id: 42 },
                email: "should-not-be-returned@example.com",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await getShopifyOrderReferences("customer@example.com");
    expect(result).toEqual([
      {
        id: "99",
        name: "#1001",
        processedAt: "2026-01-01T00:00:00Z",
        displayFinancialStatus: "paid",
        displayFulfillmentStatus: "fulfilled",
        totalPrice: { amount: "24.00", currencyCode: "USD" },
      },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/admin/api/2026-04/customers/search.json?query=email%3Acustomer%40example.com",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/admin/api/2026-04/customers/42/orders.json?status=any",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain(
      "/admin/api/2026-04/orders.json",
    );
    expect(JSON.stringify(result)).not.toContain("customer@example.com");
    expect(JSON.stringify(result)).not.toContain("should-not-be-returned");
  });

  it("returns no orders when the customer search is empty", async () => {
    const { getShopifyOrderReferences } = await loadShopify();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ customers: [] }), { status: 200 }),
    );
    await expect(getShopifyOrderReferences("nobody@example.com")).resolves.toEqual(
      [],
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns no orders for a non-exact customer email match", async () => {
    const { getShopifyOrderReferences } = await loadShopify();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          customers: [{ id: 42, email: "different@example.com" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      getShopifyOrderReferences("customer@example.com"),
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed for ambiguous exact email matches", async () => {
    const { getShopifyOrderReferences } = await loadShopify();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          customers: [
            { id: 42, email: "customer@example.com" },
            { id: 43, email: "CUSTOMER@EXAMPLE.COM" },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      getShopifyOrderReferences("customer@example.com"),
    ).rejects.toThrow("ambiguous customer matches");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed if a customer-scoped response contains another customer's order", async () => {
    const { getShopifyOrderReferences } = await loadShopify();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customers: [{ id: 42, email: "customer@example.com" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [
              {
                id: 99,
                name: "#1001",
                processed_at: "2026-01-01T00:00:00Z",
                financial_status: "paid",
                fulfillment_status: null,
                total_price: "24.00",
                currency: "USD",
                customer: { id: 84 },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(
      getShopifyOrderReferences("customer@example.com"),
    ).rejects.toThrow("owned by a different customer");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/customers/42/orders.json?",
    );
  });

  it("maps live line items, fulfillment state, and safe tracking links", async () => {
    const { getShopifyOrderDetail } = await loadShopify();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customers: [{ id: 42, email: "customer@example.com" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            order: {
              id: 99,
              name: "#1001",
              processed_at: "2026-01-01T00:00:00Z",
              financial_status: "paid",
              fulfillment_status: "fulfilled",
              total_price: "24.00",
              currency: "USD",
              customer: { id: 42 },
              line_items: [
                {
                  id: 501,
                  title: "Rose Dress",
                  variant_title: "8 / Pink",
                  quantity: 1,
                  price: "24.00",
                },
              ],
              fulfillments: [
                {
                  id: 701,
                  status: "success",
                  tracking_company: "UPS",
                  tracking_numbers: ["1Z999", "unsafe"],
                  tracking_urls: [
                    "https://www.ups.com/track?tracknum=1Z999",
                    "javascript:alert(1)",
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      getShopifyOrderDetail("customer@example.com", "99"),
    ).resolves.toEqual({
      id: "99",
      name: "#1001",
      processedAt: "2026-01-01T00:00:00Z",
      displayFinancialStatus: "paid",
      displayFulfillmentStatus: "fulfilled",
      totalPrice: { amount: "24.00", currencyCode: "USD" },
      lineItems: [
        {
          id: "501",
          title: "Rose Dress",
          variantTitle: "8 / Pink",
          quantity: 1,
          price: { amount: "24.00", currencyCode: "USD" },
        },
      ],
      fulfillments: [
        {
          id: "701",
          status: "success",
          tracking: [
            {
              company: "UPS",
              number: "1Z999",
              url: "https://www.ups.com/track?tracknum=1Z999",
            },
          ],
        },
      ],
    });
  });

  it("does not reveal an order owned by a different exact customer", async () => {
    const { getShopifyOrderDetail, ShopifyOrderNotFoundError } =
      await loadShopify();
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            customers: [{ id: 42, email: "customer@example.com" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            order: {
              id: 99,
              customer: { id: 84 },
            },
          }),
          { status: 200 },
        ),
      );

    await expect(
      getShopifyOrderDetail("customer@example.com", "99"),
    ).rejects.toBeInstanceOf(ShopifyOrderNotFoundError);
  });
});
