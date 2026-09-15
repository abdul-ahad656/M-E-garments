const API_VERSION = "2026-04";
const CONFIG_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 10_000;

type ShopifyStorefrontConfig = {
  shopDomain: string;
  storefrontAccessToken: string;
};

let cachedConfig:
  | { value: ShopifyStorefrontConfig; expiresAt: number }
  | undefined;

export class ShopifyInputError extends Error {}
export class ShopifyAdminUnavailableError extends Error {}
export class ShopifyOrderNotFoundError extends Error {}

export type StorefrontProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: {
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
  sizes: string[];
  badges: string[];
};

export type ProductDetail = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  availableForSale: boolean;
  images: Array<NonNullable<StorefrontProduct["image"]>>;
  options: Array<{ id: string; name: string; values: string[] }>;
  variants: Array<{
    id: string;
    title: string;
    availableForSale: boolean;
    quantityAvailable: number | null;
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
    image: StorefrontProduct["image"];
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
};

export type StorefrontCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: Array<{
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      title: string;
      price: { amount: string; currencyCode: string };
      compareAtPrice: { amount: string; currencyCode: string } | null;
      image: StorefrontProduct["image"];
      selectedOptions: Array<{ name: string; value: string }>;
      product: { handle: string; title: string };
    };
  }>;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
};

export type ShopifyProductNode = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  featuredImage: {
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  compareAtPriceRange: {
    minVariantPrice: { amount: string; currencyCode: string } | null;
  };
  options: Array<{ name: string; values: string[] }>;
  tags: string[];
};

export type CatalogHealth = {
  checkedAt: string;
  totalProducts: number;
  availableProducts: number;
  issues: Array<{
    productId: string;
    handle: string;
    title: string;
    problems: string[];
  }>;
};

export const STOREFRONT_PRODUCT_FIELDS = `
  id handle title description availableForSale tags
  featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
  compareAtPriceRange { minVariantPrice { amount currencyCode } }
  options { name values }
`;

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_SHOP_DOMAIN?.trim() &&
      process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim(),
  );
}

function isShopifyAdminConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_SHOP_DOMAIN?.trim() &&
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim(),
  );
}

async function getShopifyStorefrontConfig(options: {
  forceRefresh?: boolean;
} = {}): Promise<ShopifyStorefrontConfig> {
  if (
    cachedConfig &&
    !options.forceRefresh &&
    Date.now() < cachedConfig.expiresAt
  ) {
    return cachedConfig.value;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  const storefrontAccessToken =
    process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();
  if (!shopDomain || !storefrontAccessToken) {
    throw new Error(
      "Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN",
    );
  }

  cachedConfig = {
    value: {
      shopDomain,
      storefrontAccessToken,
    },
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  };
  return cachedConfig.value;
}

async function shopifyAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!isShopifyAdminConfigured()) {
    throw new ShopifyAdminUnavailableError(
      "Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN",
    );
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN!.trim();
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!.trim();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Shopify-Access-Token", adminToken);

  return fetch(`https://${shopDomain}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

export type ShopifyOrderReference = {
  id: string;
  name: string;
  processedAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPrice: { amount: string; currencyCode: string };
};

export type ShopifyOrderDetail = ShopifyOrderReference & {
  lineItems: Array<{
    id: string;
    title: string;
    variantTitle: string | null;
    quantity: number;
    price: { amount: string; currencyCode: string };
  }>;
  fulfillments: Array<{
    id: string;
    status: string;
    tracking: Array<{
      company: string | null;
      number: string | null;
      url: string;
    }>;
  }>;
};

type ShopifyAdminCustomer = {
  id: number | string;
  email?: string | null;
};

async function findExactShopifyCustomer(email: string): Promise<ShopifyAdminCustomer | null> {
  const customerSearch = new URLSearchParams({
    query: `email:${email}`,
    limit: "50",
    fields: "id,email",
  });
  const response = await shopifyAdminFetch(
    `/admin/api/${API_VERSION}/customers/search.json?${customerSearch.toString()}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new ShopifyAdminUnavailableError(
      `Shopify Admin request failed with ${response.status}`,
    );
  }
  const payload = (await response.json()) as {
    customers?: ShopifyAdminCustomer[];
  };
  const exactMatches = (payload.customers ?? []).filter(
    (customer) =>
      typeof customer.email === "string" &&
      customer.email.toLowerCase() === email.toLowerCase(),
  );
  if (exactMatches.length === 0) return null;
  if (exactMatches.length > 1) {
    throw new ShopifyAdminUnavailableError(
      "Shopify returned ambiguous customer matches",
    );
  }
  return exactMatches[0]!;
}

export async function getShopifyOrderReferences(
  email: string,
): Promise<ShopifyOrderReference[]> {
  const adminRequest = async <T>(path: string): Promise<T> => {
    const response = await shopifyAdminFetch(path, { method: "GET" });
    if (!response.ok) {
      throw new ShopifyAdminUnavailableError(
        `Shopify Admin request failed with ${response.status}`,
      );
    }
    return (await response.json()) as T;
  };

  try {
    const customerSearch = new URLSearchParams({
      query: `email:${email}`,
      limit: "50",
      fields: "id,email",
    });
    const customers = await adminRequest<{
      customers?: Array<{ id: number | string; email?: string | null }>;
    }>(
      `/admin/api/${API_VERSION}/customers/search.json?${customerSearch.toString()}`,
    );
    const exactMatches = (customers.customers ?? []).filter(
      (customer) =>
        typeof customer.email === "string" &&
        customer.email.toLowerCase() === email.toLowerCase(),
    );
    if (exactMatches.length === 0) return [];
    if (exactMatches.length > 1) {
      throw new ShopifyAdminUnavailableError(
        "Shopify returned ambiguous customer matches",
      );
    }
    const customerId = exactMatches[0]!.id;

    const orderQuery = new URLSearchParams({
      status: "any",
      limit: "50",
      fields:
        "id,name,processed_at,financial_status,fulfillment_status,total_price,currency,customer",
    });
    const result = await adminRequest<{
      orders?: Array<{
        id: number | string;
        name: string;
        processed_at: string;
        financial_status?: string | null;
        fulfillment_status?: string | null;
        total_price: string;
        currency: string;
        customer?: { id?: number | string } | null;
      }>;
    }>(
      `/admin/api/${API_VERSION}/customers/${encodeURIComponent(
        String(customerId),
      )}/orders.json?${orderQuery.toString()}`,
    );

    if (!result.orders) {
      throw new ShopifyAdminUnavailableError(
        "Shopify Admin order lookup returned an invalid response",
      );
    }
    if (
      result.orders.some(
        (order) =>
          order.customer?.id == null ||
          String(order.customer.id) !== String(customerId),
      )
    ) {
      throw new ShopifyAdminUnavailableError(
        "Shopify returned an order owned by a different customer",
      );
    }
    return result.orders.map((order) => ({
      id: String(order.id),
      name: order.name,
      processedAt: order.processed_at,
      displayFinancialStatus: order.financial_status ?? null,
      displayFulfillmentStatus: order.fulfillment_status ?? null,
      totalPrice: {
        amount: order.total_price,
        currencyCode: order.currency,
      },
    }));
  } catch (error) {
    if (error instanceof ShopifyAdminUnavailableError) throw error;
    throw new ShopifyAdminUnavailableError(
      "Shopify Admin order lookup is unavailable",
    );
  }
}

export async function getShopifyOrderDetail(
  email: string,
  orderId: string,
): Promise<ShopifyOrderDetail> {
  try {
    const customer = await findExactShopifyCustomer(email);
    if (!customer) {
      throw new ShopifyOrderNotFoundError("Order not found");
    }

    const fields = [
      "id",
      "name",
      "processed_at",
      "financial_status",
      "fulfillment_status",
      "total_price",
      "currency",
      "customer",
      "line_items",
      "fulfillments",
    ].join(",");
    const response = await shopifyAdminFetch(
      `/admin/api/${API_VERSION}/orders/${encodeURIComponent(orderId)}.json?fields=${encodeURIComponent(fields)}`,
      { method: "GET" },
    );
    if (response.status === 404) {
      throw new ShopifyOrderNotFoundError("Order not found");
    }
    if (!response.ok) {
      throw new ShopifyAdminUnavailableError(
        `Shopify Admin request failed with ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      order?: {
        id: number | string;
        name: string;
        processed_at: string;
        financial_status?: string | null;
        fulfillment_status?: string | null;
        total_price: string;
        currency: string;
        customer?: { id?: number | string } | null;
        line_items?: Array<{
          id: number | string;
          title: string;
          variant_title?: string | null;
          quantity: number;
          price: string;
        }>;
        fulfillments?: Array<{
          id: number | string;
          status?: string | null;
          tracking_company?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          tracking_numbers?: string[] | null;
          tracking_urls?: string[] | null;
        }>;
      };
    };
    const order = payload.order;
    if (
      !order ||
      order.customer?.id == null ||
      String(order.customer.id) !== String(customer.id)
    ) {
      throw new ShopifyOrderNotFoundError("Order not found");
    }

    return {
      id: String(order.id),
      name: order.name,
      processedAt: order.processed_at,
      displayFinancialStatus: order.financial_status ?? null,
      displayFulfillmentStatus: order.fulfillment_status ?? null,
      totalPrice: { amount: order.total_price, currencyCode: order.currency },
      lineItems: (order.line_items ?? []).map((item) => ({
        id: String(item.id),
        title: item.title,
        variantTitle: item.variant_title ?? null,
        quantity: item.quantity,
        price: { amount: item.price, currencyCode: order.currency },
      })),
      fulfillments: (order.fulfillments ?? []).map((fulfillment) => {
        const urls = fulfillment.tracking_urls?.length
          ? fulfillment.tracking_urls
          : fulfillment.tracking_url
            ? [fulfillment.tracking_url]
            : [];
        const numbers = fulfillment.tracking_numbers?.length
          ? fulfillment.tracking_numbers
          : fulfillment.tracking_number
            ? [fulfillment.tracking_number]
            : [];
        return {
          id: String(fulfillment.id),
          status: fulfillment.status ?? "unknown",
          tracking: urls.flatMap((url, index) => {
            try {
              const parsed = new URL(url);
              if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
              return [{
                company: fulfillment.tracking_company ?? null,
                number: numbers[index] ?? fulfillment.tracking_number ?? null,
                url: parsed.toString(),
              }];
            } catch {
              return [];
            }
          }),
        };
      }),
    };
  } catch (error) {
    if (
      error instanceof ShopifyAdminUnavailableError ||
      error instanceof ShopifyOrderNotFoundError
    ) {
      throw error;
    }
    throw new ShopifyAdminUnavailableError(
      "Shopify Admin order lookup is unavailable",
    );
  }
}

/** @deprecated Use getShopifyOrderReferences. */
export const listShopifyOrdersByEmail = getShopifyOrderReferences;

export async function shopifyStorefrontQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const config = await getShopifyStorefrontConfig();
  const response = await fetch(
    `https://${config.shopDomain}/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );

  if (retryOnUnauthorized && (response.status === 401 || response.status === 403)) {
    cachedConfig = undefined;
    await getShopifyStorefrontConfig({ forceRefresh: true });
    return shopifyStorefrontQuery<T>(query, variables, false);
  }

  const text = await response.text();
  const payload = text
    ? (JSON.parse(text) as { data?: T; errors?: Array<{ message: string }> })
    : {};
  if (!response.ok || payload.errors?.length || !payload.data) {
    throw new Error(
      `Shopify Storefront API error (${response.status}): ${JSON.stringify(
        payload.errors ?? payload,
      )}`,
    );
  }
  return payload.data;
}

export function mapStorefrontProduct(
  node: ShopifyProductNode,
): StorefrontProduct {
  const sizeOption = node.options.find(
    (option) => option.name.toLowerCase() === "size",
  );
  const compareAt = node.compareAtPriceRange.minVariantPrice;
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description,
    image: node.featuredImage,
    price: node.priceRange.minVariantPrice,
    compareAtPrice:
      compareAt && Number(compareAt.amount) > 0 ? compareAt : null,
    availableForSale: node.availableForSale,
    sizes: sizeOption?.values ?? [],
    badges: node.tags.filter((tag) =>
      ["new", "best_seller", "sale"].includes(tag.toLowerCase()),
    ),
  };
}

export async function searchShopifyProducts(
  query: string,
  limit: number,
): Promise<StorefrontProduct[]> {
  const result = await shopifyStorefrontQuery<{
    products: { nodes: ShopifyProductNode[] };
  }>(
    `query SearchProducts($first: Int!, $query: String) {
      products(first: $first, query: $query) {
        nodes { ${STOREFRONT_PRODUCT_FIELDS} }
      }
    }`,
    { first: limit, query: query || null },
  );

  return result.products.nodes.map(mapStorefrontProduct);
}

export async function getShopifyCatalogHealth(): Promise<CatalogHealth> {
  const products: ShopifyProductNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const result: {
      products: {
        nodes: ShopifyProductNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopifyStorefrontQuery(
      `query CatalogHealth($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          nodes { ${STOREFRONT_PRODUCT_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { first: 100, after: cursor },
    );
    products.push(...result.products.nodes);
    hasNextPage = result.products.pageInfo.hasNextPage;
    cursor = result.products.pageInfo.endCursor;
    if (hasNextPage && !cursor) throw new Error("Shopify catalog pagination cursor is missing");
  }
  const issues = products.flatMap((product) => {
    const problems: string[] = [];
    if (!product.title.trim()) problems.push("Missing title");
    if (!product.description.trim()) problems.push("Missing description");
    if (!product.featuredImage) problems.push("Missing featured image");
    if (!product.availableForSale) problems.push("No variants available for sale");
    if (!product.options.some((option) => option.name.toLowerCase() === "size")) {
      problems.push("Missing size option");
    }
    if (Number(product.priceRange.minVariantPrice.amount) <= 0) {
      problems.push("Missing or invalid price");
    }
    return problems.length
      ? [{
          productId: product.id,
          handle: product.handle,
          title: product.title,
          problems,
        }]
      : [];
  });
  return {
    checkedAt: new Date().toISOString(),
    totalProducts: products.length,
    availableProducts: products.filter((product) => product.availableForSale).length,
    issues,
  };
}

const IMAGE_FIELDS = "url altText width height";

const PRODUCT_VARIANT_FIELDS = `
  id title availableForSale quantityAvailable
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  image { ${IMAGE_FIELDS} }
  selectedOptions { name value }
`;

const CART_FIELDS = `
  id checkoutUrl totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 100) {
    nodes {
      id quantity
      merchandise {
        ... on ProductVariant {
          id title
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          image { ${IMAGE_FIELDS} }
          selectedOptions { name value }
          product { handle title }
        }
      }
    }
  }
`;

type ShopifyCartNode = Omit<StorefrontCart, "lines"> & {
  lines: { nodes: StorefrontCart["lines"] };
};

function mapCart(cart: ShopifyCartNode): StorefrontCart {
  return { ...cart, lines: cart.lines.nodes };
}

function assertNoCartErrors(
  errors: Array<{ message: string; field?: string[] }> | undefined,
) {
  if (errors?.length) {
    throw new ShopifyInputError(
      errors.map((error) => error.message).join("; "),
    );
  }
}

export async function getShopifyProduct(
  handle: string,
): Promise<ProductDetail | null> {
  const result = await shopifyStorefrontQuery<{
    product: ProductDetail | null;
  }>(
    `query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        id handle title description descriptionHtml vendor productType availableForSale
        images(first: 12) { nodes { ${IMAGE_FIELDS} } }
        options { id name values }
        variants(first: 100) { nodes { ${PRODUCT_VARIANT_FIELDS} } }
      }
    }`,
    { handle },
  );

  if (!result.product) return null;
  const raw = result.product as ProductDetail & {
    images: { nodes: ProductDetail["images"] };
    variants: { nodes: ProductDetail["variants"] };
  };
  return {
    ...raw,
    images: raw.images.nodes,
    variants: raw.variants.nodes,
  };
}

export async function createShopifyCart(
  merchandiseId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const result = await shopifyStorefrontQuery<{
    cartCreate: {
      cart: ShopifyCartNode | null;
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>(
    `mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }`,
    { input: { lines: [{ merchandiseId, quantity }] } },
  );
  assertNoCartErrors(result.cartCreate.userErrors);
  if (!result.cartCreate.cart) throw new Error("Shopify did not return a cart");
  return mapCart(result.cartCreate.cart);
}

export async function getShopifyCart(
  cartId: string,
): Promise<StorefrontCart | null> {
  const result = await shopifyStorefrontQuery<{
    cart: ShopifyCartNode | null;
  }>(
    `query GetCart($id: ID!) {
      cart(id: $id) { ${CART_FIELDS} }
    }`,
    { id: cartId },
  );
  return result.cart ? mapCart(result.cart) : null;
}

export async function addShopifyCartLine(
  cartId: string,
  merchandiseId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const result = await shopifyStorefrontQuery<{
    cartLinesAdd: {
      cart: ShopifyCartNode | null;
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>(
    `mutation AddCartLine($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }`,
    { cartId, lines: [{ merchandiseId, quantity }] },
  );
  assertNoCartErrors(result.cartLinesAdd.userErrors);
  if (!result.cartLinesAdd.cart) throw new Error("Shopify did not return a cart");
  return mapCart(result.cartLinesAdd.cart);
}

export async function updateShopifyCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const result = await shopifyStorefrontQuery<{
    cartLinesUpdate: {
      cart: ShopifyCartNode | null;
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>(
    `mutation UpdateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }`,
    { cartId, lines: [{ id: lineId, quantity }] },
  );
  assertNoCartErrors(result.cartLinesUpdate.userErrors);
  if (!result.cartLinesUpdate.cart) throw new Error("Shopify did not return a cart");
  return mapCart(result.cartLinesUpdate.cart);
}

export async function removeShopifyCartLine(
  cartId: string,
  lineId: string,
): Promise<StorefrontCart> {
  const result = await shopifyStorefrontQuery<{
    cartLinesRemove: {
      cart: ShopifyCartNode | null;
      userErrors: Array<{ message: string; field?: string[] }>;
    };
  }>(
    `mutation RemoveCartLine($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { ${CART_FIELDS} }
        userErrors { field message }
      }
    }`,
    { cartId, lineIds: [lineId] },
  );
  assertNoCartErrors(result.cartLinesRemove.userErrors);
  if (!result.cartLinesRemove.cart) throw new Error("Shopify did not return a cart");
  return mapCart(result.cartLinesRemove.cart);
}