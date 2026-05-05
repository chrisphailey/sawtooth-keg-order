import { pgTable, serial, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const beersTable = pgTable("beers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kegSize: text("keg_size").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  available: boolean("available").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBeerSchema = createInsertSchema(beersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBeer = z.infer<typeof insertBeerSchema>;
export type Beer = typeof beersTable.$inferSelect;
