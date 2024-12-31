import { ActivityType, AuthRoles } from "@/common/enums";
import { logActivity } from "@/common/helpers/activity-log.helper";
import type { AppRouteHandler } from "@/common/lib/types";
import { AUTHORIZATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";

import { getGroupByIdRepository } from "../group/group.repository";
import { getUserByIdRepository } from "../users/user.repository";
import { createExpenseRepository, createExpenseWithSplits, isCategoryValidToCreateExpense, validateSplits } from "./expense.repository";
import type { TCreateExpenseRoute } from "./expense.routes";

export const createExpense: AppRouteHandler<TCreateExpenseRoute> = async (c) => {
  const logger = c.get("logger");
  const user = c.get("user");
  const payload = c.req.valid("json");

  const { groupId, payerId, categoryId, splitUsers } = payload;
  let expense;

  // validate user
  if (!user) {
    logger.debug("createExpense: User is not authorized to create expense");
    return c.json(
      {
        success: false,
        message: AUTHORIZATION_ERROR_MESSAGE,
      },
      HTTPStatusCodes.UNAUTHORIZED,
    );
  }

  // validate payer
  if (user.role === AuthRoles.ADMIN && !payerId) {
    logger.debug("createExpense: Missing payerId");
    return c.json(
      {
        success: false,
        message: "Missing payerId",
      },
      HTTPStatusCodes.BAD_REQUEST,
    );
  }

  if (payerId) {
    const payerUser = await getUserByIdRepository(payerId);
    if (!payerUser) {
      logger.debug("createExpense: Payer not found");
      return c.json(
        {
          success: false,
          message: "Payer not found",
        },
        HTTPStatusCodes.NOT_FOUND,
      );
    }
  }

  // validate category
  if (categoryId) {
    const { category, isValid } = await isCategoryValidToCreateExpense(categoryId, payerId, user);

    if (!category) {
      logger.debug("createExpense: Category not found");
      return c.json(
        {
          success: false,
          message: "Category not found",
        },
        HTTPStatusCodes.NOT_FOUND,
      );
    }

    if (!isValid) {
      logger.debug("createExpense: Category does not belong to the user or the specified payer");
      return c.json(
        {
          success: false,
          message: "Category does not belong to the user or the specified payer",
        },
        HTTPStatusCodes.BAD_REQUEST,
      );
    }
  }

  // validate group
  if (groupId) {
    const group = await getGroupByIdRepository(groupId);
    if (!group) {
      logger.debug("createExpense: Group not found");
      return c.json(
        {
          success: false,
          message: "Group not found",
        },
        HTTPStatusCodes.NOT_FOUND,
      );
    }
  }

  const payerUserId = payerId || user.id;
  const expensePayload = {
    ...payload,
    payerId: payerUserId,
    creatorId: user.id,
  };

  // Create expense with splits.
  if (groupId || splitUsers) {
    // validate group
    if (!groupId) {
      logger.debug("createExpense: Missing groupId");
      return c.json(
        {
          success: false,
          message: "Missing groupId",
        },
        HTTPStatusCodes.BAD_REQUEST,
      );
    }

    if (!splitUsers?.length) {
      logger.debug("createExpense: Missing split users");
      return c.json(
        {
          success: false,
          message: "Missing split users",
        },
        HTTPStatusCodes.BAD_REQUEST,
      );
    }

    // validate splits
    const isSplitValid = await validateSplits(splitUsers, groupId);
    if (!isSplitValid?.success) {
      logger.debug(`createExpense: ${isSplitValid.message}`);
      return c.json(
        {
          success: false,
          message: isSplitValid.message,
        },
        HTTPStatusCodes.BAD_REQUEST,
      );
    }

    expense = await createExpenseWithSplits(expensePayload, splitUsers, payerUserId, groupId);
  } else {
    expense = await createExpenseRepository(expensePayload);
  }

  if (!expense) {
    logger.error("Failed to create expense");
    return c.json(
      {
        success: false,
        message: "Failed to create expense",
      },
      HTTPStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  void logActivity({
    type: ActivityType.EXPENSE_ADDED,
    metadata: {
      action: "create",
      resourceType: "expense",
      actorId: user.id,
      targetId: expense.id,
      destinationId: expense.id,
      actorName: user.fullName || "",
      msg: "expense created",
    },
  });
  logger.debug(`Expense created successfully`);

  return c.json(
    {
      success: true,
      message: "Expense created successfully",
      data: expense,
    },
    HTTPStatusCodes.CREATED,
  );
};
