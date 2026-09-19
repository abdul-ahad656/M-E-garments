import { Router, type IRouter } from "express";
import {
  AdjustAdminInventoryBody,
  AdjustAdminInventoryResponse,
  CancelAdminOrderBody,
  CancelAdminOrderParams,
  CancelAdminOrderResponse,
  CreateAdminProductBody,
  CreateAdminProductResponse,
  DeleteAdminProductParams,
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
  MarkAdminOrderPaidParams,
  MarkAdminOrderPaidResponse,
  RefundAdminOrderBody,
  RefundAdminOrderParams,
  RefundAdminOrderResponse,
  UpdateAdminProductBody,
  UpdateAdminProductParams,
  UpdateAdminProductResponse,
  UploadAdminMediaResponse,
} from "@workspace/api-zod";
import multer from "multer";
import type { RequestHandler } from "express";
import {
  adjustAdminInventory,
  CommerceNotFoundError,
  CommerceValidationError,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  listAdminInventory,
  listAdminProducts,
  updateAdminProduct,
} from "../lib/commerce-repository";
import {
  cancelAdminOrder,
  fulfillAdminOrder,
  getAdminOrder,
  listAdminOrders,
  markAdminOrderPaid,
  refundAdminOrder,
} from "../lib/order-repository";
import {
  R2_MAX_FILE_BYTES,
  R2_MAX_FILES,
  R2NotConfiguredError,
  R2UploadError,
  R2ValidationError,
  uploadProductImages,
} from "../lib/r2";
import { requireStaff } from "../middlewares/auth";

const router: IRouter = Router();
router.use("/admin", requireStaff);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: R2_MAX_FILES,
    fileSize: R2_MAX_FILE_BYTES,
  },
});

const parseMediaUpload: RequestHandler = (req, res, next) => {
  mediaUpload.array("files", R2_MAX_FILES)(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `Each image must be at most ${R2_MAX_FILE_BYTES / (1024 * 1024)}MB`
          : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
            ? `At most ${R2_MAX_FILES} images can be uploaded at once`
            : error.message;
      res.status(400).json({ error: message, code: "INVALID_REQUEST" });
      return;
    }
    next(error);
  });
};

function handleCommerceError(
  res: import("express").Response,
  req: import("express").Request,
  error: unknown,
  unavailableMessage: string,
): void {
  if (error instanceof CommerceValidationError) {
    res.status(422).json({ error: error.message, code: "VALIDATION_ERROR" });
    return;
  }
  if (error instanceof CommerceNotFoundError) {
    res.status(404).json({ error: error.message, code: "NOT_FOUND" });
    return;
  }
  req.log.error({ err: error }, unavailableMessage);
  res.status(503).json({
    error: unavailableMessage,
    code: "COMMERCE_UNAVAILABLE",
  });
}

router.post("/admin/media/upload", parseMediaUpload, async (req, res): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const urls = await uploadProductImages(
      files.map((file) => ({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        size: file.size,
      })),
    );
    res.json(UploadAdminMediaResponse.parse({ urls }));
  } catch (error) {
    if (error instanceof R2ValidationError) {
      res.status(400).json({ error: error.message, code: "INVALID_REQUEST" });
      return;
    }
    if (error instanceof R2NotConfiguredError) {
      res.status(503).json({ error: error.message, code: "R2_NOT_CONFIGURED" });
      return;
    }
    if (error instanceof R2UploadError) {
      req.log.error({ err: error }, "Cloudflare R2 media upload failed");
      res.status(503).json({
        error: "Cloudflare R2 media upload is unavailable",
        code: "R2_UNAVAILABLE",
      });
      return;
    }
    throw error;
  }
});

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
    handleCommerceError(res, req, error, "Product list is unavailable");
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
    handleCommerceError(res, req, error, "Product create is unavailable");
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
    handleCommerceError(res, req, error, "Product lookup is unavailable");
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
    handleCommerceError(res, req, error, "Product update is unavailable");
  }
});

router.delete("/admin/products/:id", async (req, res): Promise<void> => {
  const params = DeleteAdminProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    await deleteAdminProduct(params.data.id);
    res.sendStatus(204);
  } catch (error) {
    handleCommerceError(res, req, error, "Product delete is unavailable");
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
    handleCommerceError(res, req, error, "Inventory list is unavailable");
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
    handleCommerceError(res, req, error, "Inventory adjust is unavailable");
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
    handleCommerceError(res, req, error, "Order list is unavailable");
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
    handleCommerceError(res, req, error, "Order lookup is unavailable");
  }
});

router.post("/admin/orders/:id/fulfill", async (req, res): Promise<void> => {
  const params = FulfillAdminOrderParams.safeParse(req.params);
  const input = FulfillAdminOrderBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await fulfillAdminOrder(params.data.id);
    res.json(FulfillAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Fulfillment is unavailable");
  }
});

router.post("/admin/orders/:id/refund", async (req, res): Promise<void> => {
  const params = RefundAdminOrderParams.safeParse(req.params);
  const input = RefundAdminOrderBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await refundAdminOrder(params.data.id);
    res.json(RefundAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Refund is unavailable");
  }
});

router.post("/admin/orders/:id/mark-paid", async (req, res): Promise<void> => {
  const params = MarkAdminOrderPaidParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await markAdminOrderPaid(params.data.id);
    res.json(MarkAdminOrderPaidResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Mark paid is unavailable");
  }
});

router.post("/admin/orders/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelAdminOrderParams.safeParse(req.params);
  const input = CancelAdminOrderBody.safeParse(req.body ?? {});
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "INVALID_REQUEST" });
    return;
  }
  if (!input.success) {
    res.status(400).json({ error: input.error.message, code: "INVALID_REQUEST" });
    return;
  }
  try {
    const order = await cancelAdminOrder(params.data.id, {
      restock: input.data.restock,
    });
    res.json(CancelAdminOrderResponse.parse(order));
  } catch (error) {
    handleCommerceError(res, req, error, "Cancel is unavailable");
  }
});

export default router;
