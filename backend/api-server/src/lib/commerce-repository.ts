import { supabaseRequest, SupabaseRequestError } from "./supabase";

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

export type ProductStatus = "draft" | "active" | "archived";

export type Money = { amount: string; currencyCode: string };

export type ProductImage = {
  id: string;
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ProductOption = { id: string; name: string; values: string[] };

export type ProductVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
  image: ProductImage | null;
};

export type StorefrontProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: ProductImage | null;
  price: Money;
  compareAtPrice: Money | null;
  availableForSale: boolean;
  sizes: string[];
  badges: string[];
  tags: string[];
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
  images: ProductImage[];
  options: ProductOption[];
  variants: Array<{
    id: string;
    title: string;
    availableForSale: boolean;
    quantityAvailable: number | null;
    price: Money;
    compareAtPrice: Money | null;
    image: ProductImage | null;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
};

export type AdminProductSummary = {
  id: string;
  handle: string;
  title: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType: string;
  tags: string[];
  totalInventory: number;
  featuredImageUrl: string | null;
  updatedAt: string;
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
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    price: string;
    compareAtPrice: string | null;
    inventoryItemId: string;
    inventoryQuantity: number;
    selectedOptions: Array<{ name: string; value: string }>;
  }>;
  images: Array<{
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  }>;
  updatedAt: string;
};

type ProductRow = {
  id: string;
  handle: string;
  title: string;
  description_html: string;
  status: ProductStatus;
  product_type: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  title: string;
  sku: string | null;
  price: string | number;
  compare_at_price: string | number | null;
  option_values: Array<{ name: string; value: string }> | null;
  inventory_quantity: number;
};

type ImageRow = {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  position: number;
};

type OptionRow = {
  id: string;
  product_id: string;
  name: string;
  position: number;
};

export class CommerceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceNotFoundError";
  }
}

export class CommerceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceValidationError";
  }
}

function currency(): string {
  return process.env.STORE_CURRENCY?.trim() || "PKR";
}

function money(amount: string | number): Money {
  const n = typeof amount === "number" ? amount : Number(amount);
  return {
    amount: Number.isFinite(n) ? n.toFixed(2) : "0.00",
    currencyCode: currency(),
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "product";
}

function toAdminStatus(status: ProductStatus): "ACTIVE" | "ARCHIVED" | "DRAFT" {
  if (status === "active") return "ACTIVE";
  if (status === "archived") return "ARCHIVED";
  return "DRAFT";
}

function fromAdminStatus(status: "ACTIVE" | "ARCHIVED" | "DRAFT"): ProductStatus {
  if (status === "ACTIVE") return "active";
  if (status === "ARCHIVED") return "archived";
  return "draft";
}

function mapImage(row: ImageRow): ProductImage {
  return {
    id: row.id,
    url: row.url,
    altText: row.alt_text,
    width: null,
    height: null,
  };
}

async function loadVariants(productIds: string[]): Promise<VariantRow[]> {
  if (!productIds.length) return [];
  const filter = productIds.map((id) => encodeURIComponent(id)).join(",");
  return supabaseRequest<VariantRow[]>(
    `product_variants?product_id=in.(${filter})&select=id,product_id,title,sku,price,compare_at_price,option_values,inventory_quantity&order=created_at.asc`,
  );
}

async function loadImages(productIds: string[]): Promise<ImageRow[]> {
  if (!productIds.length) return [];
  const filter = productIds.map((id) => encodeURIComponent(id)).join(",");
  return supabaseRequest<ImageRow[]>(
    `product_images?product_id=in.(${filter})&select=id,product_id,url,alt_text,position&order=position.asc`,
  );
}

async function loadOptions(productIds: string[]): Promise<OptionRow[]> {
  if (!productIds.length) return [];
  const filter = productIds.map((id) => encodeURIComponent(id)).join(",");
  return supabaseRequest<OptionRow[]>(
    `product_options?product_id=in.(${filter})&select=id,product_id,name,position&order=position.asc`,
  );
}

function mapStorefrontProduct(
  product: ProductRow,
  variants: VariantRow[],
  images: ImageRow[],
  options: OptionRow[],
): StorefrontProduct {
  const prices = variants.map((v) => Number(v.price));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const comparePrices = variants
    .map((v) => (v.compare_at_price == null ? null : Number(v.compare_at_price)))
    .filter((n): n is number => n != null && n > 0);
  const minCompare = comparePrices.length ? Math.min(...comparePrices) : null;
  const availableForSale =
    product.status === "active" &&
    variants.some((v) => v.inventory_quantity > 0);

  const sizeOption = options.find((o) => o.name.toLowerCase() === "size");
  const sizeValues = new Set<string>();
  if (sizeOption) {
    for (const variant of variants) {
      for (const ov of variant.option_values ?? []) {
        if (ov.name.toLowerCase() === "size") sizeValues.add(ov.value);
      }
    }
  }

  const tags = product.tags ?? [];
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: stripHtml(product.description_html),
    image: images[0] ? mapImage(images[0]) : null,
    price: money(minPrice),
    compareAtPrice: minCompare == null ? null : money(minCompare),
    availableForSale,
    sizes: sizeOption ? [...sizeValues] : [],
    badges: tags.filter((tag) =>
      ["new", "best_seller", "sale"].includes(tag.toLowerCase()),
    ),
    tags,
  };
}

function mapProductDetail(
  product: ProductRow,
  variants: VariantRow[],
  images: ImageRow[],
  options: OptionRow[],
): ProductDetail {
  const card = mapStorefrontProduct(product, variants, images, options);
  const optionValuesByName = new Map<string, Set<string>>();
  for (const option of options) {
    optionValuesByName.set(option.name, new Set());
  }
  for (const variant of variants) {
    for (const ov of variant.option_values ?? []) {
      const set = optionValuesByName.get(ov.name) ?? new Set<string>();
      set.add(ov.value);
      optionValuesByName.set(ov.name, set);
    }
  }

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: card.description,
    descriptionHtml: product.description_html,
    vendor: "M&E Garments",
    productType: product.product_type,
    availableForSale: card.availableForSale,
    images: images.map(mapImage),
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      values: [...(optionValuesByName.get(option.name) ?? [])],
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale:
        product.status === "active" && variant.inventory_quantity > 0,
      quantityAvailable: variant.inventory_quantity,
      price: money(variant.price),
      compareAtPrice:
        variant.compare_at_price == null
          ? null
          : money(variant.compare_at_price),
      image: null,
      selectedOptions: variant.option_values ?? [],
    })),
  };
}

export async function isCommerceReady(): Promise<boolean> {
  try {
    await supabaseRequest<ProductRow[]>("products?select=id&limit=1");
    return true;
  } catch {
    return false;
  }
}

export async function listActiveProductsForHome(
  limit = 24,
): Promise<StorefrontProduct[]> {
  const products = await supabaseRequest<ProductRow[]>(
    `products?status=eq.active&select=*&order=updated_at.desc&limit=${limit}`,
  );
  const ids = products.map((p) => p.id);
  const [variants, images, options] = await Promise.all([
    loadVariants(ids),
    loadImages(ids),
    loadOptions(ids),
  ]);
  return products.map((product) =>
    mapStorefrontProduct(
      product,
      variants.filter((v) => v.product_id === product.id),
      images.filter((i) => i.product_id === product.id),
      options.filter((o) => o.product_id === product.id),
    ),
  );
}

export async function getProductByHandle(
  handle: string,
): Promise<ProductDetail | null> {
  const products = await supabaseRequest<ProductRow[]>(
    `products?handle=${eq(handle)}&select=*&limit=1`,
  );
  const product = products[0];
  if (!product) return null;
  if (product.status !== "active") return null;
  const [variants, images, options] = await Promise.all([
    loadVariants([product.id]),
    loadImages([product.id]),
    loadOptions([product.id]),
  ]);
  return mapProductDetail(product, variants, images, options);
}

/** Expand search tokens so "boy" hits "boys", "summer" hits seasonal copy, etc. */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  boy: ["boy", "boys"],
  boys: ["boy", "boys"],
  girl: ["girl", "girls"],
  girls: ["girl", "girls"],
  toddler: ["toddler", "toddlers", "baby", "infant"],
  kids: ["kids", "kid", "children", "child"],
  party: ["party", "partywear", "festive"],
  summer: ["summer", "summery"],
  winter: ["winter", "woolen", "woollen"],
  spring: ["spring"],
  autumn: ["autumn", "fall"],
  fall: ["fall", "autumn"],
};

function termMatchesHaystack(haystack: string, term: string): boolean {
  const variants = SEARCH_SYNONYMS[term] ?? [term];
  return variants.some((variant) => haystack.includes(variant));
}

export async function searchProducts(
  terms: string[],
  limit = 20,
): Promise<StorefrontProduct[]> {
  const products = await supabaseRequest<ProductRow[]>(
    `products?status=eq.active&select=*&order=updated_at.desc&limit=100`,
  );
  const normalized = terms.map((t) => t.toLowerCase()).filter(Boolean);
  const filtered = normalized.length
    ? products.filter((product) => {
        const haystack = [
          product.title,
          product.product_type,
          ...(product.tags ?? []),
          stripHtml(product.description_html),
        ]
          .join(" ")
          .toLowerCase();
        return normalized.every((term) => termMatchesHaystack(haystack, term));
      })
    : products;
  const sliced = filtered.slice(0, limit);
  const ids = sliced.map((p) => p.id);
  const [variants, images, options] = await Promise.all([
    loadVariants(ids),
    loadImages(ids),
    loadOptions(ids),
  ]);
  return sliced.map((product) =>
    mapStorefrontProduct(
      product,
      variants.filter((v) => v.product_id === product.id),
      images.filter((i) => i.product_id === product.id),
      options.filter((o) => o.product_id === product.id),
    ),
  );
}

export async function getCatalogHealth() {
  const products = await supabaseRequest<ProductRow[]>(
    "products?status=eq.active&select=*&order=updated_at.desc",
  );
  const ids = products.map((p) => p.id);
  const [variants, images, options] = await Promise.all([
    loadVariants(ids),
    loadImages(ids),
    loadOptions(ids),
  ]);

  const issues = products.flatMap((product) => {
    const productVariants = variants.filter((v) => v.product_id === product.id);
    const productImages = images.filter((i) => i.product_id === product.id);
    const productOptions = options.filter((o) => o.product_id === product.id);
    const problems: string[] = [];
    if (!product.title.trim()) problems.push("Missing title");
    if (!stripHtml(product.description_html)) problems.push("Missing description");
    if (!productImages.length) problems.push("Missing featured image");
    if (!productVariants.some((v) => v.inventory_quantity > 0)) {
      problems.push("No variants available for sale");
    }
    if (!productOptions.some((o) => o.name.toLowerCase() === "size")) {
      problems.push("Missing size option");
    }
    const minPrice = productVariants.length
      ? Math.min(...productVariants.map((v) => Number(v.price)))
      : 0;
    if (minPrice <= 0) problems.push("Missing or invalid price");
    return problems.length
      ? [
          {
            productId: product.id,
            handle: product.handle,
            title: product.title,
            problems,
          },
        ]
      : [];
  });

  const availableProducts = products.filter((product) => {
    const productVariants = variants.filter((v) => v.product_id === product.id);
    return productVariants.some((v) => v.inventory_quantity > 0);
  }).length;

  return {
    checkedAt: new Date().toISOString(),
    totalProducts: products.length,
    availableProducts,
    issues,
  };
}

export async function listAdminProducts(options: {
  cursor?: string;
  query?: string;
} = {}) {
  const limit = 25;
  let path = `products?select=*&order=updated_at.desc&limit=${limit}`;
  if (options.query?.trim()) {
    path += `&title=ilike.*${encodeURIComponent(options.query.trim())}*`;
  }
  if (options.cursor) {
    path += `&updated_at=lt.${encodeURIComponent(options.cursor)}`;
  }
  const products = await supabaseRequest<ProductRow[]>(path);
  const ids = products.map((p) => p.id);
  const [variants, images] = await Promise.all([
    loadVariants(ids),
    loadImages(ids),
  ]);

  const summaries: AdminProductSummary[] = products.map((product) => {
    const productVariants = variants.filter((v) => v.product_id === product.id);
    const productImages = images.filter((i) => i.product_id === product.id);
    return {
      id: product.id,
      handle: product.handle,
      title: product.title,
      status: toAdminStatus(product.status),
      productType: product.product_type,
      tags: product.tags ?? [],
      totalInventory: productVariants.reduce(
        (sum, v) => sum + v.inventory_quantity,
        0,
      ),
      featuredImageUrl: productImages[0]?.url ?? null,
      updatedAt: product.updated_at,
    };
  });

  const last = products[products.length - 1];
  return {
    products: summaries,
    pageInfo: {
      hasNextPage: products.length === limit,
      endCursor: last?.updated_at ?? null,
    },
  };
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  const products = await supabaseRequest<ProductRow[]>(
    `products?id=${eq(id)}&select=*&limit=1`,
  );
  const product = products[0];
  if (!product) throw new CommerceNotFoundError("Product not found");
  const [variants, images, options] = await Promise.all([
    loadVariants([product.id]),
    loadImages([product.id]),
    loadOptions([product.id]),
  ]);

  const optionValuesByName = new Map<string, Set<string>>();
  for (const option of options) {
    optionValuesByName.set(option.name, new Set());
  }
  for (const variant of variants) {
    for (const ov of variant.option_values ?? []) {
      const set = optionValuesByName.get(ov.name) ?? new Set<string>();
      set.add(ov.value);
      optionValuesByName.set(ov.name, set);
    }
  }

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    descriptionHtml: product.description_html,
    status: toAdminStatus(product.status),
    productType: product.product_type,
    tags: product.tags ?? [],
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      values: [...(optionValuesByName.get(option.name) ?? [])],
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: money(variant.price).amount,
      compareAtPrice:
        variant.compare_at_price == null
          ? null
          : money(variant.compare_at_price).amount,
      inventoryItemId: variant.id,
      inventoryQuantity: variant.inventory_quantity,
      selectedOptions: variant.option_values ?? [],
    })),
    images: images.map((image) => ({
      url: image.url,
      altText: image.alt_text,
      width: null,
      height: null,
    })),
    updatedAt: product.updated_at,
  };
}

export async function createAdminProduct(input: {
  title: string;
  descriptionHtml?: string;
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
  productType?: string;
  tags?: string[];
  optionName?: string;
  variants: Array<{
    optionValues: string[];
    price: string;
    compareAtPrice?: string | null;
    sku?: string | null;
    inventoryQuantity?: number;
  }>;
  imageUrls?: string[];
}): Promise<AdminProductDetail> {
  if (!input.variants.length) {
    throw new CommerceValidationError("At least one variant is required");
  }
  const optionName = input.optionName?.trim() || "Size";
  let handle = slugify(input.title);
  const existing = await supabaseRequest<ProductRow[]>(
    `products?handle=${eq(handle)}&select=id&limit=1`,
  );
  if (existing[0]) {
    handle = `${handle}-${Date.now().toString(36)}`;
  }

  const [product] = await supabaseRequest<ProductRow[]>("products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      handle,
      title: input.title,
      description_html: input.descriptionHtml ?? "",
      status: fromAdminStatus(input.status ?? "DRAFT"),
      product_type: input.productType ?? "",
      tags: input.tags ?? [],
    }),
  });
  if (!product) throw new Error("Failed to create product");

  await supabaseRequest("product_options", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      product_id: product.id,
      name: optionName,
      position: 0,
    }),
  });

  const variantRows = input.variants.map((variant) => ({
    product_id: product.id,
    title: variant.optionValues.join(" / ") || "Default",
    sku: variant.sku ?? null,
    price: variant.price,
    compare_at_price: variant.compareAtPrice ?? null,
    option_values: variant.optionValues.map((value) => ({
      name: optionName,
      value,
    })),
    inventory_quantity: Math.max(0, Math.floor(variant.inventoryQuantity ?? 0)),
  }));
  await supabaseRequest("product_variants", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(variantRows),
  });

  if (input.imageUrls?.length) {
    await supabaseRequest("product_images", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(
        input.imageUrls.map((url, index) => ({
          product_id: product.id,
          url,
          alt_text: null,
          position: index,
        })),
      ),
    });
  }

  return getAdminProduct(product.id);
}

export async function updateAdminProduct(
  id: string,
  input: {
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
      inventoryQuantity?: number;
    }>;
    imageUrls?: string[];
  },
): Promise<AdminProductDetail> {
  await getAdminProduct(id);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title;
  if (input.descriptionHtml !== undefined) {
    patch.description_html = input.descriptionHtml;
  }
  if (input.status !== undefined) patch.status = fromAdminStatus(input.status);
  if (input.productType !== undefined) patch.product_type = input.productType;
  if (input.tags !== undefined) patch.tags = input.tags;

  if (Object.keys(patch).length > 1) {
    await supabaseRequest(`products?id=${eq(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  }

  if (input.variants?.length) {
    for (const variant of input.variants) {
      const body: Record<string, unknown> = {
        price: variant.price,
        compare_at_price: variant.compareAtPrice ?? null,
        sku: variant.sku ?? null,
        updated_at: new Date().toISOString(),
      };
      if (variant.inventoryQuantity !== undefined) {
        body.inventory_quantity = Math.max(
          0,
          Math.floor(variant.inventoryQuantity),
        );
      }
      await supabaseRequest(`product_variants?id=${eq(variant.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
    }
  }

  if (input.imageUrls?.length) {
    const existing = await loadImages([id]);
    const existingUrls = new Set(existing.map((image) => image.url));
    const newUrls = input.imageUrls.filter((url) => !existingUrls.has(url));
    if (newUrls.length) {
      const start = existing.length;
      await supabaseRequest("product_images", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          newUrls.map((url, index) => ({
            product_id: id,
            url,
            alt_text: null,
            position: start + index,
          })),
        ),
      });
    }
  }

  return getAdminProduct(id);
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await getAdminProduct(id);
  const variants = await loadVariants([id]);
  if (variants.length) {
    const ids = variants.map((v) => v.id).join(",");
    await supabaseRequest(`cart_lines?variant_id=in.(${ids})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  }
  await supabaseRequest(`wishlist_items?product_id=${eq(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await supabaseRequest(`recently_viewed_items?product_id=${eq(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await supabaseRequest(`products?id=${eq(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function listAdminInventory(options: {
  cursor?: string;
  query?: string;
} = {}) {
  const limit = 50;
  let path =
    "product_variants?select=id,product_id,title,sku,inventory_quantity,option_values,products(id,title)&order=id.asc&limit=" +
    limit;
  if (options.cursor) {
    path += `&id=gt.${encodeURIComponent(options.cursor)}`;
  }
  type Joined = VariantRow & {
    products: { id: string; title: string } | null;
  };
  let rows = await supabaseRequest<Joined[]>(path);
  if (options.query?.trim()) {
    const q = options.query.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        (row.sku ?? "").toLowerCase().includes(q) ||
        (row.products?.title ?? "").toLowerCase().includes(q),
    );
  }

  const items = rows.map((row) => ({
    inventoryItemId: row.id,
    variantId: row.id,
    productId: row.product_id,
    productTitle: row.products?.title ?? "Product",
    variantTitle: row.title,
    sku: row.sku,
    locationId: "primary",
    locationName: "Primary",
    available: row.inventory_quantity,
  }));

  const last = rows[rows.length - 1];
  return {
    items,
    pageInfo: {
      hasNextPage: rows.length === limit,
      endCursor: last?.id ?? null,
    },
    locationId: "primary",
    locationName: "Primary",
  };
}

export async function adjustAdminInventory(input: {
  inventoryItemId: string;
  delta: number;
}) {
  const rows = await supabaseRequest<VariantRow[]>(
    `product_variants?id=${eq(input.inventoryItemId)}&select=id,product_id,title,sku,price,compare_at_price,option_values,inventory_quantity&limit=1`,
  );
  const variant = rows[0];
  if (!variant) throw new CommerceNotFoundError("Inventory item not found");
  const next = variant.inventory_quantity + input.delta;
  if (next < 0) {
    throw new CommerceValidationError("Inventory cannot go below zero");
  }
  await supabaseRequest(`product_variants?id=${eq(variant.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      inventory_quantity: next,
      updated_at: new Date().toISOString(),
    }),
  });

  const products = await supabaseRequest<ProductRow[]>(
    `products?id=${eq(variant.product_id)}&select=id,title&limit=1`,
  );
  return {
    inventoryItemId: variant.id,
    variantId: variant.id,
    productId: variant.product_id,
    productTitle: products[0]?.title ?? "Product",
    variantTitle: variant.title,
    sku: variant.sku,
    locationId: "primary",
    locationName: "Primary",
    available: next,
  };
}

export async function getVariant(id: string): Promise<VariantRow | null> {
  const rows = await supabaseRequest<VariantRow[]>(
    `product_variants?id=${eq(id)}&select=id,product_id,title,sku,price,compare_at_price,option_values,inventory_quantity&limit=1`,
  );
  return rows[0] ?? null;
}

export async function setVariantInventory(
  variantId: string,
  quantity: number,
): Promise<void> {
  await supabaseRequest(`product_variants?id=${eq(variantId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      inventory_quantity: quantity,
      updated_at: new Date().toISOString(),
    }),
  });
}

export function storeCurrency(): string {
  return currency();
}

export { SupabaseRequestError };
