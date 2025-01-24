import { eq } from "drizzle-orm";

import { db } from "@/db/adapter";
import splitModel from "@/db/schemas/split.model";

export async function getSplitsByExpenseIdRepository(
  expenseId: string,
) {
  const splits = await db
    .select()
    .from(splitModel)
    .where(eq(splitModel.expenseId, expenseId));

  return splits;
}
