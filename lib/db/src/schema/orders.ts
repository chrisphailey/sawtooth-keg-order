import { pgTable, serial, text, boolean, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { beersTable } from "./beers";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  pickupDate: text("pickup_date").notNull(),
  pickupTime: text("pickup_time").notNull(),
  beerId: integer("beer_id").notNull().references(() => beersTable.id),
  beerName: text("beer_name").notNull(),
  kegSize: text("keg_size").notNull(),
  quantity: integer("quantity").notNull().default(1),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull().default("30.00"),
  partyTapNeeded: boolean("party_tap_needed").notNull().default(false),
  co2Needed: boolean("co2_needed").notNull().default(false),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  cloverPaymentId: text("clover_payment_id"),
  cloverIdempotencyKey: text("clover_idempotency_key"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentError: text("payment_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
