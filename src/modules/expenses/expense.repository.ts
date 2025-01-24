import { sql } from "drizzle-orm";
import type { StatusCode } from "hono/utils/http-status";

import { AuthRoles } from "@/common/enums";
import type { MakeNonNullable } from "@/common/utils/app.types";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import { db } from "@/db/adapter";
import { splitModel } from "@/db/schemas";
import type { TInsertExpenseSchema } from "@/db/schemas/expense.model";
import expenseModel from "@/db/schemas/expense.model";
import type { TInsertSettlementSchema } from "@/db/schemas/settlement.model";
import settlementModel from "@/db/schemas/settlement.model";
import type { TInsertSplitSchema } from "@/db/schemas/split.model";
import type { TSelectUserSchema } from "@/db/schemas/user.model";

import { getCategoryRepository } from "../categories/category.repository";
import { getGroupByIdRepository } from "../group/group.repository";
import { getUserSettlementsForGroupRepository } from "../settlements/settlement.repository";
import { getUserByIdRepository } from "../users/user.repository";
import type { TCreateExpenseBody } from "./expense.validations";

type TStandaloneExpensePayload = Omit<TInsertExpenseSchema, "id" | "createdAt" | "updatedAt" | "groupId" | "splitType" >;
type TExpenseWithSplitsPayload = TStandaloneExpensePayload & Required<MakeNonNullable<TInsertExpenseSchema, "groupId" | "splitType">>;
type TSplit = Required<Pick<TInsertSplitSchema, "userId" | "amount">>;
type TUpsertSettlement = Pick<TInsertSettlementSchema, "id" | "senderId" | "receiverId" | "groupId" | "amount">;

// create a expense with no group, no splits
export async function createStandaloneExpenseRepository(
  expensePayload: TStandaloneExpensePayload,
) {
  const [expense] = await db
    .insert(expenseModel)
    .values(expensePayload)
    .returning();

  return expense;
}

// create a expense with group and splits
export async function createExpenseWithSplitsRepository(
  expensePayload: TExpenseWithSplitsPayload,
  splits: TSplit[],
) {
  const { groupId, payerId } = expensePayload;

  const expense = await db.transaction(async (tx) => {
    // insert expense
    const [expense] = await tx
      .insert(expenseModel)
      .values(expensePayload)
      .returning();

    // insert splits
    const splitRecords = splits?.map((split) => {
      return { userId: split.userId, amount: split.amount, expenseId: expense.id };
    });

    await tx
      .insert(splitModel)
      .values(splitRecords)
      .returning();

    // insert/update settlements
    const settlementRecords = await generateSettlementsRepository(splits, payerId, groupId);
    await tx
      .insert(settlementModel)
      .values(settlementRecords)
      .onConflictDoUpdate({
        target: settlementModel.id,
        set: {
          senderId: sql.raw(`excluded.sender_id`),
          receiverId: sql.raw(`excluded.receiver_id`),
          amount: sql.raw(`excluded.amount`),
        },
      });
    return expense;
  });

  return expense;
}

// validate expense payload
export async function validateExpensePayloadRepository(payload: TCreateExpenseBody, user: TSelectUserSchema): Promise<{
  success: boolean;
  message: string;
  code: StatusCode;
}> {
  const { groupId, payerId, categoryId, splits, splitType, amount } = payload;
  const payerUserId = payerId || user.id;

  // payerId is required for ADMIN
  if (user.role === AuthRoles.ADMIN && !payerId) {
    return {
      success: false,
      message: "Missing payerId",
      code: HTTPStatusCodes.BAD_REQUEST,
    };
  }

  // validate payer user
  const payerUser = await getUserByIdRepository(payerUserId);
  if (!payerUser) {
    return {
      success: false,
      message: "Payer not found",
      code: HTTPStatusCodes.NOT_FOUND,
    };
  }

  // validate group and split users
  if (groupId && splits?.length && splitType) {
    // group not found
    const group = await getGroupByIdRepository(groupId);
    if (!group) {
      return {
        success: false,
        message: "Group not found",
        code: HTTPStatusCodes.NOT_FOUND,
      };
    }

    const groupUserIds = group.userIds.map(user => user.userId);
    for (const split of splits) {
    // split user must belong to group
      if (!groupUserIds.includes(split.userId)) {
        return {
          success: false,
          message: `User ${split.userId} does not belong to the specified group`,
          code: HTTPStatusCodes.BAD_REQUEST,
        };
      }

      // validate even split
      if (splitType === "even" && split.amount !== amount / (splits.length + 1)) {
        return {
          success: false,
          message: `Split amount is unequal provided split type is ${splitType}`,
          code: HTTPStatusCodes.BAD_REQUEST,
        };
      }
    }

    // validate total split amount
    const totalSplitAmount = splits.reduce((acc, split) => {
      return acc + split.amount;
    }, 0);

    if (totalSplitAmount > amount) {
      return {
        success: false,
        message: `Split total is greater then amount paid`,
        code: HTTPStatusCodes.BAD_REQUEST,
      };
    }
  }

  // validate category
  if (categoryId) {
    const category = await getCategoryRepository(categoryId);
    if (!category) {
      return {
        success: false,
        message: "Category not found",
        code: HTTPStatusCodes.NOT_FOUND,
      };
    }

    // category should either belongs to the payer or should be global.
    const isCategoryNotGlobal = !!category.userId;
    const isCategoryNotBelongsToPayer = category.userId !== payerUserId;
    if (isCategoryNotGlobal && isCategoryNotBelongsToPayer) {
      return {
        success: false,
        message: "Category does not belong to the user or the specified payer",
        code: HTTPStatusCodes.BAD_REQUEST,
      };
    }
  }

  return {
    success: true,
    message: "Validation success",
    code: HTTPStatusCodes.OK,
  };
}

// generate settlements based on splits
export async function generateSettlementsRepository(splits: TSplit[], payerUserId: string, groupId: string) {
  const currentSettlements = await getUserSettlementsForGroupRepository(payerUserId, groupId);
  const newSettlements: TUpsertSettlement[] = [];

  splits?.forEach((split) => {
    const settlement = currentSettlements.find(s => s.senderId === split.userId || s.receiverId === split.userId);
    if (settlement) {
      // if the settlement already exists between paying user and split user
      let settlementAmount: number;
      let senderId: string;
      let receiverId: string;

      if (settlement?.senderId === payerUserId) {
        // if the paying user currently lents the split user
        settlementAmount = settlement?.amount + split.amount;
        [senderId, receiverId] = [payerUserId, split.userId];
      } else {
        // if the paying user currently owes the split user
        settlementAmount = settlement?.amount - split.amount;
        [senderId, receiverId] = settlementAmount < 0 ? [split.userId, payerUserId] : [payerUserId, split.userId];
      }

      newSettlements.push({ id: settlement.id, senderId, receiverId, groupId, amount: Math.abs(settlementAmount) });
    } else {
      // if the settlement doest exists between paying user and split user
      newSettlements.push({ senderId: payerUserId, receiverId: split.userId, groupId, amount: split.amount });
    }
  });

  return newSettlements;
}
