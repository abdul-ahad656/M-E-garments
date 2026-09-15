import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  userId: "user_server_123" as string | null,
  getUser: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  getOrCreateProfile: vi.fn(),
  updateProfile: vi.fn(),
  listWishlist: vi.fn(),
  saveWishlist: vi.fn(),
  deleteWishlist: vi.fn(),
  listRecentlyViewed: vi.fn(),
  saveRecentlyViewed: vi.fn(),
}));
const orders = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: auth.userId, sessionClaims: {} }),
  clerkClient: { users: { getUser: auth.getUser } },
}));
vi.mock("../lib/customer-repository", () => repository);
vi.mock("../lib/shopify", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/shopify")>();
  return {
    ...original,
    getShopifyOrderDetail: orders.get,
    getShopifyOrderReferences: orders.list,
    listShopifyOrdersByEmail: orders.list,
  };
});

import {
  getCustomerOrder,
  getCustomerProfile,
  listCustomerOrders,
  deleteWishlistItem,
  saveWishlistItem,
  setBaseUrl,
} from "@workspace/api-client-react";
import app from "../app";

let server: Server;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind");
  setBaseUrl(`http://127.0.0.1:${address.port}`);
});

afterAll(async () => {
  setBaseUrl(null);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.userId = "user_server_123";
  auth.getUser.mockResolvedValue({
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      { id: "email_other", emailAddress: "other@example.com" },
      {
        id: "email_primary",
        emailAddress: "customer@example.com",
        verification: { status: "verified" },
      },
    ],
  });
});

describe("authenticated account API", () => {
  it("rejects requests without server-verified Clerk identity", async () => {
    auth.userId = null;
    await expect(getCustomerProfile()).rejects.toMatchObject({
      status: 401,
      data: { code: "UNAUTHORIZED" },
    });
    expect(repository.getOrCreateProfile).not.toHaveBeenCalled();
  });

  it("scopes persistence to the server-derived Clerk user", async () => {
    repository.saveWishlist.mockResolvedValue({
      shopifyProductId: "gid://shopify/Product/1",
      productHandle: "dress",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await saveWishlistItem({
      shopifyProductId: "gid://shopify/Product/1",
      productHandle: "dress",
    });
    expect(repository.saveWishlist).toHaveBeenCalledWith("user_server_123", {
      shopifyProductId: "gid://shopify/Product/1",
      productHandle: "dress",
    });
  });

  it("deletes slash-containing Shopify GIDs via the query contract", async () => {
    await deleteWishlistItem({
      shopifyProductId: "gid://shopify/Product/1",
    });
    expect(repository.deleteWishlist).toHaveBeenCalledWith(
      "user_server_123",
      "gid://shopify/Product/1",
    );
  });

  it("looks up live orders only by the Clerk primary email", async () => {
    orders.list.mockResolvedValue([]);
    await listCustomerOrders();
    expect(auth.getUser).toHaveBeenCalledWith("user_server_123");
    expect(orders.list).toHaveBeenCalledWith("customer@example.com");
  });

  it("looks up one live order by verified Clerk email and the requested id", async () => {
    orders.get.mockResolvedValue({
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
              url: "https://www.ups.com/track?loc=en_US&tracknum=1Z999",
            },
          ],
        },
      ],
    });

    await expect(getCustomerOrder("99")).resolves.toMatchObject({
      id: "99",
      lineItems: [{ title: "Rose Dress" }],
      fulfillments: [{ tracking: [{ number: "1Z999" }] }],
    });
    expect(orders.get).toHaveBeenCalledWith("customer@example.com", "99");
  });

  it("returns an explicit unavailable response without fake orders", async () => {
    const { ShopifyAdminUnavailableError } = await import("../lib/shopify");
    orders.list.mockRejectedValue(
      new ShopifyAdminUnavailableError(
        "The Shopify connector does not provide Admin API query capability",
      ),
    );
    await expect(listCustomerOrders()).rejects.toMatchObject({
      status: 503,
      data: { code: "SHOPIFY_ADMIN_UNAVAILABLE" },
    });
  });

  it("requires a verified Clerk primary email before lookup", async () => {
    auth.getUser.mockResolvedValueOnce({
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "customer@example.com",
          verification: { status: "unverified" },
        },
      ],
    });
    await expect(listCustomerOrders()).rejects.toMatchObject({
      status: 422,
      data: { code: "PRIMARY_EMAIL_VERIFICATION_REQUIRED" },
    });
    expect(orders.list).not.toHaveBeenCalled();
  });

  it("requires a verified Clerk primary email before an order detail lookup", async () => {
    auth.getUser.mockResolvedValueOnce({
      primaryEmailAddressId: "email_primary",
      emailAddresses: [
        {
          id: "email_primary",
          emailAddress: "customer@example.com",
          verification: { status: "unverified" },
        },
      ],
    });
    await expect(getCustomerOrder("99")).rejects.toMatchObject({
      status: 422,
      data: { code: "PRIMARY_EMAIL_VERIFICATION_REQUIRED" },
    });
    expect(orders.get).not.toHaveBeenCalled();
  });
});