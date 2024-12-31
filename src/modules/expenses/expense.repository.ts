import { AuthRoles } from "@/common/enums";
import { conflictUpdateSet } from "@/common/helpers/drizzel.helpers";
import { db } from "@/db/adapter";
import { splitModel } from "@/db/schemas";
import type { TInsertExpenseSchema } from "@/db/schemas/expense.model";
import expenseModel from "@/db/schemas/expense.model";
import type { TInsertSettlementSchema } from "@/db/schemas/settlement.model";
import settlementModel from "@/db/schemas/settlement.model";
import type { TSelectUserSchema } from "@/db/schemas/user.model";

import { getCategoryRepository } from "../categories/category.repository";
import { getGroupMembersByIdRepository } from "../group/group.repository";
import { getUserSettlementsByGroupIdRepository } from "../settlements/settlement.repository";

type TExpensePayload = Omit<TInsertExpenseSchema, "id" | "createdAt" | "updatedAt" | "groupId" >;
interface TSplitUser {
  userId: string;
  amount: number;
}

export async function createExpenseRepository(
  expensePayload: TExpensePayload,
) {
  const [expense] = await db
    .insert(expenseModel)
    .values(expensePayload)
    .returning();

  return expense;
}

export async function createExpenseWithSplits(
  expensePayload: TExpensePayload,
  splitUsers: TSplitUser[],
  payerUserId: string,
  groupId: string,
) {
  const expense = await db.transaction(async (tx) => {
    // insert expense
    const [expense] = await tx
      .insert(expenseModel)
      .values(expensePayload)
      .returning();

    // insert splits
    const splitRecords = splitUsers?.map((split) => {
      return { userId: split.userId, amount: split.amount, expenseId: expense.id };
    });

    await tx
      .insert(splitModel)
      .values(splitRecords)
      .returning();

    // insert/update settlements
    const insertSettlements = await generateSettlementsBasedOnSplits(splitUsers, payerUserId, groupId);
    await tx
      .insert(settlementModel)
      .values(insertSettlements)
      .onConflictDoUpdate({
        target: settlementModel.id,
        set: conflictUpdateSet(settlementModel, ["senderId", "receiverId", "amount"]),
      });

    return expense;
  });

  return expense;
}

/*
  1. Admin create expense - category should either belong to payer or global.
  2. User create self paid expense - category should either belong to user or global.
  3. User create expense for another payer - category should belong to payer.
*/
export async function isCategoryValidToCreateExpense(categoryId: string, payerId: string | undefined, user: TSelectUserSchema) {
  const category = await getCategoryRepository(categoryId);
  let isValid = false;

  if (!category) {
    return { category: null, isValid };
  }

  if (user.role === AuthRoles.ADMIN) {
    isValid = category.userId === null || category.userId === payerId;
  } else {
    isValid = payerId ? category.userId === null : (category.userId === null || category.userId === user.id);
  }

  return { category, isValid };
}

export async function validateSplits(splitUsers: TSplitUser[], groupId: string): Promise<{
  success: boolean;
  message: string;
}> {
  // validate users are part of group
  const groupMembers = await getGroupMembersByIdRepository(groupId);
  const groupUserIds = groupMembers.map(user => user.userId);
  const isAnyUserInvalid = splitUsers.some((user) => {
    return !groupUserIds.includes(user.userId);
  });
  if (isAnyUserInvalid) {
    return {
      success: false,
      message: "Some split users does not belong to group",
    };
  }

  // TODO: Add validation related to split types

  return {
    success: true,
    message: "Validation success",
  };
}

export async function generateSettlementsBasedOnSplits(splitUsers: TSplitUser[], payerUserId: string, groupId: string) {
  const userSettlements = await getUserSettlementsByGroupIdRepository(payerUserId, groupId);
  const insertSettlements: TInsertSettlementSchema[] = [];

  splitUsers?.forEach((split) => {
    const settlement = userSettlements.find(s => s.senderId === split.userId || s.receiverId === split.userId);

    if (settlement) {
      let updatedAmount = settlement.amount;
      if (settlement?.senderId === payerUserId) {
        updatedAmount = settlement?.amount + split.amount;
        insertSettlements.push({ id: settlement.id, senderId: payerUserId, receiverId: split.userId, groupId, amount: updatedAmount });
      } else {
        updatedAmount = settlement?.amount - split.amount;
        if (updatedAmount < 0) {
          insertSettlements.push({ id: settlement.id, senderId: split.userId, receiverId: payerUserId, groupId, amount: Math.abs(updatedAmount) });
        } else {
          insertSettlements.push({ id: settlement.id, senderId: payerUserId, receiverId: split.userId, groupId, amount: Math.abs(updatedAmount) });
        }
      }
    } else {
      insertSettlements.push({ senderId: payerUserId, receiverId: split.userId, groupId, amount: split.amount });
    }
  });

  return insertSettlements;
}
