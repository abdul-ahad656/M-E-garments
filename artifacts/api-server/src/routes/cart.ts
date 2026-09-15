import { Router, type IRouter } from "express";
import {
  AddCartLineBody,
  AddCartLineResponse,
  CreateCartBody,
  CreateCartResponse,
  GetCartQueryParams,
  GetCartResponse,
  RemoveCartLineBody,
  RemoveCartLineResponse,
  UpdateCartLineBody,
  UpdateCartLineResponse,
} from "@workspace/api-zod";
import {
  addShopifyCartLine,
  createShopifyCart,
  getShopifyCart,
  removeShopifyCartLine,
  ShopifyInputError,
  updateShopifyCartLine,
} from "../lib/shopify";

const router: IRouter = Router();

function sendCartError(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  res: Parameters<Parameters<IRouter["post"]>[1]>[1],
  error: unknown,
): void {
  if (error instanceof ShopifyInputError) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  req.log.error({ err: error }, "Shopify cart operation failed");
  res.status(503).json({
    error: "The Shopify cart is temporarily unavailable.",
    code: "SHOPIFY_UNAVAILABLE",
  });
}

router.post("/storefront/cart", async (req, res): Promise<void> => {
  const parsed = CreateCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  try {
    const cart = await createShopifyCart(
      parsed.data.merchandiseId,
      parsed.data.quantity ?? 1,
    );
    res.status(201).json(CreateCartResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

router.get("/storefront/cart", async (req, res): Promise<void> => {
  const query = GetCartQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid cart ID.", code: "INVALID_CART_ID" });
    return;
  }
  try {
    const cart = await getShopifyCart(query.data.cartId);
    if (!cart) {
      res.status(404).json({ error: "Cart not found.", code: "CART_NOT_FOUND" });
      return;
    }
    res.json(GetCartResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

router.post("/storefront/cart/lines", async (req, res): Promise<void> => {
  const parsed = AddCartLineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  try {
    const cart = await addShopifyCartLine(
      parsed.data.cartId,
      parsed.data.merchandiseId,
      parsed.data.quantity ?? 1,
    );
    res.json(AddCartLineResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

router.patch("/storefront/cart/lines", async (req, res): Promise<void> => {
  const parsed = UpdateCartLineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  try {
    const cart = await updateShopifyCartLine(
      parsed.data.cartId,
      parsed.data.lineId,
      parsed.data.quantity,
    );
    res.json(UpdateCartLineResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

router.post("/storefront/cart/lines/remove", async (req, res): Promise<void> => {
  const parsed = RemoveCartLineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  try {
    const cart = await removeShopifyCartLine(
      parsed.data.cartId,
      parsed.data.lineId,
    );
    res.json(RemoveCartLineResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

export default router;