import {
  pgEnum,
  pgTable,
  real,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { splitTypeArr } from "@/common/enums";

import groupModel from "./group.model";
import userModel from "./user.model";

export const splitTypeEnum = pgEnum("splitType", splitTypeArr);

const settlementModel = pgTable("settlement", {
  id: varchar({ length: 60 })
    .$defaultFn(() => Bun.randomUUIDv7())
    .primaryKey()
    .notNull(),
  payerId: varchar({ length: 60 })
    .notNull()
    .references(() => userModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  receiverId: varchar({ length: 60 })
    .notNull()
    .references(() => userModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  groupId: varchar({ length: 60 }).references(() => groupModel.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  amount: real().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

// Schema for selecting/inserting a settlement
export const selectSettlementSchema = createSelectSchema(settlementModel, {
  id: schema => schema.id.describe("Unique identifier for the settlement"),
  payerId: schema =>
    schema.payerId.describe("Reference to the user who is payer"),
  receiverId: schema =>
    schema.payerId.describe("Reference to the user who ower "),
  groupId: schema =>
    schema.groupId.describe(
      "Reference to the group the settlement belongs to",
    ),
  amount: schema => schema.amount.describe("Amount of the settlement"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the settlement was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the settlement was last updated"),
});

export const insertSettlementSchema = createInsertSchema(settlementModel, {
  id: schema => schema.id.describe("Unique identifier for the settlement"),
  payerId: schema =>
    schema.payerId.describe("Reference to the user who is payer"),
  receiverId: schema =>
    schema.payerId.describe("Reference to the user who is ower "),
  groupId: schema =>
    schema.groupId.describe(
      "Reference to the group the settlement belongs to",
    ),
  amount: schema => schema.amount.describe("Amount of the settlement"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the settlement was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the settlement was last updated"),
});

export type TSelectExpenseSchema = z.infer<typeof selectSettlementSchema>;
export type TInsertExpenseSchema = z.infer<typeof insertSettlementSchema>;

export default settlementModel;
