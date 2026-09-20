import { clerkClient } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  DeleteWishlistItemQueryParams,
  GetCustomerProfileResponse,
  GetCustomerOrderParams,
  GetCustomerOrderResponse,
  ListCustomerOrdersResponse,
  ListRecentlyViewedItemsResponse,
  ListWishlistItemsResponse,
  SaveRecentlyViewedItemBody,
  SaveRecentlyViewedItemResponse,
  SaveWishlistItemBody,
  SaveWishlistItemResponse,
  UpdateCustomerProfileBody,
  UpdateCustomerProfileResponse,
} from "@workspace/api-zod";
import {
  deleteWishlist,
  getOrCreateProfile,
  listRecentlyViewed,
  listWishlist,
  saveRecentlyViewed,
  saveWishlist,
  updateProfile,
} from "../lib/customer-repository";
import {
  getCustomerOrder,
  listCustomerOrders,
} from "../lib/order-repository";
import {
  CommerceNotFoundError,
} from "../lib/commerce-repository";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middlewares/auth";

const router: IRouter = Router();
router.use("/account", requireAuth);

const authUserId = (req: Request): string =>
  (req as unknown as AuthenticatedRequest).authUserId;

async function getVerifiedPrimaryEmail(
  req: Request,
  res: Response,
): Promise<string | null> {
  const user = await clerkClient.users.getUser(authUserId(req));
  const primaryEmailAddress = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  if (!primaryEmailAddress?.emailAddress) {
    res.status(422).json({
      error: "The authenticated user has no primary email",
      code: "PRIMARY_EMAIL_REQUIRED",
    });
    return null;
  }
  if (primaryEmailAddress.verification?.status !== "verified") {
    res.status(422).json({
      error: "The authenticated user's primary email is not verified",
      code: "PRIMARY_EMAIL_VERIFICATION_REQUIRED",
    });
    return null;
  }
  return primaryEmailAddress.emailAddress;
}

router.get("/account/profile", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile(authUserId(req));
  res.json(GetCustomerProfileResponse.parse(profile));
});

router.post("/account/login", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile(authUserId(req));
  res.json(GetCustomerProfileResponse.parse(profile));
});

router.post("/account/sign-in", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile(authUserId(req));
  res.json(GetCustomerProfileResponse.parse(profile));
});

router.put("/account/profile", async (req, res): Promise<void> => {
  const input = UpdateCustomerProfileBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  const profile = await updateProfile(
    authUserId(req),
    input.data,
  );
  res.json(UpdateCustomerProfileResponse.parse(profile));
});

router.get("/account/wishlist", async (req, res): Promise<void> => {
  const items = await listWishlist(authUserId(req));
  res.json(ListWishlistItemsResponse.parse(items));
});

router.post("/account/wishlist", async (req, res): Promise<void> => {
  const input = SaveWishlistItemBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  const item = await saveWishlist(
    authUserId(req),
    input.data,
  );
  res.json(SaveWishlistItemResponse.parse(item));
});

router.delete(
    "/account/wishlist",
  async (req, res): Promise<void> => {
    const params = DeleteWishlistItemQueryParams.safeParse(req.query);
    if (!params.success) {
      res
        .status(400)
        .json({ error: params.error.message, code: "INVALID_REQUEST" });
      return;
    }
    await deleteWishlist(
      authUserId(req),
      params.data.productId,
    );
    res.sendStatus(204);
  },
);

router.get("/account/recently-viewed", async (req, res): Promise<void> => {
  const items = await listRecentlyViewed(authUserId(req));
  res.json(ListRecentlyViewedItemsResponse.parse(items));
});

router.post("/account/recently-viewed", async (req, res): Promise<void> => {
  const input = SaveRecentlyViewedItemBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  const item = await saveRecentlyViewed(
    authUserId(req),
    input.data,
  );
  res.json(SaveRecentlyViewedItemResponse.parse(item));
});

router.get("/account/orders", async (req, res): Promise<void> => {
  try {
    const orders = await listCustomerOrders(authUserId(req));
    res.json(ListCustomerOrdersResponse.parse(orders));
  } catch (error) {
    req.log.error({ err: error }, "Customer orders unavailable");
    res.status(503).json({
      error: "Orders are temporarily unavailable",
      code: "COMMERCE_UNAVAILABLE",
    });
  }
});

router.get("/account/orders/:orderId", async (req, res): Promise<void> => {
  const params = GetCustomerOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({
      error: params.error.message,
      code: "INVALID_REQUEST",
    });
    return;
  }

  try {
    const order = await getCustomerOrder(authUserId(req), params.data.orderId);
    res.json(GetCustomerOrderResponse.parse(order));
  } catch (error) {
    if (error instanceof CommerceNotFoundError) {
      res.status(404).json({
        error: "Order not found",
        code: "ORDER_NOT_FOUND",
      });
      return;
    }
    req.log.error({ err: error }, "Customer order detail unavailable");
    res.status(503).json({
      error: "Orders are temporarily unavailable",
      code: "COMMERCE_UNAVAILABLE",
    });
  }
});

export default router;