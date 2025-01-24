import { and, eq, or } from "drizzle-orm";

import { db } from "@/db/adapter";
import settlementModel from "@/db/schemas/settlement.model";

export async function getUserSettlementsForGroupRepository(
  userId: string,
  groupId: string,
) {
  const settlements = await db
    .select()
    .from(settlementModel)
    .where(and(or(eq(settlementModel.senderId, userId), eq(settlementModel.receiverId, userId)), eq(settlementModel.groupId, groupId)));

  return settlements;
}
