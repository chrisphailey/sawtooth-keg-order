import { Router, type IRouter } from "express";
import healthRouter from "./health";
import beersRouter from "./beers";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import pickupRouter from "./pickup";
import receiptsRouter from "./receipts";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(beersRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(pickupRouter);
router.use(receiptsRouter);
router.use(dashboardRouter);

export default router;
