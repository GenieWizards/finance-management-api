import type { SQL } from "drizzle-orm";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/adapter";
import type { TInsertSettlementSchema } from "@/db/schemas/settlement.model";
import settlementModel from "@/db/schemas/settlement.model";

export async function updateSettlementRepository(
  payload: TInsertSettlementSchema,
  settlementId: string,
) {
  const whereConditions: SQL<unknown>[] = [
    eq(settlementModel.id, settlementId),
    eq(settlementModel.senderId, payload.senderId),
    eq(settlementModel.receiverId, payload.receiverId),
  ];

  if (payload.groupId) {
    whereConditions.push(eq(settlementModel.groupId, payload.groupId));
  }

  const [settlement] = await db
    .update(settlementModel)
    .set({
      amount: payload.amount,
    })
    .where(and(...whereConditions));

  return settlement;
}
