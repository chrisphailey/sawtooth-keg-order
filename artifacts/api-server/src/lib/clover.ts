import { logger } from "./logger";

const CLOVER_API_BASE = process.env.CLOVER_API_BASE ?? "https://sandbox.dev.clover.com";
const CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID ?? "";
const CLOVER_API_TOKEN = process.env.CLOVER_API_TOKEN ?? "";

interface CloverPaymentResult {
  id: string;
  amount: number;
  status: string;
  rawResponse: string;
}

interface CloverCaptureResult {
  id: string;
  amount: number;
  status: string;
}

export async function authorizePayment(opts: {
  amount: number;
  source: string;
  idempotencyKey: string;
}): Promise<CloverPaymentResult> {
  if (!CLOVER_MERCHANT_ID || !CLOVER_API_TOKEN) {
    logger.warn("Clover credentials not configured, using mock authorization");
    return {
      id: `mock_auth_${Date.now()}`,
      amount: opts.amount,
      status: "AUTH",
      rawResponse: JSON.stringify({ mock: true }),
    };
  }

  const url = `${CLOVER_API_BASE}/v1/merchants/${CLOVER_MERCHANT_ID}/charges`;

  const body = {
    amount: opts.amount,
    currency: "usd",
    capture: false,
    source: opts.source,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLOVER_API_TOKEN}`,
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Clover authorization failed");
    throw new Error(
      (data.message as string) ?? `Clover authorization failed: ${response.status}`,
    );
  }

  return {
    id: data.id as string,
    amount: data.amount as number,
    status: data.status as string,
    rawResponse: JSON.stringify(data),
  };
}

export async function capturePayment(opts: {
  paymentId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<CloverCaptureResult> {
  if (!CLOVER_MERCHANT_ID || !CLOVER_API_TOKEN) {
    logger.warn("Clover credentials not configured, using mock capture");
    return {
      id: opts.paymentId,
      amount: opts.amount,
      status: "CAPTURED",
    };
  }

  const url = `${CLOVER_API_BASE}/v1/merchants/${CLOVER_MERCHANT_ID}/charges/${opts.paymentId}/capture`;

  const body = { amount: opts.amount };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLOVER_API_TOKEN}`,
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Clover capture failed");
    throw new Error(
      (data.message as string) ?? `Clover capture failed: ${response.status}`,
    );
  }

  return {
    id: data.id as string,
    amount: data.amount as number,
    status: data.status as string,
  };
}

interface CloverRefundResult {
  id: string;
  amount: number;
  status: string;
}

export async function refundPayment(opts: {
  paymentId: string;
  amount: number;
  idempotencyKey: string;
}): Promise<CloverRefundResult> {
  if (!CLOVER_MERCHANT_ID || !CLOVER_API_TOKEN) {
    logger.warn("Clover credentials not configured, using mock refund");
    return {
      id: `mock_refund_${Date.now()}`,
      amount: opts.amount,
      status: "REFUNDED",
    };
  }

  const url = `${CLOVER_API_BASE}/v1/merchants/${CLOVER_MERCHANT_ID}/refunds`;

  const body = {
    charge: opts.paymentId,
    amount: opts.amount,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CLOVER_API_TOKEN}`,
      "Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    logger.error({ status: response.status, data }, "Clover refund failed");
    throw new Error(
      (data.message as string) ?? `Clover refund failed: ${response.status}`,
    );
  }

  return {
    id: data.id as string,
    amount: data.amount as number,
    status: data.status as string,
  };
}
