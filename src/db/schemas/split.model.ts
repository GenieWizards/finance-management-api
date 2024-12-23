import {
  pgTable,
  real,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import expenseModel from "./expense.model";
import userModel from "./user.model";

const splitModel = pgTable("split", {
  id: varchar({ length: 60 })
    .$defaultFn(() => Bun.randomUUIDv7())
    .primaryKey()
    .notNull(),

  userId: varchar({ length: 60 })
    .notNull()
    .references(() => userModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  expenseId: varchar({ length: 60 })
    .notNull()
    .references(() => expenseModel.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  amount: real().notNull(),

  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

// Schema for selecting/inserting a split
export const selectSplitSchema = createSelectSchema(splitModel, {
  id: schema => schema.id.describe("Unique identifier for the split"),
  userId: schema =>
    schema.userId.describe("Reference to the user who is part of this split"),
  expenseId: schema =>
    schema.expenseId.describe("Reference to the expense being split"),
  amount: schema =>
    schema.amount.describe("Amount to be paid by this user in the split"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the split was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the split was last updated"),
});
export const insertSplitSchema = createInsertSchema(splitModel, {
  id: schema => schema.id.describe("Unique identifier for the split"),
  userId: schema =>
    schema.userId.describe("Reference to the user who is part of this split"),
  expenseId: schema =>
    schema.expenseId.describe("Reference to the expense being split"),
  amount: schema =>
    schema.amount.describe("Amount to be paid by this user in the split"),
  createdAt: schema =>
    schema.createdAt.describe("Timestamp when the split was created"),
  updatedAt: schema =>
    schema.updatedAt.describe("Timestamp when the split was last updated"),
});

export type TSelectSplitSchema = z.infer<typeof selectSplitSchema>;
export type TInsertSplitSchema = z.infer<typeof insertSplitSchema>;

export default splitModel;
