import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storefrontRouter from "./storefront";
import assistantRouter from "./assistant";
import cartRouter from "./cart";
import accountRouter from "./account";
import adminRouter from "./admin";
import adminCommerceRouter from "./admin-commerce";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storefrontRouter);
router.use(assistantRouter);
router.use(cartRouter);
router.use(accountRouter);
router.use(adminRouter);
router.use(adminCommerceRouter);

export default router;
