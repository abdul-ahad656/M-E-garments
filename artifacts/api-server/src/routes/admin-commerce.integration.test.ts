import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

const auth = vi.hoisted(() => ({
  userId: null as string | null,
  role: null as string | null,
  getUser: vi.fn(),
}));

const commerce = vi.hoisted(() => ({
  listAdminProducts: vi.fn(),
  createAdminProduct: vi.fn(),
  getAdminProduct: vi.fn(),
  updateAdminProduct: vi.fn(),
  listAdminInventory: vi.fn(),
  adjustAdminInventory: vi.fn(),
  listAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  fulfillAdminOrder: vi.fn(),
  refundAdminOrder: vi.fn(),
  cancelAdminOrder: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: auth.userId, sessionClaims: {} }),
  clerkClient: {
    users: {
      getUser: auth.getUser,
      getUserList: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
  },
}));

vi.mock("../lib/shopify-admin-commerce", () => commerce);
vi.mock("../lib/admin-repository", () => ({
  listPolicies: vi.fn(),
  savePolicy: vi.fn(),
  recordCatalogSync: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  recordStaffAccessChange: vi.fn(),
}));
vi.mock("../lib/shopify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/shopify")>();
  return {
    ...actual,
    getShopifyCatalogHealth: vi.fn(),
  };
});

import app from "../app";
import { ShopifyAdminUserError } from "../lib/shopify";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Server did not bind");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.userId = null;
  auth.role = null;
  auth.getUser.mockImplementation(async () => ({
    id: auth.userId,
    publicMetadata: { role: auth.role },
    privateMetadata: {},
  }));
});

describe("admin commerce API", () => {
  it("rejects product listing without staff access", async () => {
    const response = await fetch(`${baseUrl}/api/admin/products`);
    expect(response.status).toBe(401);
    expect(commerce.listAdminProducts).not.toHaveBeenCalled();
  });

  it("lists products for staff", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    commerce.listAdminProducts.mockResolvedValue({
      products: [
        {
          id: "gid://shopify/Product/1",
          handle: "tee",
          title: "Tee",
          status: "ACTIVE",
          productType: "Tops",
          totalInventory: 2,
          featuredImageUrl: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    });

    const response = await fetch(`${baseUrl}/api/admin/products`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.products[0].title).toBe("Tee");
  });

  it("creates products and returns 201", async () => {
    auth.userId = "admin_1";
    auth.role = "admin";
    commerce.createAdminProduct.mockResolvedValue({
      id: "gid://shopify/Product/9",
      handle: "tee",
      title: "Tee",
      descriptionHtml: "",
      status: "DRAFT",
      productType: "",
      tags: [],
      options: [{ id: "1", name: "Size", values: ["S"] }],
      variants: [
        {
          id: "gid://shopify/ProductVariant/1",
          title: "S",
          sku: null,
          price: "20.00",
          compareAtPrice: null,
          inventoryItemId: "gid://shopify/InventoryItem/1",
          inventoryQuantity: 0,
          selectedOptions: [{ name: "Size", value: "S" }],
        },
      ],
      images: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Tee",
        variants: [{ optionValues: ["S"], price: "20.00" }],
      }),
    });
    expect(response.status).toBe(201);
  });

  it("maps Shopify user errors to 422", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    commerce.fulfillAdminOrder.mockRejectedValue(
      new ShopifyAdminUserError("No open fulfillment order is available"),
    );

    const response = await fetch(`${baseUrl}/api/admin/orders/99/fulfill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "SHOPIFY_USER_ERROR",
    });
  });

  it("adjusts inventory for staff", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    commerce.adjustAdminInventory.mockResolvedValue({
      inventoryItemId: "gid://shopify/InventoryItem/7",
      variantId: "gid://shopify/ProductVariant/3",
      productId: "gid://shopify/Product/9",
      productTitle: "Tee",
      variantTitle: "S",
      sku: "TEE-S",
      locationId: "gid://shopify/Location/1",
      locationName: "Shop",
      available: 5,
    });

    const response = await fetch(`${baseUrl}/api/admin/inventory/adjust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inventoryItemId: "gid://shopify/InventoryItem/7",
        delta: 2,
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ available: 5 });
  });
});
