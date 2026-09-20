import { supabaseRequest } from "./supabase";
import {
  getVariant,
  setVariantInventory,
  storeCurrency,
  CommerceNotFoundError,
  CommerceValidationError,
  type Money,
} from "./commerce-repository";
import {
  attachCartUser,
  clearCart,
  getCart,
  getCartLinesRaw,
} from "./cart-repository";

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

type OrderRow = {
  id: string;
  order_number: string;
  clerk_user_id: string;
  email: string;
  status: "open" | "fulfilled" | "cancelled";
  payment_status: "unpaid" | "paid" | "refunded";
  currency: string;
  subtotal: string | number;
  total: string | number;
  shipping_address: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OrderLineRow = {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_title: string;
  variant_title: string;
  quantity: number;
  unit_price: string | number;
};

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode?: string | null;
  country: string;
  phone?: string | null;
};

function money(amount: string | number, currencyCode: string): Money {
  const n = typeof amount === "number" ? amount : Number(amount);
  return {
    amount: Number.isFinite(n) ? n.toFixed(2) : "0.00",
    currencyCode,
  };
}

function orderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ME-${stamp}-${rand}`;
}

async function loadLines(orderId: string): Promise<OrderLineRow[]> {
  return supabaseRequest<OrderLineRow[]>(
    `order_line_items?order_id=${eq(orderId)}&select=*&order=created_at.asc`,
  );
}

function mapCustomerOrder(order: OrderRow, lines: OrderLineRow[]) {
  return {
    id: order.id,
    name: order.order_number,
    processedAt: order.created_at,
    displayFinancialStatus: order.payment_status,
    displayFulfillmentStatus:
      order.status === "fulfilled"
        ? "FULFILLED"
        : order.status === "cancelled"
          ? "CANCELLED"
          : "UNFULFILLED",
    totalPrice: money(order.total, order.currency),
    lineItems: lines.map((line) => ({
      id: line.id,
      title: line.product_title,
      quantity: line.quantity,
      variantTitle: line.variant_title,
      price: money(line.unit_price, order.currency),
    })),
    fulfillments:
      order.status === "fulfilled"
        ? [
            {
              id: `${order.id}-fulfillment`,
              status: "success",
              tracking: [],
            },
          ]
        : [],
  };
}

function mapAdminOrder(order: OrderRow, lines: OrderLineRow[]) {
  return {
    id: order.id,
    name: order.order_number,
    processedAt: order.created_at,
    displayFinancialStatus: order.payment_status.toUpperCase(),
    displayFulfillmentStatus:
      order.status === "fulfilled"
        ? "FULFILLED"
        : order.status === "cancelled"
          ? "CANCELLED"
          : "UNFULFILLED",
    cancelledAt: order.status === "cancelled" ? order.updated_at : null,
    totalPrice: money(order.total, order.currency),
    customerEmail: order.email,
    customerName:
      typeof order.shipping_address?.name === "string"
        ? order.shipping_address.name
        : null,
    lineItems: lines.map((line) => ({
      id: line.id,
      title: line.product_title,
      variantTitle: line.variant_title,
      quantity: line.quantity,
      fulfillableQuantity: order.status === "open" ? line.quantity : 0,
      price: money(line.unit_price, order.currency),
      variantId: line.variant_id,
    })),
    fulfillments:
      order.status === "fulfilled"
        ? [
            {
              id: `${order.id}-fulfillment`,
              status: "success",
              tracking: [],
            },
          ]
        : [],
    fulfillmentOrders:
      order.status === "open"
        ? [
            {
              id: `${order.id}-fo`,
              status: "OPEN",
              lineItems: lines.map((line) => ({
                id: line.id,
                remainingQuantity: line.quantity,
              })),
            },
          ]
        : [],
  };
}

export async function checkoutCart(input: {
  cartId: string;
  clerkUserId: string;
  email: string;
  shippingAddress: ShippingAddress;
  notes?: string | null;
}) {
  const cart = await getCart(input.cartId);
  if (!cart || cart.lines.length === 0) {
    throw new CommerceValidationError("Cart is empty");
  }

  await attachCartUser(input.cartId, input.clerkUserId);
  const rawLines = await getCartLinesRaw(input.cartId);
  if (!rawLines.length) {
    throw new CommerceValidationError("Cart is empty");
  }

  let subtotal = 0;
  const lineSnapshots: Array<{
    variant_id: string;
    product_title: string;
    variant_title: string;
    quantity: number;
    unit_price: string;
    nextInventory: number;
  }> = [];

  for (const line of rawLines) {
    const variant = await getVariant(line.variant_id);
    if (!variant) {
      throw new CommerceValidationError("A cart line references a missing variant");
    }
    if (variant.inventory_quantity < line.quantity) {
      throw new CommerceValidationError(
        `Insufficient inventory for ${variant.title}`,
      );
    }
    const unit = Number(variant.price);
    subtotal += unit * line.quantity;

    const products = await supabaseRequest<
      Array<{ id: string; title: string; status: string }>
    >(`products?id=${eq(variant.product_id)}&select=id,title,status&limit=1`);
    const product = products[0];
    if (!product || product.status !== "active") {
      throw new CommerceValidationError(
        `Product for variant ${variant.title} is not available`,
      );
    }

    lineSnapshots.push({
      variant_id: variant.id,
      product_title: product.title,
      variant_title: variant.title,
      quantity: line.quantity,
      unit_price: unit.toFixed(2),
      nextInventory: variant.inventory_quantity - line.quantity,
    });
  }

  const currency = storeCurrency();
  const [order] = await supabaseRequest<OrderRow[]>("orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      order_number: orderNumber(),
      clerk_user_id: input.clerkUserId,
      email: input.email,
      status: "open",
      payment_status: "unpaid",
      currency,
      subtotal: subtotal.toFixed(2),
      total: subtotal.toFixed(2),
      shipping_address: input.shippingAddress,
      notes: input.notes ?? null,
    }),
  });
  if (!order) throw new Error("Failed to create order");

  await supabaseRequest("order_line_items", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      lineSnapshots.map((line) => ({
        order_id: order.id,
        variant_id: line.variant_id,
        product_title: line.product_title,
        variant_title: line.variant_title,
        quantity: line.quantity,
        unit_price: line.unit_price,
      })),
    ),
  });

  for (const line of lineSnapshots) {
    await setVariantInventory(line.variant_id, line.nextInventory);
  }

  await clearCart(input.cartId);

  const lines = await loadLines(order.id);
  return mapCustomerOrder(order, lines);
}

export async function listCustomerOrders(clerkUserId: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?clerk_user_id=${eq(clerkUserId)}&select=*&order=created_at.desc&limit=50`,
  );
  return orders.map((order) => ({
    id: order.id,
    name: order.order_number,
    processedAt: order.created_at,
    displayFinancialStatus: order.payment_status,
    displayFulfillmentStatus:
      order.status === "fulfilled"
        ? "FULFILLED"
        : order.status === "cancelled"
          ? "CANCELLED"
          : "UNFULFILLED",
    totalPrice: money(order.total, order.currency),
  }));
}

export async function getCustomerOrder(clerkUserId: string, orderId: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(orderId)}&clerk_user_id=${eq(clerkUserId)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  const lines = await loadLines(order.id);
  return mapCustomerOrder(order, lines);
}

export async function listAdminOrders(options: {
  cursor?: string;
  query?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
} = {}) {
  const limit = 25;
  let path = `orders?select=*&order=created_at.desc&limit=${limit}`;
  if (options.cursor) {
    path += `&created_at=lt.${encodeURIComponent(options.cursor)}`;
  }
  let orders = await supabaseRequest<OrderRow[]>(path);

  if (options.financialStatus) {
    const fs = options.financialStatus.toLowerCase();
    orders = orders.filter((o) => o.payment_status === fs);
  }
  if (options.fulfillmentStatus) {
    const ff = options.fulfillmentStatus.toLowerCase();
    if (ff === "fulfilled") {
      orders = orders.filter((o) => o.status === "fulfilled");
    } else if (ff === "unfulfilled") {
      orders = orders.filter((o) => o.status === "open");
    } else if (ff === "cancelled") {
      orders = orders.filter((o) => o.status === "cancelled");
    }
  }
  if (options.query?.trim()) {
    const q = options.query.trim().toLowerCase();
    orders = orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q),
    );
  }

  const last = orders[orders.length - 1];
  return {
    orders: orders.map((order) => ({
      id: order.id,
      name: order.order_number,
      processedAt: order.created_at,
      displayFinancialStatus: order.payment_status.toUpperCase(),
      displayFulfillmentStatus:
        order.status === "fulfilled"
          ? "FULFILLED"
          : order.status === "cancelled"
            ? "CANCELLED"
            : "UNFULFILLED",
      totalPrice: money(order.total, order.currency),
      customerEmail: order.email,
      customerName:
        typeof order.shipping_address?.name === "string"
          ? order.shipping_address.name
          : null,
    })),
    pageInfo: {
      hasNextPage: orders.length === limit,
      endCursor: last?.created_at ?? null,
    },
  };
}

export async function getAdminOrder(id: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(id)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  const lines = await loadLines(order.id);
  return mapAdminOrder(order, lines);
}

export async function fulfillAdminOrder(id: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(id)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  if (order.status === "cancelled") {
    throw new CommerceValidationError("Cancelled orders cannot be fulfilled");
  }
  await supabaseRequest(`orders?id=${eq(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "fulfilled",
      updated_at: new Date().toISOString(),
    }),
  });
  return getAdminOrder(id);
}

export async function cancelAdminOrder(
  id: string,
  input: { restock?: boolean } = {},
) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(id)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  if (order.status === "cancelled") {
    throw new CommerceValidationError("Order is already cancelled");
  }

  if (input.restock !== false) {
    const lines = await loadLines(id);
    for (const line of lines) {
      if (!line.variant_id) continue;
      const variant = await getVariant(line.variant_id);
      if (!variant) continue;
      await setVariantInventory(
        line.variant_id,
        variant.inventory_quantity + line.quantity,
      );
    }
  }

  await supabaseRequest(`orders?id=${eq(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }),
  });
  return getAdminOrder(id);
}

export async function markAdminOrderPaid(id: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(id)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  if (order.status === "cancelled") {
    throw new CommerceValidationError("Cancelled orders cannot be marked paid");
  }
  await supabaseRequest(`orders?id=${eq(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      payment_status: "paid",
      updated_at: new Date().toISOString(),
    }),
  });
  return getAdminOrder(id);
}

export async function refundAdminOrder(id: string) {
  const orders = await supabaseRequest<OrderRow[]>(
    `orders?id=${eq(id)}&select=*&limit=1`,
  );
  const order = orders[0];
  if (!order) throw new CommerceNotFoundError("Order not found");
  if (order.payment_status !== "paid") {
    throw new CommerceValidationError("Only paid orders can be refunded");
  }
  await supabaseRequest(`orders?id=${eq(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      payment_status: "refunded",
      updated_at: new Date().toISOString(),
    }),
  });
  return getAdminOrder(id);
}
