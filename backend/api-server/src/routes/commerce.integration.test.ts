import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
    isCommerceReady: vi.fn(() => Promise.resolve(true)),
    searchProducts: vi.fn(),
    getProductByHandle: vi.fn(),
    listActiveProductsForHome: vi.fn(),
    getCatalogHealth: vi.fn(),
  };
});

const carts = vi.hoisted(() => ({
  createCart: vi.fn(),
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
}));

const openai = vi.hoisted(() => ({
  listModels: vi.fn(),
  createCompletion: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null, sessionClaims: {} }),
  clerkClient: {
    users: {
      getUser: vi.fn(),
    },
  },
}));
vi.mock("../lib/commerce-repository", () => commerce);
vi.mock("../lib/cart-repository", () => carts);
vi.mock("openai", () => ({
  default: class OpenAI {
    static APIError = class APIError extends Error {
      status?: number;
    };
    models = { list: openai.listModels };
    chat = { completions: { create: openai.createCompletion } };
  },
}));

import {
  addCartLine,
  createCart,
  getCart,
  getProduct,
  queryShoppingAssistant,
  removeCartLine,
  searchProducts,
  setBaseUrl,
  updateCartLine,
} from "@workspace/api-client-react";
import {
  AddCartLineResponse,
  CreateCartResponse,
  GetCartResponse,
  QueryShoppingAssistantResponse,
  RemoveCartLineResponse,
  SearchProductsResponse,
  UpdateCartLineResponse,
} from "@workspace/api-zod";
import app from "../app";

const product = {
  id: "11111111-1111-1111-1111-111111111111",
  handle: "blue-party-dress",
  title: "Blue Party Dress",
  description: "A catalog product",
  image: null,
  price: { amount: "24.00", currencyCode: "PKR" },
  compareAtPrice: null,
  availableForSale: true,
  sizes: ["4Y"],
  badges: ["new"],
};

const unavailableProduct = {
  ...product,
  id: "22222222-2222-2222-2222-222222222222",
  handle: "sold-out-dress",
  title: "Sold Out Dress",
  availableForSale: false,
};

const cart = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  totalQuantity: 1,
  lines: [
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      quantity: 1,
      merchandise: {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        title: "4Y",
        price: { amount: "24.00", currencyCode: "PKR" },
        compareAtPrice: null,
        image: null,
        selectedOptions: [{ name: "Size", value: "4Y" }],
        product: { handle: product.handle, title: product.title },
      },
    },
  ],
  cost: {
    subtotalAmount: { amount: "24.00", currencyCode: "PKR" },
    totalAmount: { amount: "24.00", currencyCode: "PKR" },
  },
};

let server: Server;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind");
  setBaseUrl(`http://127.0.0.1:${address.port}`);
  process.env.OPENAI_API_KEY = "test-only-key";
});

afterAll(async () => {
  setBaseUrl(null);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_PROVIDER_READY = "true";
  commerce.isCommerceReady.mockResolvedValue(true);
  openai.listModels.mockResolvedValue({ data: [{ id: "gpt-4o-mini" }] });
  openai.createCompletion.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ query: "dress" }) } }],
  });
});

describe("generated storefront client and validated server responses", () => {
  it("returns a contract-shaped 404 for a missing product", async () => {
    commerce.getProductByHandle.mockResolvedValue(null);

    await expect(getProduct("missing-product")).rejects.toMatchObject({
      status: 404,
      data: { code: "PRODUCT_NOT_FOUND" },
    });
  });

  it("accepts an empty live catalog without inventing products", async () => {
    commerce.searchProducts.mockResolvedValue([]);

    const response = await searchProducts({ query: "anything" });

    expect(SearchProductsResponse.parse(response)).toEqual({ products: [], total: 0 });
  });

  it("creates, reads, adds, updates, and removes cart lines", async () => {
    carts.createCart.mockResolvedValue(cart);
    carts.getCart.mockResolvedValue(cart);
    carts.addCartLine.mockResolvedValue(cart);
    carts.updateCartLine.mockResolvedValue(cart);
    carts.removeCartLine.mockResolvedValue({ ...cart, totalQuantity: 0, lines: [] });

    const created = await createCart({ merchandiseId: "cccccccc-cccc-cccc-cccc-cccccccccccc", quantity: 1 });
    const fetched = await getCart({ cartId: cart.id });
    const added = await addCartLine({
      cartId: cart.id,
      merchandiseId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      quantity: 1,
    });
    const updated = await updateCartLine({
      cartId: cart.id,
      lineId: cart.lines[0]!.id,
      quantity: 1,
    });
    const removed = await removeCartLine({
      cartId: cart.id,
      lineId: cart.lines[0]!.id,
    });

    expect(CreateCartResponse.parse(created).id).toBe(cart.id);
    expect(GetCartResponse.parse(fetched).totalQuantity).toBe(1);
    expect(AddCartLineResponse.parse(added).lines).toHaveLength(1);
    expect(UpdateCartLineResponse.parse(updated).totalQuantity).toBe(1);
    expect(RemoveCartLineResponse.parse(removed).lines).toEqual([]);
  });

  it("reports stale cart IDs honestly", async () => {
    carts.getCart.mockResolvedValue(null);

    await expect(getCart({ cartId: "stale-cart" })).rejects.toMatchObject({
      status: 404,
      data: { code: "CART_NOT_FOUND" },
    });
  });

  it("returns the documented unavailable response when cart storage fails", async () => {
    carts.createCart.mockRejectedValue(new Error("database timeout"));

    await expect(
      createCart({ merchandiseId: "cccccccc-cccc-cccc-cccc-cccccccccccc" }),
    ).rejects.toMatchObject({
      status: 503,
      data: {
        code: "COMMERCE_UNAVAILABLE",
        error: "The cart is temporarily unavailable.",
      },
    });
  });

  it("maps cart validation errors to a safe buyer-facing response", async () => {
    carts.createCart.mockRejectedValue(
      new commerce.CommerceValidationError("Variant is unavailable"),
    );

    await expect(
      createCart({ merchandiseId: "cccccccc-cccc-cccc-cccc-cccccccccccc" }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        code: "INVALID_CART_LINE",
        error: "Variant is unavailable",
      },
    });
  });
});

describe("grounded shopping assistant", () => {
  it("returns only available, in-budget products from the catalog", async () => {
    const expensiveProduct = {
      ...product,
      id: "33333333-3333-3333-3333-333333333333",
      handle: "expensive-dress",
      price: { amount: "99.00", currencyCode: "PKR" },
    };
    commerce.searchProducts.mockResolvedValue([
      product,
      unavailableProduct,
      expensiveProduct,
    ]);
    openai.createCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ query: "dress", maxPrice: 30 }),
          },
        },
      ],
    });

    const response = await queryShoppingAssistant({
      message: "Find a party dress under $30",
      conversationId: "conversation-1",
    });

    expect(QueryShoppingAssistantResponse.parse(response).products).toEqual([product]);
    expect(response.products.every((item) => item.id === product.id)).toBe(true);
    expect(commerce.searchProducts).toHaveBeenCalledWith(["dress"], 12);
  });

  it("returns an honest empty result when the catalog has no matches", async () => {
    commerce.searchProducts.mockResolvedValue([]);

    const response = await queryShoppingAssistant({ message: "Find a green jacket" });

    expect(response.products).toEqual([]);
    expect(response.message).toContain("couldn't find");
  });

  it("does not return recommendations when the AI provider fails", async () => {
    openai.createCompletion.mockRejectedValue(new Error("provider unavailable"));

    await expect(
      queryShoppingAssistant({ message: "Recommend something" }),
    ).rejects.toMatchObject({
      status: 503,
      data: {
        code: "ASSISTANT_UNAVAILABLE",
        error: expect.stringContaining("No recommendation was generated"),
      },
    });
    expect(commerce.searchProducts).not.toHaveBeenCalled();
  });
});
