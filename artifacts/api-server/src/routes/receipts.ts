import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, kegReceiptsTable, ordersTable } from "@workspace/db";
import {
  GetKegReceiptParams,
  CreateOrUpdateKegReceiptParams,
  CreateOrUpdateKegReceiptBody,
  SaveReceiptSignatureParams,
  SaveReceiptSignatureBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function serializeReceipt(receipt: typeof kegReceiptsTable.$inferSelect) {
  return {
    ...receipt,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
  };
}

router.get("/receipts/:orderId", requireAuth, async (req, res): Promise<void> => {
  const params = GetKegReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [receipt] = await db
    .select()
    .from(kegReceiptsTable)
    .where(eq(kegReceiptsTable.orderId, params.data.orderId));

  if (!receipt) {
    res.status(404).json({ error: "Receipt not found" });
    return;
  }

  res.json(serializeReceipt(receipt));
});

router.post("/receipts/:orderId", requireAuth, async (req, res): Promise<void> => {
  const params = CreateOrUpdateKegReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateOrUpdateKegReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify order exists
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.orderId));

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // Upsert receipt
  const existing = await db
    .select()
    .from(kegReceiptsTable)
    .where(eq(kegReceiptsTable.orderId, params.data.orderId));

  let receipt;
  if (existing.length > 0) {
    const [updated] = await db
      .update(kegReceiptsTable)
      .set(parsed.data)
      .where(eq(kegReceiptsTable.orderId, params.data.orderId))
      .returning();
    receipt = updated;
  } else {
    const [created] = await db
      .insert(kegReceiptsTable)
      .values({
        orderId: params.data.orderId,
        ...parsed.data,
      })
      .returning();
    receipt = created;
  }

  res.json(serializeReceipt(receipt));
});

router.post("/receipts/:orderId/signature", requireAuth, async (req, res): Promise<void> => {
  const params = SaveReceiptSignatureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SaveReceiptSignatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(kegReceiptsTable)
    .where(eq(kegReceiptsTable.orderId, params.data.orderId));

  if (existing.length === 0) {
    res.status(404).json({ error: "Receipt not found — create the receipt first" });
    return;
  }

  const [receipt] = await db
    .update(kegReceiptsTable)
    .set({
      customerSignature: parsed.data.customerSignature,
      signedAt: parsed.data.signedAt,
      completed: true,
    })
    .where(eq(kegReceiptsTable.orderId, params.data.orderId))
    .returning();

  res.json(serializeReceipt(receipt));
});

export default router;
