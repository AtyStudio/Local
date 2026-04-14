import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: text("target_type", { enum: ["listing", "user"] }).notNull(),
  listingId: integer("listing_id").references(() => listingsTable.id, { onDelete: "cascade" }),
  reportedUserId: integer("reported_user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason", {
    enum: ["scam", "fake_listing", "fake_profile", "spam", "harassment", "unsafe", "other"],
  }).notNull(),
  details: text("details"),
  status: text("status", { enum: ["open", "reviewed", "resolved"] }).notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
