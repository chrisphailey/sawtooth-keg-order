import { Router, type IRouter } from "express";
import { desc, sql } from "drizzle-orm";
import { db, ordersTable, pickupScheduleTable } from "@workspace/db";
import { GetRecentOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable);
  const today = new Date().toISOString().slice(0, 10);

  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const confirmedOrders = orders.filter((o) => o.status === "confirmed").length;
  const completedOrders = orders.filter((o) => o.status === "completed").length;
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === "captured")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const pendingRevenue = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const pickups = await db.select().from(pickupScheduleTable);
  const upcomingPickups = pickups.filter(
    (p) => p.status === "scheduled" && p.pickupDate >= today,
  ).length;
  const todayPickups = pickups.filter(
    (p) => p.status === "scheduled" && p.pickupDate === today,
  ).length;

  res.json({
    totalOrders,
    pendingOrders,
    confirmedOrders,
    completedOrders,
    totalRevenue,
    pendingRevenue,
    upcomingPickups,
    todayPickups,
  });
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetRecentOrdersQueryParams.safeParse(req.query);
  const limit = parsed.success && parsed.data.limit ? parsed.data.limit : 10;

  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  res.json(
    orders.map((o) => ({
      ...o,
      depositAmount: Number(o.depositAmount),
      totalAmount: Number(o.totalAmount),
    })),
  );
});

export default router;
