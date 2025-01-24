import { pgEnum, pgTable, real, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { splitTypeArr } from "@/common/enums";

export const splitTypeEnum = pgEnum("splitType", splitTypeArr);

const settlementModel = pgTable("settlement", {
  id: varchar({ length: 60 })
    .$defaultFn(() => Bun.randomUUIDv7())
    .primaryKey(),
  senderId: varchar({ length: 60 }).notNull(),
  receiverId: varchar({ length: 60 }).notNull(),
  groupId: varchar({ length: 60 }),
  amount: real().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Schema for selecting/inserting a settlement
export const selectSettlementSchema = createSelectSchema(settlementModel, {
  id: schema => schema.id.describe("Unique identifier for the settlement"),
  senderId: schema =>
    schema.senderId
      .min(60)
      .max(60)
      .describe("Reference to the user who is payer"),
  receiverId: schema =>
    schema.receiverId
      .min(60)
      .max(60)
      .describe("Reference to the user who is ower "),
  groupId: schema =>
    schema.groupId
      .min(60)
      .max(60)
      .describe("Reference to the group the settlement belongs to"),
  amount: schema => schema.amount.describe("Amount of the settlement"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the settlement was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the settlement was last updated"),
});

export const insertSettlementSchema = createInsertSchema(settlementModel, {
  id: schema => schema.id.describe("Unique identifier for the settlement"),
  senderId: schema =>
    schema.senderId
      .min(60)
      .max(60)
      .describe("Reference to the user who is payer"),
  receiverId: schema =>
    schema.receiverId
      .min(60)
      .max(60)
      .describe("Reference to the user who is ower "),
  groupId: schema =>
    schema.groupId
      .min(60)
      .max(60)
      .describe("Reference to the group the settlement belongs to"),
  amount: schema => schema.amount.describe("Amount of the settlement"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the settlement was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the settlement was last updated"),
});

export type TSelectSettlementSchema = z.infer<typeof selectSettlementSchema>;
export type TInsertSettlementSchema = z.infer<typeof insertSettlementSchema>;

export default settlementModel;
