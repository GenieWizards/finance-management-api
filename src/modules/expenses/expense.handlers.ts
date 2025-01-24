import { ActivityType } from "@/common/enums";
import { logActivity } from "@/common/helpers/activity-log.helper";
import type { AppRouteHandler } from "@/common/lib/types";
import { AUTHORIZATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";

import { createExpenseWithSplitsRepository, createStandaloneExpenseRepository, validateExpensePayloadRepository } from "./expense.repository";
import type { TCreateExpenseRoute } from "./expense.routes";

export const createExpense: AppRouteHandler<TCreateExpenseRoute> = async (c) => {
  const logger = c.get("logger");
  const user = c.get("user");
  const payload = c.req.valid("json");

  const { groupId, payerId, splits, splitType } = payload;
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

  // validate payload
  const result = await validateExpensePayloadRepository(payload, user);
  if (!result.success) {
    logger.debug(`createExpense: ${result.message}`);
    return c.json(
      {
        success: false,
        message: result.message,
      },
      result.code as 500,
    );
  }

  const payerUserId = payerId || user.id;

  if (groupId && splits?.length && splitType) {
    // Create expense with group and splits.
    const expensePayload = {
      ...payload,
      payerId: payerUserId,
      creatorId: user.id,
      groupId,
      splitType,
    };

    expense = await createExpenseWithSplitsRepository(expensePayload, splits);
  } else {
    // Create standalone expense (no group, no splits)
    const expensePayload = {
      ...payload,
      payerId: payerUserId,
      creatorId: user.id,
    };

    expense = await createStandaloneExpenseRepository(expensePayload);
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
