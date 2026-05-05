import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const pickupScheduleTable = pgTable("pickup_schedule", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id).unique(),
  customerName: text("customer_name").notNull(),
  pickupDate: text("pickup_date").notNull(),
  pickupTime: text("pickup_time").notNull(),
  beerName: text("beer_name").notNull(),
  kegSize: text("keg_size").notNull(),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPickupScheduleSchema = createInsertSchema(pickupScheduleTable).omit({ id: true, createdAt: true });
export type InsertPickupSchedule = z.infer<typeof insertPickupScheduleSchema>;
export type PickupSchedule = typeof pickupScheduleTable.$inferSelect;
