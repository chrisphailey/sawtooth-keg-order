import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pickupScheduleTable } from "@workspace/db";
import { ListPickupsQueryParams, GetPickupParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/pickup", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListPickupsQueryParams.safeParse(req.query);
  const pickups = await db
    .select()
    .from(pickupScheduleTable)
    .orderBy(pickupScheduleTable.pickupDate, pickupScheduleTable.pickupTime);

  let filtered = pickups;
  if (parsed.success) {
    const { startDate, endDate } = parsed.data;
    if (startDate) {
      filtered = filtered.filter((p) => p.pickupDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((p) => p.pickupDate <= endDate);
    }
  }

  res.json(filtered);
});

router.get("/pickup/:orderId", requireAuth, async (req, res): Promise<void> => {
  const params = GetPickupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pickup] = await db
    .select()
    .from(pickupScheduleTable)
    .where(eq(pickupScheduleTable.orderId, params.data.orderId));

  if (!pickup) {
    res.status(404).json({ error: "Pickup not found" });
    return;
  }

  res.json(pickup);
});

export default router;
