import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ordersTable, beersTable, pickupScheduleTable, paymentAuthorizationsTable } from "@workspace/db";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderParams,
  UpdateOrderBody,
  ConfirmOrderParams,
  CancelOrderParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { capturePayment } from "../lib/clover";

const router: IRouter = Router();

function serializeOrder(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    depositAmount: Number(order.depositAmount),
    totalAmount: Number(order.totalAmount),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  let query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));

  const orders = await query;
  const filtered =
    parsed.success && parsed.data.status
      ? orders.filter((o) => o.status === parsed.data.status)
      : orders;

  res.json(filtered.map(serializeOrder));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [beer] = await db
    .select()
    .from(beersTable)
    .where(eq(beersTable.id, parsed.data.beerId));

  if (!beer) {
    res.status(400).json({ error: "Beer not found" });
    return;
  }

  const depositAmount = 30;
  const beerTotal = Number(beer.price) * parsed.data.quantity;
  const totalAmount = beerTotal + depositAmount;

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      pickupDate: parsed.data.pickupDate,
      pickupTime: parsed.data.pickupTime,
      beerId: parsed.data.beerId,
      beerName: beer.name,
      kegSize: beer.kegSize,
      quantity: parsed.data.quantity,
      depositAmount: String(depositAmount),
      partyTapNeeded: parsed.data.partyTapNeeded,
      co2Needed: parsed.data.co2Needed,
      notes: parsed.data.notes ?? null,
      status: "pending",
      paymentStatus: "authorized",
      cloverPaymentId: parsed.data.cloverPaymentToken,
      cloverIdempotencyKey: parsed.data.idempotencyKey,
      totalAmount: String(totalAmount),
    })
    .returning();

  // Link the payment authorization to this order
  await db
    .update(paymentAuthorizationsTable)
    .set({ orderId: order.id })
    .where(eq(paymentAuthorizationsTable.idempotencyKey, parsed.data.idempotencyKey));

  res.status(201).json(serializeOrder(order));
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [pickup] = await db
    .select()
    .from(pickupScheduleTable)
    .where(eq(pickupScheduleTable.orderId, order.id));

  const { kegReceiptsTable } = await import("@workspace/db");
  const [receipt] = await db
    .select()
    .from(kegReceiptsTable)
    .where(eq(kegReceiptsTable.orderId, order.id));

  res.json({
    ...serializeOrder(order),
    pickup: pickup ?? null,
    receipt: receipt ?? null,
  });
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set(parsed.data)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(serializeOrder(order));
});

router.post("/orders/:id/confirm", requireAuth, async (req, res): Promise<void> => {
  const params = ConfirmOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status === "confirmed") {
    res.json(serializeOrder(order));
    return;
  }

  if (!order.cloverPaymentId) {
    res.status(400).json({ error: "No payment authorization found for this order" });
    return;
  }

  try {
    const captureIdempotencyKey = `capture_${order.id}_${Date.now()}`;
    await capturePayment({
      paymentId: order.cloverPaymentId,
      amount: Math.round(Number(order.totalAmount) * 100),
      idempotencyKey: captureIdempotencyKey,
    });

    // Mark order confirmed, create pickup
    const [confirmedOrder] = await db
      .update(ordersTable)
      .set({ status: "confirmed", paymentStatus: "captured", paymentError: null })
      .where(eq(ordersTable.id, order.id))
      .returning();

    // Upsert pickup schedule
    const existingPickup = await db
      .select()
      .from(pickupScheduleTable)
      .where(eq(pickupScheduleTable.orderId, order.id));

    if (existingPickup.length === 0) {
      await db.insert(pickupScheduleTable).values({
        orderId: order.id,
        customerName: order.customerName,
        pickupDate: order.pickupDate,
        pickupTime: order.pickupTime,
        beerName: order.beerName,
        kegSize: order.kegSize,
        quantity: order.quantity,
        status: "scheduled",
      });
    }

    res.json(serializeOrder(confirmedOrder));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment capture failed";
    req.log.error({ err }, "Payment capture failed");

    await db
      .update(ordersTable)
      .set({ paymentStatus: "failed", paymentError: message })
      .where(eq(ordersTable.id, order.id));

    res.status(400).json({ error: message });
  }
});

router.post("/orders/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const params = CancelOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .update(ordersTable)
    .set({ status: "cancelled" })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // Cancel pickup if exists
  await db
    .update(pickupScheduleTable)
    .set({ status: "cancelled" })
    .where(eq(pickupScheduleTable.orderId, order.id));

  res.json(serializeOrder(order));
});

export default router;
