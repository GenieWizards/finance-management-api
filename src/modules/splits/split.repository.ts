import { and, eq } from "drizzle-orm";

import { db } from "@/db/adapter";
import type { TInsertSplitSchema } from "@/db/schemas/split.model";
import splitModel from "@/db/schemas/split.model";

type TSplitPayload = Omit<TInsertSplitSchema, "id" | "createdAt" | "updatedAt">;

export async function createSplitRepository(
  payload: TSplitPayload,
) {
  const [expense] = await db
    .insert(splitModel)
    .values(payload)
    .returning();

  return expense;
}

export async function getUserSplitsByExpenseId(
  userId: string,
  expenseId: string,
) {
  const [expense] = await db
    .select()
    .from(splitModel)
    .where(and(eq(splitModel.userId, userId), eq(splitModel.expenseId, expenseId)));

  return expense;
}
