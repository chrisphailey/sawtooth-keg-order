import { randomUUID } from "crypto";
import { Router, type IRouter } from "express";
import { eq, desc, inArray } from "drizzle-orm";
import { db, ordersTable, beersTable, pickupScheduleTable, paymentAuthorizationsTable, kegReceiptsTable, orderItemsTable } from "@workspace/db";
import {
  ListOrdersQueryParams,
  CreateOrderBody,
  GetOrderParams,
  UpdateOrderParams,
  UpdateOrderBody,
  ConfirmOrderParams,
  CancelOrderParams,
  ReturnOrderParams,
  SubmitCustomerReceiptParams,
  SubmitCustomerReceiptBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { capturePayment, refundPayment } from "../lib/clover";
import { sendOrderConfirmationEmails } from "../lib/email";

interface OrderAddon {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const router: IRouter = Router();

function serializeOrder(order: typeof ordersTable.$inferSelect) {
  const { customerToken: _omit, addons, ...rest } = order;
  return {
    ...rest,
    depositAmount: Number(order.depositAmount),
    totalAmount: Number(order.totalAmount),
    addons: (addons as OrderAddon[] | null) ?? [],
  };
}

async function getOrderItems(orderIds: number[]) {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.orderId, orderIds));
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  const query = db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));

  const orders = await query;
  const filtered =
    parsed.success && parsed.data.status
      ? orders.filter((o) => o.status === parsed.data.status)
      : orders;

  const orderIds = filtered.map((o) => o.id);
  const allItems = await getOrderItems(orderIds);

  res.json(
    filtered.map((o) => ({
      ...serializeOrder(o),
      items: allItems
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
    }))
  );
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items, addons: addonsData, pouringMethod: pouringMethodRaw, ...rest } = parsed.data;

  // Look up all beers
  const beerIds = [...new Set(items.map((i) => i.beerId))];
  const beers = await db.select().from(beersTable).where(inArray(beersTable.id, beerIds));
  const beerMap = new Map(beers.map((b) => [b.id, b]));

  for (const item of items) {
    if (!beerMap.has(item.beerId)) {
      res.status(400).json({ error: `Beer with id ${item.beerId} not found` });
      return;
    }
  }

  const RENTAL_FEES: Record<string, number> = {
    "My own equipment": 0,
    "Hand Pump Party Tap rental ($10 rental)": 10,
    "CO2 Party Tap rental ($10 rental + $10 CO2 fee)": 20,
    "Jockey Box ($20 rental + $10 CO2 fee) Limited Supply": 30,
    "Draft Trailer Rental ($125/day + $10 a mile both directions)": 125,
  };

  const pouringMethod = pouringMethodRaw ?? "My own equipment";
  const rentalFee = RENTAL_FEES[pouringMethod] ?? 0;
  const partyTapNeeded = ["Hand Pump Party Tap rental ($10 rental)", "CO2 Party Tap rental ($10 rental + $10 CO2 fee)"].includes(pouringMethod);
  const co2Needed = ["CO2 Party Tap rental ($10 rental + $10 CO2 fee)", "Jockey Box ($20 rental + $10 CO2 fee) Limited Supply"].includes(pouringMethod);

  // Total keg count drives deposit: $30 per keg
  const totalKegCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const depositAmount = 30 * totalKegCount;

  // Beer total across all items
  const beerTotal = items.reduce((sum, i) => {
    const beer = beerMap.get(i.beerId)!;
    return sum + Number(beer.price) * i.quantity;
  }, 0);

  const addonsTotal = (addonsData ?? []).reduce((sum, a) => sum + a.unitPrice * a.quantity, 0);
  const totalAmount = beerTotal + depositAmount + rentalFee + addonsTotal;

  // Use first item's beer for denormalized summary fields on the order
  const firstItem = items[0];
  const firstBeer = beerMap.get(firstItem.beerId)!;
  const summaryBeerName = items.length === 1 ? firstBeer.name : "Multiple kegs";
  const summaryKegSize = items.length === 1 ? firstBeer.kegSize : "Various";

  const [order] = await db
    .insert(ordersTable)
    .values({
      customerName: rest.customerName,
      customerEmail: rest.customerEmail,
      customerPhone: rest.customerPhone,
      pickupDate: rest.pickupDate,
      pickupTime: rest.pickupTime,
      beerId: firstBeer.id,
      beerName: summaryBeerName,
      kegSize: summaryKegSize,
      quantity: totalKegCount,
      depositAmount: String(depositAmount),
      pouringMethod,
      partyTapNeeded,
      co2Needed,
      rentalFee: String(rentalFee),
      notes: rest.notes ?? null,
      addons: addonsData && addonsData.length > 0 ? addonsData : null,
      status: "pending",
      paymentStatus: "authorized",
      cloverPaymentId: rest.cloverPaymentToken,
      cloverIdempotencyKey: rest.idempotencyKey,
      totalAmount: String(totalAmount),
      customerToken: randomUUID(),
    })
    .returning();

  // Insert order items
  const insertedItems = await db
    .insert(orderItemsTable)
    .values(
      items.map((item) => {
        const beer = beerMap.get(item.beerId)!;
        return {
          orderId: order.id,
          beerId: beer.id,
          beerName: beer.name,
          kegSize: beer.kegSize,
          unitPrice: String(beer.price),
          quantity: item.quantity,
        };
      })
    )
    .returning();

  // Link the payment authorization to this order
  await db
    .update(paymentAuthorizationsTable)
    .set({ orderId: order.id })
    .where(eq(paymentAuthorizationsTable.idempotencyKey, rest.idempotencyKey));

  res.status(201).json({
    ...serializeOrder(order),
    customerToken: order.customerToken ?? "",
    items: insertedItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  });
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

  const { kegReceiptsTable: krt } = await import("@workspace/db");
  const [receipt] = await db
    .select()
    .from(krt)
    .where(eq(krt.orderId, order.id));

  const orderItems = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json({
    ...serializeOrder(order),
    items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
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

  const orderItems = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  res.json({
    ...serializeOrder(order),
    items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  });
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
    const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    res.json({ ...serializeOrder(order), items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })) });
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

    const [confirmedOrder] = await db
      .update(ordersTable)
      .set({ status: "confirmed", paymentStatus: "captured", paymentError: null })
      .where(eq(ordersTable.id, order.id))
      .returning();

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

    const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    res.json({ ...serializeOrder(confirmedOrder), items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })) });
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

router.post("/orders/:id/customer-receipt", async (req, res): Promise<void> => {
  const params = SubmitCustomerReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubmitCustomerReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

  if (!order.customerToken || parsed.data.customerToken !== order.customerToken) {
    res.status(403).json({ error: "Invalid or missing order token" });
    return;
  }

  const existing = await db
    .select()
    .from(kegReceiptsTable)
    .where(eq(kegReceiptsTable.orderId, params.data.id));

  if (existing.length > 0) {
    res.status(409).json({ error: "Receipt already submitted for this order" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const returnDate = new Date(new Date(order.pickupDate).getTime() + 7 * 86400000).toISOString().slice(0, 10);

  let receipt: typeof kegReceiptsTable.$inferSelect;
  try {
    const [inserted] = await db
      .insert(kegReceiptsTable)
      .values({
        orderId: params.data.id,
        dateOfSale: today,
        dateOfReturn: returnDate,
        purchaserName: order.customerName,
        purchaserPhone: order.customerPhone,
        consumptionDate: parsed.data.consumptionDate ?? order.pickupDate,
        kegBrand: "Sawtooth Brewery",
        kegSize: order.kegSize,
        purchaserDob: parsed.data.purchaserDob,
        consumptionLocation: parsed.data.consumptionLocation,
        consumptionTime: parsed.data.consumptionTime ?? null,
        validIdNumber: parsed.data.validIdNumber,
        vehicleYear: parsed.data.vehicleYear ?? null,
        vehicleMake: parsed.data.vehicleMake ?? null,
        vehicleColor: parsed.data.vehicleColor ?? null,
        vehiclePlate: parsed.data.vehiclePlate ?? null,
        customerSignature: parsed.data.customerSignature,
        signedAt: parsed.data.signedAt,
        submittedByCustomer: true,
        completed: true,
      })
      .returning();
    receipt = inserted;
  } catch (err: unknown) {
    const isUniqueViolation =
      typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
    if (isUniqueViolation) {
      res.status(409).json({ error: "Receipt already submitted for this order" });
      return;
    }
    throw err;
  }

  const receiptSummary = {
    consumptionLocation: parsed.data.consumptionLocation,
    consumptionDate: parsed.data.consumptionDate ?? order.pickupDate,
    consumptionTime: parsed.data.consumptionTime,
    purchaserDob: parsed.data.purchaserDob,
    validIdNumber: parsed.data.validIdNumber,
    vehicleYear: parsed.data.vehicleYear,
    vehicleMake: parsed.data.vehicleMake,
    vehicleColor: parsed.data.vehicleColor,
    vehiclePlate: parsed.data.vehiclePlate,
  };

  sendOrderConfirmationEmails(
    {
      id: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      beerName: order.beerName,
      kegSize: order.kegSize,
      quantity: order.quantity,
      pickupDate: order.pickupDate,
      pickupTime: order.pickupTime,
      pouringMethod: order.pouringMethod ?? "My own equipment",
      totalAmount: Number(order.totalAmount),
    },
    receiptSummary,
    req.log,
  ).catch((err) => req.log.error({ err }, "Failed to queue confirmation emails"));

  res.status(201).json({
    ...receipt,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  });
});

router.post("/orders/:id/return", requireAuth, async (req, res): Promise<void> => {
  const params = ReturnOrderParams.safeParse(req.params);
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

  if (order.status !== "confirmed" || order.paymentStatus !== "captured") {
    res.status(400).json({ error: "Order must be confirmed with a captured payment to process a return" });
    return;
  }

  if (!order.cloverPaymentId) {
    res.status(400).json({ error: "No payment found for this order" });
    return;
  }

  try {
    const refundIdempotencyKey = `refund_${order.id}`;
    await refundPayment({
      paymentId: order.cloverPaymentId,
      amount: Math.round(Number(order.depositAmount) * 100),
      idempotencyKey: refundIdempotencyKey,
    });

    const [returnedOrder] = await db
      .update(ordersTable)
      .set({ status: "completed", paymentStatus: "refunded", paymentError: null })
      .where(eq(ordersTable.id, order.id))
      .returning();

    const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    res.json({ ...serializeOrder(returnedOrder), items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    req.log.error({ err }, "Deposit refund failed");

    await db
      .update(ordersTable)
      .set({ paymentError: message })
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

  await db
    .update(pickupScheduleTable)
    .set({ status: "cancelled" })
    .where(eq(pickupScheduleTable.orderId, order.id));

  const orderItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json({ ...serializeOrder(order), items: orderItems.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })) });
});

export default router;
