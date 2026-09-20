import { supabaseRequest } from "./supabase";
import {
  getVariant,
  storeCurrency,
  CommerceNotFoundError,
  CommerceValidationError,
  type Money,
} from "./commerce-repository";

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

type CartRow = {
  id: string;
  clerk_user_id: string | null;
  currency: string;
  updated_at: string;
};

type CartLineRow = {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
};

type VariantJoin = {
  id: string;
  title: string;
  price: string | number;
  compare_at_price: string | number | null;
  inventory_quantity: number;
  option_values: Array<{ name: string; value: string }> | null;
  product_id: string;
  products: {
    id: string;
    handle: string;
    title: string;
    status: string;
    product_images: Array<{ url: string; alt_text: string | null }> | null;
  } | null;
};

export type StorefrontCart = {
  id: string;
  totalQuantity: number;
  lines: Array<{
    id: string;
    quantity: number;
    merchandise: {
      id: string;
      title: string;
      price: Money;
      compareAtPrice: Money | null;
      image: {
        url: string;
        altText: string | null;
        width: number | null;
        height: number | null;
      } | null;
      selectedOptions: Array<{ name: string; value: string }>;
      product: { handle: string; title: string };
    };
  }>;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
  };
};

function money(amount: string | number, currencyCode: string): Money {
  const n = typeof amount === "number" ? amount : Number(amount);
  return {
    amount: Number.isFinite(n) ? n.toFixed(2) : "0.00",
    currencyCode,
  };
}

async function loadCart(cartId: string): Promise<CartRow | null> {
  const rows = await supabaseRequest<CartRow[]>(
    `carts?id=${eq(cartId)}&select=id,clerk_user_id,currency,updated_at&limit=1`,
  );
  return rows[0] ?? null;
}

async function mapCart(cart: CartRow): Promise<StorefrontCart> {
  const lines = await supabaseRequest<
    Array<CartLineRow & { product_variants: VariantJoin | null }>
  >(
    `cart_lines?cart_id=${eq(cart.id)}&select=id,cart_id,variant_id,quantity,product_variants(id,title,price,compare_at_price,inventory_quantity,option_values,product_id,products(id,handle,title,status,product_images(url,alt_text)))`,
  );

  const currency = cart.currency || storeCurrency();
  let subtotal = 0;
  let totalQuantity = 0;
  const mappedLines = [];

  for (const line of lines) {
    const variant = line.product_variants;
    if (!variant?.products) continue;
    const unit = Number(variant.price);
    subtotal += unit * line.quantity;
    totalQuantity += line.quantity;
    const image = variant.products.product_images?.[0];
    mappedLines.push({
      id: line.id,
      quantity: line.quantity,
      merchandise: {
        id: variant.id,
        title: variant.title,
        price: money(variant.price, currency),
        compareAtPrice:
          variant.compare_at_price == null
            ? null
            : money(variant.compare_at_price, currency),
        image: image
          ? {
              url: image.url,
              altText: image.alt_text,
              width: null,
              height: null,
            }
          : null,
        selectedOptions: variant.option_values ?? [],
        product: {
          handle: variant.products.handle,
          title: variant.products.title,
        },
      },
    });
  }

  return {
    id: cart.id,
    totalQuantity,
    lines: mappedLines,
    cost: {
      subtotalAmount: money(subtotal, currency),
      totalAmount: money(subtotal, currency),
    },
  };
}

export async function createCart(
  merchandiseId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const variant = await getVariant(merchandiseId);
  if (!variant) throw new CommerceValidationError("Invalid cart line variant");
  if (variant.inventory_quantity < quantity) {
    throw new CommerceValidationError("Insufficient inventory for this variant");
  }

  const [cart] = await supabaseRequest<CartRow[]>("carts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ currency: storeCurrency() }),
  });
  if (!cart) throw new Error("Failed to create cart");

  await supabaseRequest("cart_lines", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      cart_id: cart.id,
      variant_id: merchandiseId,
      quantity,
    }),
  });

  return mapCart(cart);
}

export async function getCart(cartId: string): Promise<StorefrontCart | null> {
  const cart = await loadCart(cartId);
  if (!cart) return null;
  return mapCart(cart);
}

export async function addCartLine(
  cartId: string,
  merchandiseId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const cart = await loadCart(cartId);
  if (!cart) throw new CommerceNotFoundError("Cart not found");
  const variant = await getVariant(merchandiseId);
  if (!variant) throw new CommerceValidationError("Invalid cart line variant");

  const existing = await supabaseRequest<CartLineRow[]>(
    `cart_lines?cart_id=${eq(cartId)}&variant_id=${eq(merchandiseId)}&select=id,cart_id,variant_id,quantity&limit=1`,
  );
  const nextQty = (existing[0]?.quantity ?? 0) + quantity;
  if (variant.inventory_quantity < nextQty) {
    throw new CommerceValidationError("Insufficient inventory for this variant");
  }

  if (existing[0]) {
    await supabaseRequest(`cart_lines?id=${eq(existing[0].id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        quantity: nextQty,
        updated_at: new Date().toISOString(),
      }),
    });
  } else {
    await supabaseRequest("cart_lines", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        cart_id: cartId,
        variant_id: merchandiseId,
        quantity,
      }),
    });
  }

  await supabaseRequest(`carts?id=${eq(cartId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
  });

  return mapCart(cart);
}

export async function updateCartLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<StorefrontCart> {
  const cart = await loadCart(cartId);
  if (!cart) throw new CommerceNotFoundError("Cart not found");
  const lines = await supabaseRequest<CartLineRow[]>(
    `cart_lines?id=${eq(lineId)}&cart_id=${eq(cartId)}&select=id,cart_id,variant_id,quantity&limit=1`,
  );
  const line = lines[0];
  if (!line) throw new CommerceValidationError("Invalid cart line");
  const variant = await getVariant(line.variant_id);
  if (!variant) throw new CommerceValidationError("Invalid cart line variant");
  if (variant.inventory_quantity < quantity) {
    throw new CommerceValidationError("Insufficient inventory for this variant");
  }

  await supabaseRequest(`cart_lines?id=${eq(lineId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      quantity,
      updated_at: new Date().toISOString(),
    }),
  });

  return mapCart(cart);
}

export async function removeCartLine(
  cartId: string,
  lineId: string,
): Promise<StorefrontCart> {
  const cart = await loadCart(cartId);
  if (!cart) throw new CommerceNotFoundError("Cart not found");
  await supabaseRequest(
    `cart_lines?id=${eq(lineId)}&cart_id=${eq(cartId)}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  return mapCart(cart);
}

export async function clearCart(cartId: string): Promise<void> {
  await supabaseRequest(`cart_lines?cart_id=${eq(cartId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function attachCartUser(
  cartId: string,
  clerkUserId: string,
): Promise<void> {
  await supabaseRequest(`carts?id=${eq(cartId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      clerk_user_id: clerkUserId,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function getCartLinesRaw(cartId: string): Promise<CartLineRow[]> {
  return supabaseRequest<CartLineRow[]>(
    `cart_lines?cart_id=${eq(cartId)}&select=id,cart_id,variant_id,quantity`,
  );
}
