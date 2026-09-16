import { Router, type IRouter } from "express";
import {
  AdjustAdminInventoryBody,
  AdjustAdminInventoryResponse,
  CancelAdminOrderBody,
  CancelAdminOrderParams,
  CancelAdminOrderResponse,
  CreateAdminProductBody,
  CreateAdminProductResponse,
  FulfillAdminOrderBody,
  FulfillAdminOrderParams,
  FulfillAdminOrderResponse,
  GetAdminOrderParams,
  GetAdminOrderResponse,
  GetAdminProductParams,
  GetAdminProductResponse,
  ListAdminInventoryQueryParams,
  ListAdminInventoryResponse,
  ListAdminOrdersQueryParams,
  ListAdminOrdersResponse,
  ListAdminProductsQueryParams,
  ListAdminProductsResponse,
  RefundAdminOrderBody,
  RefundAdminOrderParams,
  RefundAdminOrderResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
} from "@workspace/api-zod";
import {
  adjustAdminInventory,
  cancelAdminOrder,
  createAdminProduct,
  fulfillAdminOrder,
  getAdminOrder,
  getAdminProduct,
  listAdminInventory,
  listAdminOrders,
  listAdminProducts,
  refundAdminOrder,
  updateAdminProduct,
} from "../lib/shopify-admin-commerce";
import {
  ShopifyAdminNotFoundError,
  ShopifyAdminUnavailableError,
  ShopifyAdminUserError,
} from "../lib/shopify";
import { requireStaff } from "../middlewares/auth";

const router: IRouter = Router();
router.use("/admin", requireStaff);

function handleCommerceError(
  res: import("express").Response,
  req: import("express").Request,
  error: unknown,
  unavailableMessage: string,
): void {
  if (error instanceof ShopifyAdminUserError) {
    res.status(422).json({ error: error.message, code: "SHOPIFY_USER_ERROR" });
    return;
  }
  if (error instanceof ShopifyAdminNotFoundError) {
    res.status(404).json({ error: error.message, code: "NOT_FOUND" });
    return;
  }
  if (error instanceof ShopifyAdminUnavailableError) {
    req.log.error({ err: error }, unavailableMessage);
    res.status(503).json({
      error: unavailableMessage,
      code: "SHOPIFY_UNAVAILABLE",
    });
    return;
  }
  throw error;
}

router.get("/admin/products", async (req, res): Promise<void> => {
  const query = ListAdminProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const result = await listAdminProducts({
      cursor: query.data.cursor,
      query: query.data.query,
    });
    res.json(ListAdminProductsResponse.parse(result));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin product list is unavailable");
  }
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const input = CreateAdminProductBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const product = await createAdminProduct(input.data);
    res.status(201).json(CreateAdminProductResponse.parse(product));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin product create is unavailable");
  }
});

router.get("/admin/products/:id", async (req, res): Promise<void> => {
  const params = GetAdminProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const product = await getAdminProduct(params.data.id);
    res.json(GetAdminProductResponse.parse(product));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin product lookup is unavailable");
  }
});

router.patch("/admin/products/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminProductParams.safeParse(req.params);
  const input = UpdateAdminProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const product = await updateAdminProduct(params.data.id, input.data);
    res.json(UpdateAdminProductResponse.parse(product));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin product update is unavailable");
  }
});

router.get("/admin/inventory", async (req, res): Promise<void> => {
  const query = ListAdminInventoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const result = await listAdminInventory({
      cursor: query.data.cursor,
      query: query.data.query,
    });
    res.json(ListAdminInventoryResponse.parse(result));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin inventory list is unavailable");
  }
});

router.post("/admin/inventory/adjust", async (req, res): Promise<void> => {
  const input = AdjustAdminInventoryBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const item = await adjustAdminInventory(input.data);
    res.json(AdjustAdminInventoryResponse.parse(item));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin inventory adjust is unavailable");
  }
});

router.get("/admin/orders", async (req, res): Promise<void> => {
  const query = ListAdminOrdersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const result = await listAdminOrders({
      cursor: query.data.cursor,
      query: query.data.query,
      financialStatus: query.data.financialStatus,
      fulfillmentStatus: query.data.fulfillmentStatus,
    });
    res.json(ListAdminOrdersResponse.parse(result));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin order list is unavailable");
  }
});

router.get("/admin/orders/:id", async (req, res): Promise<void> => {
  const params = GetAdminOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await getAdminOrder(params.data.id);
    res.json(GetAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin order lookup is unavailable");
  }
});

router.post("/admin/orders/:id/fulfill", async (req, res): Promise<void> => {
  const params = FulfillAdminOrderParams.safeParse(req.params);
  const input = FulfillAdminOrderBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await fulfillAdminOrder(params.data.id, input.data);
    res.json(FulfillAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin fulfillment is unavailable");
  }
});

router.post("/admin/orders/:id/refund", async (req, res): Promise<void> => {
  const params = RefundAdminOrderParams.safeParse(req.params);
  const input = RefundAdminOrderBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await refundAdminOrder(params.data.id, input.data);
    res.json(RefundAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin refund is unavailable");
  }
});

router.post("/admin/orders/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelAdminOrderParams.safeParse(req.params);
  const input = CancelAdminOrderBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await cancelAdminOrder(params.data.id, input.data);
    res.json(CancelAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Shopify Admin cancel is unavailable");
  }
});

export default router;
