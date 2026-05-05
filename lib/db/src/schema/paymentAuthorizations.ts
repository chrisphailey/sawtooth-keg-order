import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const paymentAuthorizationsTable = pgTable("payment_authorizations", {
  id: serial("id").primaryKey(),
  cloverPaymentId: text("clover_payment_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("authorized"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  orderId: integer("order_id").references(() => ordersTable.id),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentAuthorizationSchema = createInsertSchema(paymentAuthorizationsTable).omit({ id: true, createdAt: true });
export type InsertPaymentAuthorization = z.infer<typeof insertPaymentAuthorizationSchema>;
export type PaymentAuthorization = typeof paymentAuthorizationsTable.$inferSelect;
