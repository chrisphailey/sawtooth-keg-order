import { Router, type IRouter } from "express";
import { db, paymentAuthorizationsTable } from "@workspace/db";
import { AuthorizePaymentBody } from "@workspace/api-zod";
import { authorizePayment } from "../lib/clover";

const router: IRouter = Router();

router.post("/payments/authorize", async (req, res): Promise<void> => {
  const parsed = AuthorizePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await authorizePayment({
      amount: parsed.data.amount,
      source: parsed.data.source,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    const [auth] = await db
      .insert(paymentAuthorizationsTable)
      .values({
        cloverPaymentId: result.id,
        amount: parsed.data.amount,
        status: result.status,
        idempotencyKey: parsed.data.idempotencyKey,
        orderId: parsed.data.orderId ?? null,
        rawResponse: result.rawResponse,
      })
      .onConflictDoUpdate({
        target: paymentAuthorizationsTable.idempotencyKey,
        set: {
          status: result.status,
          rawResponse: result.rawResponse,
        },
      })
      .returning();

    res.json({
      id: auth.id,
      cloverPaymentId: auth.cloverPaymentId,
      amount: auth.amount,
      status: auth.status,
      idempotencyKey: auth.idempotencyKey,
      orderId: auth.orderId,
      createdAt: auth.createdAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment authorization failed";
    req.log.error({ err }, "Payment authorization failed");
    res.status(400).json({ error: message });
  }
});

export default router;
