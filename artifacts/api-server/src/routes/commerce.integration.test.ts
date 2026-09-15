import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const shopify = vi.hoisted(() => {
  class ShopifyInputError extends Error {}
  return {
    ShopifyInputError,
    isShopifyConfigured: vi.fn(() => true),
    searchShopifyProducts: vi.fn(),
    getShopifyProduct: vi.fn(),
    createShopifyCart: vi.fn(),
    getShopifyCart: vi.fn(),
    addShopifyCartLine: vi.fn(),
    updateShopifyCartLine: vi.fn(),
    removeShopifyCartLine: vi.fn(),
    shopifyStorefrontQuery: vi.fn(),
    mapStorefrontProduct: vi.fn((value) => value),
    STOREFRONT_PRODUCT_FIELDS: "",
  };
});

const openai = vi.hoisted(() => ({
  listModels: vi.fn(),
  createCompletion: vi.fn(),
}));

vi.mock("../lib/shopify", () => shopify);
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
  id: "gid://shopify/Product/1",
  handle: "blue-party-dress",
  title: "Blue Party Dress",
  description: "A catalog product",
  image: null,
  price: { amount: "24.00", currencyCode: "USD" },
  compareAtPrice: null,
  availableForSale: true,
  sizes: ["4Y"],
  badges: ["new"],
};

const unavailableProduct = {
  ...product,
  id: "gid://shopify/Product/2",
  handle: "sold-out-dress",
  title: "Sold Out Dress",
  availableForSale: false,
};

const cart = {
  id: "gid://shopify/Cart/cart-1",
  checkoutUrl: "https://checkout.shopify.com/cart/cart-1",
  totalQuantity: 1,
  lines: [
    {
      id: "gid://shopify/CartLine/line-1",
      quantity: 1,
      merchandise: {
        id: "gid://shopify/ProductVariant/variant-1",
        title: "4Y",
        price: { amount: "24.00", currencyCode: "USD" },
        compareAtPrice: null,
        image: null,
        selectedOptions: [{ name: "Size", value: "4Y" }],
        product: { handle: product.handle, title: product.title },
      },
    },
  ],
  cost: {
    subtotalAmount: { amount: "24.00", currencyCode: "USD" },
    totalAmount: { amount: "24.00", currencyCode: "USD" },
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
  process.env.SHOPIFY_SHOP_DOMAIN = "store.example.com";
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN = "storefront-token";
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
  shopify.isShopifyConfigured.mockReturnValue(true);
  openai.listModels.mockResolvedValue({ data: [{ id: "gpt-4o-mini" }] });
  openai.createCompletion.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ query: "dress" }) } }],
  });
});

describe("generated storefront client and validated server responses", () => {
  it("returns a contract-shaped 404 for a missing product", async () => {
    shopify.getShopifyProduct.mockResolvedValue(null);

    await expect(getProduct("missing-product")).rejects.toMatchObject({
      status: 404,
      data: { code: "PRODUCT_NOT_FOUND" },
    });
  });

  it("accepts an empty live catalog without inventing products", async () => {
    shopify.searchShopifyProducts.mockResolvedValue([]);

    const response = await searchProducts({ query: "anything" });

    expect(SearchProductsResponse.parse(response)).toEqual({ products: [], total: 0 });
  });

  it("creates, reads, adds, updates, and removes cart lines with checkout URLs", async () => {
    shopify.createShopifyCart.mockResolvedValue(cart);
    shopify.getShopifyCart.mockResolvedValue(cart);
    shopify.addShopifyCartLine.mockResolvedValue(cart);
    shopify.updateShopifyCartLine.mockResolvedValue(cart);
    shopify.removeShopifyCartLine.mockResolvedValue({ ...cart, totalQuantity: 0, lines: [] });

    const created = await createCart({ merchandiseId: "variant-1", quantity: 1 });
    const fetched = await getCart({ cartId: cart.id });
    const added = await addCartLine({
      cartId: cart.id,
      merchandiseId: "variant-1",
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

    expect(CreateCartResponse.parse(created).checkoutUrl).toBe(cart.checkoutUrl);
    expect(GetCartResponse.parse(fetched).checkoutUrl).toMatch(/^https:\/\//);
    expect(AddCartLineResponse.parse(added).lines).toHaveLength(1);
    expect(UpdateCartLineResponse.parse(updated).totalQuantity).toBe(1);
    expect(RemoveCartLineResponse.parse(removed).lines).toEqual([]);
  });

  it("reports stale cart IDs honestly", async () => {
    shopify.getShopifyCart.mockResolvedValue(null);

    await expect(getCart({ cartId: "stale-cart" })).rejects.toMatchObject({
      status: 404,
      data: { code: "CART_NOT_FOUND" },
    });
  });

  it("rejects a malformed Shopify cart before it reaches the generated client", async () => {
    shopify.createShopifyCart.mockResolvedValue({ ...cart, checkoutUrl: "not-a-url" });

    await expect(createCart({ merchandiseId: "variant-1" })).rejects.toMatchObject({
      status: 503,
      data: { code: "SHOPIFY_UNAVAILABLE" },
    });
  });

  it("returns the documented unavailable response when Shopify times out", async () => {
    shopify.createShopifyCart.mockRejectedValue(
      new DOMException("The operation timed out", "TimeoutError"),
    );

    await expect(createCart({ merchandiseId: "variant-1" })).rejects.toMatchObject({
      status: 503,
      data: {
        code: "SHOPIFY_UNAVAILABLE",
        error: "The Shopify cart is temporarily unavailable.",
      },
    });
  });

  it("maps Shopify cart user errors to a safe buyer-facing response", async () => {
    shopify.createShopifyCart.mockRejectedValue(
      new shopify.ShopifyInputError("Internal Shopify validation details"),
    );

    await expect(createCart({ merchandiseId: "variant-1" })).rejects.toMatchObject({
      status: 400,
      data: {
        code: "INVALID_CART_LINE",
        error: "Invalid cart line.",
      },
    });
  });
});

describe("grounded shopping assistant", () => {
  it("returns only available, in-budget products supplied by Shopify", async () => {
    const expensiveProduct = {
      ...product,
      id: "gid://shopify/Product/3",
      handle: "expensive-dress",
      price: { amount: "99.00", currencyCode: "USD" },
    };
    shopify.searchShopifyProducts.mockResolvedValue([
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
    expect(shopify.searchShopifyProducts).toHaveBeenCalledWith("dress", 12);
  });

  it("returns an honest empty result when Shopify has no matches", async () => {
    shopify.searchShopifyProducts.mockResolvedValue([]);

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
    expect(shopify.searchShopifyProducts).not.toHaveBeenCalled();
  });
});