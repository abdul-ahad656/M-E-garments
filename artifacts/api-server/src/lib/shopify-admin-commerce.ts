import {
  assertAdminUserErrors,
  shopifyAdminGraphql,
  ShopifyAdminNotFoundError,
  ShopifyAdminUnavailableError,
  ShopifyAdminUserError,
} from "./shopify";

export type AdminPageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

export type AdminProductSummary = {
  id: string;
  handle: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType: string;
  totalInventory: number;
  featuredImageUrl: string | null;
  updatedAt: string;
};

export type AdminProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryItemId: string;
  inventoryQuantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type AdminProductDetail = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType: string;
  tags: string[];
  options: Array<{ id: string; name: string; values: string[] }>;
  variants: AdminProductVariant[];
  images: Array<{
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  }>;
  updatedAt: string;
};

export type AdminProductCreateInput = {
  title: string;
  descriptionHtml?: string;
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType?: string;
  tags?: string[];
  optionName?: string;
  variants: Array<{
    optionValues: string[];
    price: string;
    sku?: string | null;
    compareAtPrice?: string | null;
  }>;
  imageUrls?: string[];
};

export type AdminProductUpdateInput = {
  title?: string;
  descriptionHtml?: string;
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType?: string;
  tags?: string[];
  variants?: Array<{
    id: string;
    price: string;
    compareAtPrice?: string | null;
    sku?: string | null;
  }>;
  imageUrls?: string[];
};

export type AdminInventoryItem = {
  inventoryItemId: string;
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  locationId: string;
  locationName: string;
  available: number;
};

export type AdminOrderSummary = {
  id: string;
  name: string;
  processedAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPrice: { amount: string; currencyCode: string };
  customerEmail: string | null;
  customerName: string | null;
};

export type AdminOrderDetail = AdminOrderSummary & {
  cancelledAt: string | null;
  lineItems: Array<{
    id: string;
    title: string;
    variantTitle: string | null;
    quantity: number;
    fulfillableQuantity: number;
    price: { amount: string; currencyCode: string };
    variantId: string | null;
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
  fulfillmentOrders: Array<{
    id: string;
    status: string;
    lineItems: Array<{ id: string; remainingQuantity: number }>;
  }>;
};

const PRODUCT_DETAIL_FIELDS = `
  id
  handle
  title
  descriptionHtml
  status
  productType
  tags
  updatedAt
  options(first: 10) {
    id
    name
    values
  }
  media(first: 20) {
    nodes {
      ... on MediaImage {
        image { url altText width height }
      }
    }
  }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      price
      compareAtPrice
      inventoryQuantity
      selectedOptions { name value }
      inventoryItem { id }
    }
  }
`;

function normalizeProductId(id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/Product/${id}`;
}

function normalizeOrderId(id: string): string {
  if (id.startsWith("gid://")) return id;
  return `gid://shopify/Order/${id}`;
}

function mapProductDetail(node: {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string | null;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType: string | null;
  tags: string[];
  updatedAt: string;
  options: Array<{ id: string; name: string; values: string[] }>;
  media: {
    nodes: Array<{
      image?: {
        url: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
    }>;
  };
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      sku: string | null;
      price: string;
      compareAtPrice: string | null;
      inventoryQuantity: number | null;
      selectedOptions: Array<{ name: string; value: string }>;
      inventoryItem: { id: string } | null;
    }>;
  };
}): AdminProductDetail {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    descriptionHtml: node.descriptionHtml ?? "",
    status: node.status,
    productType: node.productType ?? "",
    tags: node.tags,
    options: node.options.map((option) => ({
      id: option.id,
      name: option.name,
      values: option.values,
    })),
    variants: node.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventoryItemId: variant.inventoryItem?.id ?? "",
      inventoryQuantity: variant.inventoryQuantity ?? 0,
      selectedOptions: variant.selectedOptions,
    })),
    images: node.media.nodes
      .map((media) => media.image)
      .filter((image): image is NonNullable<typeof image> => Boolean(image))
      .map((image) => ({
        url: image.url,
        altText: image.altText,
        width: image.width,
        height: image.height,
      })),
    updatedAt: node.updatedAt,
  };
}

async function fetchAdminProduct(id: string): Promise<AdminProductDetail> {
  const result = await shopifyAdminGraphql<{
    product: Parameters<typeof mapProductDetail>[0] | null;
  }>(
    `query AdminProduct($id: ID!) {
      product(id: $id) { ${PRODUCT_DETAIL_FIELDS} }
    }`,
    { id: normalizeProductId(id) },
  );
  if (!result.product) {
    throw new ShopifyAdminNotFoundError("Product not found");
  }
  return mapProductDetail(result.product);
}

export async function listAdminProducts(options: {
  cursor?: string;
  query?: string;
} = {}): Promise<{ products: AdminProductSummary[]; pageInfo: AdminPageInfo }> {
  const result = await shopifyAdminGraphql<{
    products: {
      edges: Array<{
        node: {
          id: string;
          handle: string;
          title: string;
          status: "ACTIVE" | "ARCHIVED" | "DRAFT";
          productType: string | null;
          totalInventory: number | null;
          updatedAt: string;
          featuredImage: { url: string } | null;
        };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(
    `query AdminProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id handle title status productType totalInventory updatedAt
            featuredImage { url }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: 25,
      after: options.cursor || null,
      query: options.query || null,
    },
  );

  return {
    products: result.products.edges.map(({ node }) => ({
      id: node.id,
      handle: node.handle,
      title: node.title,
      status: node.status,
      productType: node.productType ?? "",
      totalInventory: node.totalInventory ?? 0,
      featuredImageUrl: node.featuredImage?.url ?? null,
      updatedAt: node.updatedAt,
    })),
    pageInfo: {
      hasNextPage: result.products.pageInfo.hasNextPage,
      endCursor: result.products.pageInfo.endCursor,
    },
  };
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  return fetchAdminProduct(id);
}

async function attachProductImages(productId: string, imageUrls: string[]): Promise<void> {
  if (!imageUrls.length) return;
  const result = await shopifyAdminGraphql<{
    productCreateMedia: {
      media: Array<{ id: string }> | null;
      mediaUserErrors: Array<{ message: string; field?: string[] | null }>;
    };
  }>(
    `mutation AttachMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { ... on MediaImage { id } }
        mediaUserErrors { field message }
      }
    }`,
    {
      productId,
      media: imageUrls.map((originalSource) => ({
        originalSource,
        mediaContentType: "IMAGE",
      })),
    },
  );
  assertAdminUserErrors(result.productCreateMedia.mediaUserErrors);
}

export async function createAdminProduct(
  input: AdminProductCreateInput,
): Promise<AdminProductDetail> {
  const optionName = input.optionName?.trim() || "Size";
  const optionValues = [
    ...new Set(input.variants.flatMap((variant) => variant.optionValues)),
  ];
  if (!optionValues.length) {
    throw new ShopifyAdminUserError("At least one variant option value is required");
  }

  const createResult = await shopifyAdminGraphql<{
    productCreate: {
      product: { id: string } | null;
      userErrors: Array<{ message: string; field?: string[] | null }>;
    };
  }>(
    `mutation CreateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id }
        userErrors { field message }
      }
    }`,
    {
      product: {
        title: input.title,
        descriptionHtml: input.descriptionHtml ?? "",
        status: input.status ?? "DRAFT",
        productType: input.productType ?? "",
        tags: input.tags ?? [],
        productOptions: [
          {
            name: optionName,
            values: optionValues.map((name) => ({ name })),
          },
        ],
      },
    },
  );
  assertAdminUserErrors(createResult.productCreate.userErrors);
  const productId = createResult.productCreate.product?.id;
  if (!productId) {
    throw new ShopifyAdminUnavailableError("Shopify did not return a created product");
  }

  const bulkResult = await shopifyAdminGraphql<{
    productVariantsBulkCreate: {
      productVariants: Array<{ id: string }> | null;
      userErrors: Array<{ message: string; field?: string[] | null }>;
    };
  }>(
    `mutation CreateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: REMOVE_STANDALONE_VARIANT) {
        productVariants { id }
        userErrors { field message }
      }
    }`,
    {
      productId,
      variants: input.variants.map((variant) => ({
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? null,
        optionValues: variant.optionValues.map((value) => ({
          optionName,
          name: value,
        })),
        inventoryItem: variant.sku
          ? { sku: variant.sku }
          : undefined,
      })),
    },
  );
  assertAdminUserErrors(bulkResult.productVariantsBulkCreate.userErrors);

  if (input.imageUrls?.length) {
    await attachProductImages(productId, input.imageUrls);
  }

  return fetchAdminProduct(productId);
}

export async function updateAdminProduct(
  id: string,
  input: AdminProductUpdateInput,
): Promise<AdminProductDetail> {
  const productId = normalizeProductId(id);
  const existing = await fetchAdminProduct(productId);

  if (
    input.title !== undefined ||
    input.descriptionHtml !== undefined ||
    input.status !== undefined ||
    input.productType !== undefined ||
    input.tags !== undefined
  ) {
    const updateResult = await shopifyAdminGraphql<{
      productUpdate: {
        product: { id: string } | null;
        userErrors: Array<{ message: string; field?: string[] | null }>;
      };
    }>(
      `mutation UpdateProduct($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id }
          userErrors { field message }
        }
      }`,
      {
        product: {
          id: productId,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.descriptionHtml !== undefined
            ? { descriptionHtml: input.descriptionHtml }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.productType !== undefined
            ? { productType: input.productType }
            : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
        },
      },
    );
    assertAdminUserErrors(updateResult.productUpdate.userErrors);
  }

  if (input.variants?.length) {
    const bulkResult = await shopifyAdminGraphql<{
      productVariantsBulkUpdate: {
        productVariants: Array<{ id: string }> | null;
        userErrors: Array<{ message: string; field?: string[] | null }>;
      };
    }>(
      `mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field message }
        }
      }`,
      {
        productId,
        variants: input.variants.map((variant) => ({
          id: variant.id,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          inventoryItem:
            variant.sku !== undefined ? { sku: variant.sku } : undefined,
        })),
      },
    );
    assertAdminUserErrors(bulkResult.productVariantsBulkUpdate.userErrors);
  }

  if (input.imageUrls?.length) {
    const existingUrls = new Set(existing.images.map((image) => image.url));
    const newUrls = input.imageUrls.filter((url) => !existingUrls.has(url));
    if (newUrls.length) {
      await attachProductImages(productId, newUrls);
    }
  }

  return fetchAdminProduct(productId);
}

async function getPrimaryLocation(): Promise<{ id: string; name: string }> {
  const result = await shopifyAdminGraphql<{
    locations: {
      edges: Array<{ node: { id: string; name: string; isActive: boolean } }>;
    };
  }>(
    `query PrimaryLocation {
      locations(first: 10, includeInactive: false) {
        edges { node { id name isActive } }
      }
    }`,
  );
  const location = result.locations.edges.find((edge) => edge.node.isActive)?.node
    ?? result.locations.edges[0]?.node;
  if (!location) {
    throw new ShopifyAdminUnavailableError("No Shopify inventory location is configured");
  }
  return { id: location.id, name: location.name };
}

export async function listAdminInventory(options: {
  cursor?: string;
  query?: string;
} = {}): Promise<{
  items: AdminInventoryItem[];
  pageInfo: AdminPageInfo;
  locationId: string;
  locationName: string;
}> {
  const location = await getPrimaryLocation();
  const result = await shopifyAdminGraphql<{
    productVariants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          sku: string | null;
          inventoryQuantity: number | null;
          inventoryItem: { id: string } | null;
          product: { id: string; title: string };
        };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(
    `query AdminInventory($first: Int!, $after: String, $query: String) {
      productVariants(first: $first, after: $after, query: $query) {
        edges {
          node {
            id title sku inventoryQuantity
            inventoryItem { id }
            product { id title }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: 50,
      after: options.cursor || null,
      query: options.query || null,
    },
  );

  return {
    locationId: location.id,
    locationName: location.name,
    pageInfo: {
      hasNextPage: result.productVariants.pageInfo.hasNextPage,
      endCursor: result.productVariants.pageInfo.endCursor,
    },
    items: result.productVariants.edges
      .filter((edge) => edge.node.inventoryItem?.id)
      .map(({ node }) => ({
        inventoryItemId: node.inventoryItem!.id,
        variantId: node.id,
        productId: node.product.id,
        productTitle: node.product.title,
        variantTitle: node.title,
        sku: node.sku,
        locationId: location.id,
        locationName: location.name,
        available: node.inventoryQuantity ?? 0,
      })),
  };
}

export async function adjustAdminInventory(input: {
  inventoryItemId: string;
  delta: number;
}): Promise<AdminInventoryItem> {
  if (input.delta === 0) {
    throw new ShopifyAdminUserError("Inventory delta must be non-zero");
  }
  const location = await getPrimaryLocation();
  const result = await shopifyAdminGraphql<{
    inventoryAdjustQuantities: {
      userErrors: Array<{ message: string; field?: string[] | null }>;
      inventoryAdjustmentGroup: {
        changes: Array<{
          name: string;
          delta: number;
          quantityAfterChange: number | null;
          item: { id: string } | null;
        }>;
      } | null;
    };
  }>(
    `mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        inventoryAdjustmentGroup {
          changes {
            name
            delta
            quantityAfterChange
            item { id }
          }
        }
        userErrors { field message }
      }
    }`,
    {
      input: {
        reason: "correction",
        name: "available",
        changes: [
          {
            inventoryItemId: input.inventoryItemId,
            locationId: location.id,
            delta: input.delta,
          },
        ],
      },
    },
  );
  assertAdminUserErrors(result.inventoryAdjustQuantities.userErrors);

  const change = result.inventoryAdjustQuantities.inventoryAdjustmentGroup?.changes.find(
    (entry) => entry.item?.id === input.inventoryItemId,
  );
  const listed = await listAdminInventory({
    query: `inventory_item_id:${input.inventoryItemId.replace(/\D/g, "")}`,
  });
  const matched = listed.items.find(
    (item) => item.inventoryItemId === input.inventoryItemId,
  );
  if (matched) return matched;

  return {
    inventoryItemId: input.inventoryItemId,
    variantId: "",
    productId: "",
    productTitle: "",
    variantTitle: "",
    sku: null,
    locationId: location.id,
    locationName: location.name,
    available: change?.quantityAfterChange ?? 0,
  };
}

function buildOrderSearchQuery(options: {
  query?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
}): string | null {
  const parts: string[] = [];
  if (options.query?.trim()) parts.push(options.query.trim());
  if (options.financialStatus && options.financialStatus !== "any") {
    parts.push(`financial_status:${options.financialStatus}`);
  }
  if (options.fulfillmentStatus && options.fulfillmentStatus !== "any") {
    parts.push(`fulfillment_status:${options.fulfillmentStatus}`);
  }
  return parts.length ? parts.join(" ") : null;
}

const ADMIN_ORDER_DETAIL_FIELDS = `
  id
  name
  processedAt
  displayFinancialStatus
  displayFulfillmentStatus
  cancelledAt
  totalPriceSet { shopMoney { amount currencyCode } }
  email
  customer { displayName }
  lineItems(first: 100) {
    nodes {
      id
      title
      variantTitle
      quantity
      fulfillableQuantity
      originalUnitPriceSet { shopMoney { amount currencyCode } }
      variant { id }
    }
  }
  fulfillments {
    id
    status
    trackingInfo { company number url }
  }
  fulfillmentOrders(first: 10) {
    nodes {
      id
      status
      lineItems(first: 50) {
        nodes { id remainingQuantity }
      }
    }
  }
`;

function mapAdminOrderDetail(node: {
  id: string;
  name: string;
  processedAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  cancelledAt: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  email: string | null;
  customer: { displayName: string } | null;
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      variantTitle: string | null;
      quantity: number;
      fulfillableQuantity: number;
      originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      variant: { id: string } | null;
    }>;
  };
  fulfillments: Array<{
    id: string;
    status: string;
    trackingInfo: Array<{
      company: string | null;
      number: string | null;
      url: string | null;
    }>;
  }>;
  fulfillmentOrders: {
    nodes: Array<{
      id: string;
      status: string;
      lineItems: {
        nodes: Array<{ id: string; remainingQuantity: number }>;
      };
    }>;
  };
}): AdminOrderDetail {
  return {
    id: node.id,
    name: node.name,
    processedAt: node.processedAt,
    displayFinancialStatus: node.displayFinancialStatus,
    displayFulfillmentStatus: node.displayFulfillmentStatus,
    cancelledAt: node.cancelledAt,
    totalPrice: node.totalPriceSet.shopMoney,
    customerEmail: node.email,
    customerName: node.customer?.displayName ?? null,
    lineItems: node.lineItems.nodes.map((item) => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      fulfillableQuantity: item.fulfillableQuantity,
      price: item.originalUnitPriceSet.shopMoney,
      variantId: item.variant?.id ?? null,
    })),
    fulfillments: node.fulfillments.map((fulfillment) => ({
      id: fulfillment.id,
      status: fulfillment.status,
      tracking: fulfillment.trackingInfo
        .filter((track) => Boolean(track.url))
        .map((track) => ({
          company: track.company,
          number: track.number,
          url: track.url!,
        })),
    })),
    fulfillmentOrders: node.fulfillmentOrders.nodes.map((order) => ({
      id: order.id,
      status: order.status,
      lineItems: order.lineItems.nodes.map((item) => ({
        id: item.id,
        remainingQuantity: item.remainingQuantity,
      })),
    })),
  };
}

async function fetchAdminOrder(id: string): Promise<AdminOrderDetail> {
  const result = await shopifyAdminGraphql<{
    order: Parameters<typeof mapAdminOrderDetail>[0] | null;
  }>(
    `query AdminOrder($id: ID!) {
      order(id: $id) { ${ADMIN_ORDER_DETAIL_FIELDS} }
    }`,
    { id: normalizeOrderId(id) },
  );
  if (!result.order) {
    throw new ShopifyAdminNotFoundError("Order not found");
  }
  return mapAdminOrderDetail(result.order);
}

export async function listAdminOrders(options: {
  cursor?: string;
  query?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
} = {}): Promise<{ orders: AdminOrderSummary[]; pageInfo: AdminPageInfo }> {
  const result = await shopifyAdminGraphql<{
    orders: {
      edges: Array<{
        node: {
          id: string;
          name: string;
          processedAt: string;
          displayFinancialStatus: string | null;
          displayFulfillmentStatus: string | null;
          totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
          email: string | null;
          customer: { displayName: string } | null;
        };
      }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(
    `query AdminOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id name processedAt displayFinancialStatus displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            email
            customer { displayName }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    {
      first: 25,
      after: options.cursor || null,
      query: buildOrderSearchQuery(options),
    },
  );

  return {
    orders: result.orders.edges.map(({ node }) => ({
      id: node.id,
      name: node.name,
      processedAt: node.processedAt,
      displayFinancialStatus: node.displayFinancialStatus,
      displayFulfillmentStatus: node.displayFulfillmentStatus,
      totalPrice: node.totalPriceSet.shopMoney,
      customerEmail: node.email,
      customerName: node.customer?.displayName ?? null,
    })),
    pageInfo: {
      hasNextPage: result.orders.pageInfo.hasNextPage,
      endCursor: result.orders.pageInfo.endCursor,
    },
  };
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetail> {
  return fetchAdminOrder(id);
}

export async function fulfillAdminOrder(
  id: string,
  input: {
    notifyCustomer?: boolean;
    trackingCompany?: string | null;
    trackingNumber?: string | null;
  },
): Promise<AdminOrderDetail> {
  const order = await fetchAdminOrder(id);
  const openFulfillmentOrder = order.fulfillmentOrders.find(
    (entry) =>
      entry.status === "OPEN" ||
      entry.status === "IN_PROGRESS" ||
      entry.status === "SCHEDULED",
  );
  if (!openFulfillmentOrder) {
    throw new ShopifyAdminUserError("No open fulfillment order is available");
  }

  const lineItems = openFulfillmentOrder.lineItems
    .filter((item) => item.remainingQuantity > 0)
    .map((item) => ({
      id: item.id,
      quantity: item.remainingQuantity,
    }));
  if (!lineItems.length) {
    throw new ShopifyAdminUserError("No fulfillable line items remain on this order");
  }

  const trackingCompany = input.trackingCompany?.trim() || null;
  const trackingNumber = input.trackingNumber?.trim() || null;
  const result = await shopifyAdminGraphql<{
    fulfillmentCreate: {
      fulfillment: { id: string } | null;
      userErrors: Array<{ message: string; field?: string[] | null }>;
    };
  }>(
    `mutation FulfillOrder($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment { id }
        userErrors { field message }
      }
    }`,
    {
      fulfillment: {
        notifyCustomer: input.notifyCustomer ?? true,
        lineItemsByFulfillmentOrder: [
          {
            fulfillmentOrderId: openFulfillmentOrder.id,
            fulfillmentOrderLineItems: lineItems,
          },
        ],
        ...(trackingNumber
          ? {
              trackingInfo: {
                company: trackingCompany,
                number: trackingNumber,
              },
            }
          : {}),
      },
    },
  );
  assertAdminUserErrors(result.fulfillmentCreate.userErrors);
  return fetchAdminOrder(id);
}

export async function refundAdminOrder(
  id: string,
  input: {
    amount?: string | null;
    full?: boolean;
    note?: string | null;
    notify?: boolean;
  },
): Promise<AdminOrderDetail> {
  const order = await fetchAdminOrder(id);
  const parentId = await shopifyAdminGraphql<{
    order: {
      transactions: Array<{
        id: string;
        kind: string;
        status: string;
        amountSet: { shopMoney: { amount: string; currencyCode: string } };
      }>;
    } | null;
  }>(
    `query OrderTransactions($id: ID!) {
      order(id: $id) {
        transactions(first: 20) {
          id kind status
          amountSet { shopMoney { amount currencyCode } }
        }
      }
    }`,
    { id: normalizeOrderId(id) },
  );

  const parent = parentId.order?.transactions.find(
    (tx) =>
      (tx.kind === "SALE" || tx.kind === "CAPTURE") &&
      tx.status === "SUCCESS",
  );
  if (!parent) {
    throw new ShopifyAdminUserError("No successful capture/sale transaction is available to refund");
  }

  const refundAmount = input.full
    ? order.totalPrice.amount
    : input.amount?.trim();
  if (!refundAmount) {
    throw new ShopifyAdminUserError("Provide a refund amount or set full=true");
  }

  const result = await shopifyAdminGraphql<{
    refundCreate: {
      refund: { id: string } | null;
      userErrors: Array<{ message: string; field?: string[] | null }>;
    };
  }>(
    `mutation RefundOrder($input: RefundInput!) {
      refundCreate(input: $input) {
        refund { id }
        userErrors { field message }
      }
    }`,
    {
      input: {
        orderId: normalizeOrderId(id),
        note: input.note ?? null,
        notify: input.notify ?? true,
        transactions: [
          {
            orderId: normalizeOrderId(id),
            parentId: parent.id,
            amount: refundAmount,
            kind: "REFUND",
            gateway: "manual",
          },
        ],
      },
    },
  );
  assertAdminUserErrors(result.refundCreate.userErrors);
  return fetchAdminOrder(id);
}

export async function cancelAdminOrder(
  id: string,
  input: {
    reason?: "CUSTOMER" | "DECLINED" | "FRAUD" | "INVENTORY" | "OTHER" | "STAFF";
    restock?: boolean;
    notifyCustomer?: boolean;
    staffNote?: string | null;
  },
): Promise<AdminOrderDetail> {
  const result = await shopifyAdminGraphql<{
    orderCancel: {
      orderCancelUserErrors: Array<{ message: string; field?: string[] | null }>;
      job: { id: string } | null;
    };
  }>(
    `mutation CancelOrder(
      $orderId: ID!
      $reason: OrderCancelReason!
      $restock: Boolean!
      $notifyCustomer: Boolean
      $staffNote: String
    ) {
      orderCancel(
        orderId: $orderId
        reason: $reason
        restock: $restock
        notifyCustomer: $notifyCustomer
        staffNote: $staffNote
      ) {
        job { id }
        orderCancelUserErrors { field message }
      }
    }`,
    {
      orderId: normalizeOrderId(id),
      reason: input.reason ?? "OTHER",
      restock: input.restock ?? true,
      notifyCustomer: input.notifyCustomer ?? true,
      staffNote: input.staffNote ?? null,
    },
  );
  assertAdminUserErrors(result.orderCancel.orderCancelUserErrors);
  return fetchAdminOrder(id);
}
