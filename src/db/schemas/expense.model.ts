import {
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { splitTypeArr } from "@/common/enums";

import categoryModel from "./category.model";
import groupModel from "./group.model";
import userModel from "./user.model";

export const splitTypeEnum = pgEnum("splitType", splitTypeArr);

const expenseModel = pgTable("expense", {
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
  creatorId: varchar({ length: 60 })
    .notNull()
    .references(() => userModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  categoryId: varchar({ length: 60 }).references(() => categoryModel.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  groupId: varchar({ length: 60 }).references(() => groupModel.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  amount: real().notNull(),
  currency: varchar({ length: 3 }).notNull(),
  splitType: splitTypeEnum("split_type"),
  description: text(),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

// Schema for selecting/inserting a expense
export const selectExpenseSchema = createSelectSchema(expenseModel, {
  id: schema => schema.id.describe("Unique identifier for the expense"),
  payerId: schema =>
    schema.payerId.describe("Reference to the user who paid for the expense"),
  creatorId: schema =>
    schema.creatorId.describe("Reference to the user who created the expense"),
  categoryId: schema =>
    schema.categoryId.describe("Reference to the category of the expense"),
  groupId: schema =>
    schema.groupId.describe(
      "Reference to the group the expense belongs to (optional)",
    ),
  amount: schema => schema.amount.describe("Amount of the expense"),
  currency: schema =>
    schema.currency.describe("Three-letter currency code (e.g., USD, INR)"),
  splitType: schema =>
    schema.splitType.describe(
      "Type of split applied to the expense (equal, percentage, etc)",
    ),
  description: schema =>
    schema.description.describe("Additional details about the expense"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the expense was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the expense was last updated"),
});
export const insertExpenseSchema = createInsertSchema(expenseModel, {
  id: schema => schema.id.describe("Unique identifier for the expense"),
  payerId: schema =>
    schema.payerId.describe("Reference to the user who paid for the expense. (Note: For admin users, this field is required.)"),
  categoryId: schema =>
    schema.categoryId.describe("Reference to the category of the expense"),
  groupId: schema =>
    schema.groupId.describe(
      "Reference to the group the expense belongs to (optional)",
    ),
  amount: schema => schema.amount.describe("Amount of the expense"),
  currency: schema =>
    schema.currency.describe("Three-letter currency code (e.g., USD, INR)"),
  splitType: schema =>
    schema.splitType.describe(
      "Type of split applied to the expense (equal, percentage, etc)",
    ),
  description: schema =>
    schema.description.describe("Additional details about the expense"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the expense was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the expense was last updated"),
});

export type TSelectExpenseSchema = z.infer<typeof selectExpenseSchema>;
export type TInsertExpenseSchema = z.infer<typeof insertExpenseSchema>;

export default expenseModel;
