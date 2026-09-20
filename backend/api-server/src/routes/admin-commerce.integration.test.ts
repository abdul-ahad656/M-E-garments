import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

const auth = vi.hoisted(() => ({
  userId: null as string | null,
  role: null as string | null,
  getUser: vi.fn(),
}));

const commerce = vi.hoisted(() => {
  class CommerceValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CommerceValidationError";
    }
  }
  class CommerceNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CommerceNotFoundError";
    }
  }
  return {
    CommerceValidationError,
    CommerceNotFoundError,
    listAdminProducts: vi.fn(),
    createAdminProduct: vi.fn(),
    getAdminProduct: vi.fn(),
    updateAdminProduct: vi.fn(),
    listAdminInventory: vi.fn(),
    adjustAdminInventory: vi.fn(),
  };
});

const orders = vi.hoisted(() => ({
  listAdminOrders: vi.fn(),
  getAdminOrder: vi.fn(),
  fulfillAdminOrder: vi.fn(),
  refundAdminOrder: vi.fn(),
  cancelAdminOrder: vi.fn(),
  markAdminOrderPaid: vi.fn(),
}));

const imageGeneration = vi.hoisted(() => ({
  generateGarmentImageFile: vi.fn(),
  ImageGenerationNotConfiguredError: class ImageGenerationNotConfiguredError extends Error {
    constructor(message = "Gemini image generation is not configured") {
      super(message);
      this.name = "ImageGenerationNotConfiguredError";
    }
  },
  ImageGenerationValidationError: class ImageGenerationValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ImageGenerationValidationError";
    }
  },
  ImageGenerationError: class ImageGenerationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ImageGenerationError";
    }
  },
}));

const r2 = vi.hoisted(() => ({
  uploadProductImages: vi.fn(),
  R2_MAX_FILES: 20,
  R2_MAX_FILE_BYTES: 10 * 1024 * 1024,
  R2NotConfiguredError: class R2NotConfiguredError extends Error {
    constructor(message = "Cloudflare R2 is not configured") {
      super(message);
      this.name = "R2NotConfiguredError";
    }
  },
  R2UploadError: class R2UploadError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "R2UploadError";
    }
  },
  R2ValidationError: class R2ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "R2ValidationError";
    }
  },
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

vi.mock("../lib/commerce-repository", () => commerce);
vi.mock("../lib/order-repository", () => orders);
vi.mock("../lib/image-generation", () => imageGeneration);
vi.mock("../lib/r2", () => r2);
vi.mock("../lib/admin-repository", () => ({
  listPolicies: vi.fn(),
  savePolicy: vi.fn(),
  recordCatalogSync: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  recordStaffAccessChange: vi.fn(),
}));

import app from "../app";

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
          id: "11111111-1111-1111-1111-111111111111",
          handle: "tee",
          title: "Tee",
          status: "ACTIVE",
          productType: "Tops",
          tags: [],
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
      id: "22222222-2222-2222-2222-222222222222",
      handle: "tee",
      title: "Tee",
      descriptionHtml: "",
      status: "DRAFT",
      productType: "",
      tags: [],
      options: [{ id: "1", name: "Size", values: ["S"] }],
      variants: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          title: "S",
          sku: null,
          price: "20.00",
          compareAtPrice: null,
          inventoryItemId: "33333333-3333-3333-3333-333333333333",
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

  it("maps validation errors to 422", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    orders.fulfillAdminOrder.mockRejectedValue(
      new commerce.CommerceValidationError("No fulfillable line items remain"),
    );

    const response = await fetch(`${baseUrl}/api/admin/orders/99/fulfill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("adjusts inventory for staff", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    commerce.adjustAdminInventory.mockResolvedValue({
      inventoryItemId: "33333333-3333-3333-3333-333333333333",
      variantId: "33333333-3333-3333-3333-333333333333",
      productId: "22222222-2222-2222-2222-222222222222",
      productTitle: "Tee",
      variantTitle: "S",
      sku: "TEE-S",
      locationId: "default",
      locationName: "Default",
      available: 5,
    });

    const response = await fetch(`${baseUrl}/api/admin/inventory/adjust`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inventoryItemId: "33333333-3333-3333-3333-333333333333",
        delta: 2,
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ available: 5 });
  });

  it("returns 503 when R2 is not configured for media upload", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    r2.uploadProductImages.mockRejectedValue(
      new r2.R2NotConfiguredError(
        "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
      ),
    );

    const form = new FormData();
    form.append(
      "files",
      new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
      "shirt.jpg",
    );

    const response = await fetch(`${baseUrl}/api/admin/media/upload`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "R2_NOT_CONFIGURED",
    });
  });

  it("rejects invalid media MIME types", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    r2.uploadProductImages.mockRejectedValue(
      new r2.R2ValidationError(
        'Unsupported file type "text/plain". Use JPEG, PNG, WebP, or GIF.',
      ),
    );

    const form = new FormData();
    form.append(
      "files",
      new Blob(["not-an-image"], { type: "text/plain" }),
      "notes.txt",
    );

    const response = await fetch(`${baseUrl}/api/admin/media/upload`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("uploads media files and returns public URLs", async () => {
    auth.userId = "admin_1";
    auth.role = "admin";
    r2.uploadProductImages.mockResolvedValue([
      "https://pub-example.r2.dev/products/abc-shirt.jpg",
    ]);

    const form = new FormData();
    form.append(
      "files",
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/jpeg" }),
      "shirt.jpg",
    );

    const response = await fetch(`${baseUrl}/api/admin/media/upload`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      urls: ["https://pub-example.r2.dev/products/abc-shirt.jpg"],
    });
    expect(r2.uploadProductImages).toHaveBeenCalledOnce();
  });

  it("returns 503 when Gemini is not configured for generation", async () => {
    auth.userId = "staff_1";
    auth.role = "staff";
    imageGeneration.generateGarmentImageFile.mockRejectedValue(
      new imageGeneration.ImageGenerationNotConfiguredError(
        "Gemini image generation is not configured. Set GEMINI_API_KEY.",
      ),
    );

    const form = new FormData();
    form.append(
      "garment",
      new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
      "shirt.jpg",
    );

    const response = await fetch(`${baseUrl}/api/admin/media/generate`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "GEMINI_NOT_CONFIGURED",
    });
    expect(r2.uploadProductImages).not.toHaveBeenCalled();
  });

  it("generates an image, uploads it through R2, and returns the public URL", async () => {
    auth.userId = "admin_1";
    auth.role = "admin";
    imageGeneration.generateGarmentImageFile.mockResolvedValue({
      buffer: Buffer.from([9, 8, 7]),
      mimetype: "image/png",
      originalname: "generated-garment.png",
      size: 3,
    });
    r2.uploadProductImages.mockResolvedValue([
      "https://pub-example.r2.dev/products/abc-generated-garment.png",
    ]);

    const form = new FormData();
    form.append(
      "garment",
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/jpeg" }),
      "shirt.jpg",
    );
    form.append("age", "2 to 4 years old");
    form.append("gender", "a realistic toddler");

    const response = await fetch(`${baseUrl}/api/admin/media/generate`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      urls: ["https://pub-example.r2.dev/products/abc-generated-garment.png"],
    });
    expect(imageGeneration.generateGarmentImageFile).toHaveBeenCalledOnce();
    expect(r2.uploadProductImages).toHaveBeenCalledOnce();
  });
});
