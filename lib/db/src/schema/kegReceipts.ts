import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

export const kegReceiptsTable = pgTable("keg_receipts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id).unique(),
  dateOfSale: text("date_of_sale"),
  dateOfReturn: text("date_of_return"),
  purchaserName: text("purchaser_name"),
  purchaserDob: text("purchaser_dob"),
  purchaserPhone: text("purchaser_phone"),
  consumptionLocation: text("consumption_location"),
  consumptionTime: text("consumption_time"),
  consumptionDate: text("consumption_date"),
  validIdNumber: text("valid_id_number"),
  vehicleYear: text("vehicle_year"),
  vehicleMake: text("vehicle_make"),
  vehicleColor: text("vehicle_color"),
  vehiclePlate: text("vehicle_plate"),
  customerSignature: text("customer_signature"),
  signedAt: text("signed_at"),
  staffName: text("staff_name"),
  draftSystemNumber: text("draft_system_number"),
  co2TankNeeded: boolean("co2_tank_needed"),
  co2RegulatorNumber: text("co2_regulator_number"),
  trashCanNumbers: text("trash_can_numbers"),
  kegBrand: text("keg_brand"),
  kegSize: text("keg_size"),
  kegIdNumbers: text("keg_id_numbers"),
  submittedByCustomer: boolean("submitted_by_customer").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKegReceiptSchema = createInsertSchema(kegReceiptsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKegReceipt = z.infer<typeof insertKegReceiptSchema>;
export type KegReceipt = typeof kegReceiptsTable.$inferSelect;
