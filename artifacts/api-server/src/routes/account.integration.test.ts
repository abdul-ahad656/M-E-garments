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
const orders = vi.hoisted(() => ({
  listCustomerOrders: vi.fn(),
  getCustomerOrder: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: auth.userId, sessionClaims: {} }),
  clerkClient: { users: { getUser: auth.getUser } },
}));
vi.mock("../lib/customer-repository", () => repository);
vi.mock("../lib/order-repository", () => orders);
vi.mock("../lib/commerce-repository", () => ({
  CommerceNotFoundError: class CommerceNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CommerceNotFoundError";
    }
  },
}));

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
      productId: "11111111-1111-1111-1111-111111111111",
      productHandle: "dress",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await saveWishlistItem({
      productId: "11111111-1111-1111-1111-111111111111",
      productHandle: "dress",
    });
    expect(repository.saveWishlist).toHaveBeenCalledWith("user_server_123", {
      productId: "11111111-1111-1111-1111-111111111111",
      productHandle: "dress",
    });
  });

  it("deletes wishlist items by productId via the query contract", async () => {
    await deleteWishlistItem({
      productId: "11111111-1111-1111-1111-111111111111",
    });
    expect(repository.deleteWishlist).toHaveBeenCalledWith(
      "user_server_123",
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("lists orders for the authenticated Clerk user", async () => {
    orders.listCustomerOrders.mockResolvedValue([]);
    await listCustomerOrders();
    expect(orders.listCustomerOrders).toHaveBeenCalledWith("user_server_123");
  });

  it("loads one order owned by the authenticated Clerk user", async () => {
    orders.getCustomerOrder.mockResolvedValue({
      id: "99",
      name: "#1001",
      processedAt: "2026-01-01T00:00:00Z",
      displayFinancialStatus: "paid",
      displayFulfillmentStatus: "fulfilled",
      totalPrice: { amount: "24.00", currencyCode: "PKR" },
      lineItems: [
        {
          id: "501",
          title: "Rose Dress",
          variantTitle: "8 / Pink",
          quantity: 1,
          price: { amount: "24.00", currencyCode: "PKR" },
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
    expect(orders.getCustomerOrder).toHaveBeenCalledWith("user_server_123", "99");
  });

  it("returns an explicit unavailable response without fake orders", async () => {
    orders.listCustomerOrders.mockRejectedValue(new Error("database unavailable"));
    await expect(listCustomerOrders()).rejects.toMatchObject({
      status: 503,
      data: { code: "COMMERCE_UNAVAILABLE" },
    });
  });
});
