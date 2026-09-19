import { Router, type IRouter } from "express";
import {
  AddCartLineBody,
  AddCartLineResponse,
  CheckoutCartBody,
  CheckoutCartResponse,
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
  addCartLine,
  createCart,
  getCart,
  removeCartLine,
  updateCartLine,
} from "../lib/cart-repository";
import { checkoutCart } from "../lib/order-repository";
import {
  CommerceNotFoundError,
  CommerceValidationError,
} from "../lib/commerce-repository";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import { clerkClient } from "@clerk/express";

const router: IRouter = Router();

function sendCartError(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  res: Parameters<Parameters<IRouter["post"]>[1]>[1],
  error: unknown,
): void {
  if (error instanceof CommerceValidationError) {
    res.status(400).json({ error: error.message, code: "INVALID_CART_LINE" });
    return;
  }
  if (error instanceof CommerceNotFoundError) {
    res.status(404).json({ error: error.message, code: "CART_NOT_FOUND" });
    return;
  }
  req.log.error({ err: error }, "Cart operation failed");
  res.status(503).json({
    error: "The cart is temporarily unavailable.",
    code: "COMMERCE_UNAVAILABLE",
  });
}

router.post("/storefront/cart", async (req, res): Promise<void> => {
  const parsed = CreateCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid cart line.", code: "INVALID_CART_LINE" });
    return;
  }
  try {
    const cart = await createCart(
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
    const cart = await getCart(query.data.cartId);
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
    const cart = await addCartLine(
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
    const cart = await updateCartLine(
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
    const cart = await removeCartLine(parsed.data.cartId, parsed.data.lineId);
    res.json(RemoveCartLineResponse.parse(cart));
  } catch (error) {
    sendCartError(req, res, error);
  }
});

router.post(
  "/storefront/checkout",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = CheckoutCartBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
        code: "INVALID_REQUEST",
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    try {
      const user = await clerkClient.users.getUser(authReq.authUserId);
      const email =
        parsed.data.email ||
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ||
        user.emailAddresses[0]?.emailAddress;
      if (!email) {
        res.status(400).json({
          error: "A customer email is required to checkout.",
          code: "INVALID_REQUEST",
        });
        return;
      }

      const order = await checkoutCart({
        cartId: parsed.data.cartId,
        clerkUserId: authReq.authUserId,
        email,
        shippingAddress: parsed.data.shippingAddress,
        notes: parsed.data.notes,
      });
      res.status(201).json(CheckoutCartResponse.parse(order));
    } catch (error) {
      if (error instanceof CommerceValidationError) {
        res.status(422).json({ error: error.message, code: "CHECKOUT_REJECTED" });
        return;
      }
      req.log.error({ err: error }, "Checkout failed");
      res.status(503).json({
        error: "Checkout is temporarily unavailable.",
        code: "COMMERCE_UNAVAILABLE",
      });
    }
  },
);

export default router;
