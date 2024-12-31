import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";

import jsonContentRequired from "@/common/helpers/json-content-required.helper";
import { jsonContent } from "@/common/helpers/json-content.helper";
import {
  authMiddleware,
  requireAuth,
} from "@/common/middlewares/auth.middleware";
import createErrorSchema from "@/common/schema/create-error.schema";
import { AUTHORIZATION_ERROR_MESSAGE, INTERNAL_SERVER_ERROR_MESSAGE, NOT_FOUND_ERROR_MESSAGE, VALIDATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import {
  insertExpenseSchema,
  selectExpenseSchema,
} from "@/db/schemas/expense.model";

import { createExpenseBodySchema } from "./expense.validations";

const tags = ["Expenses"];

export const createExpenseRoute = createRoute({
  tags,
  method: "post",
  path: "/expenses",
  middleware: [
    authMiddleware(),
    requireAuth(),
  ] as const,
  request: {
    body: jsonContentRequired(createExpenseBodySchema, "Expense creation details"),
  },
  responses: {
    [HTTPStatusCodes.CREATED]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
        data: selectExpenseSchema,
      }),
      "Expense created successfully",
    ),
    [HTTPStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      VALIDATION_ERROR_MESSAGE,
    ),
    [HTTPStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      AUTHORIZATION_ERROR_MESSAGE,
    ),
    [HTTPStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertExpenseSchema),
      VALIDATION_ERROR_MESSAGE,
    ),
    [HTTPStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      NOT_FOUND_ERROR_MESSAGE,
    ),
    [HTTPStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      INTERNAL_SERVER_ERROR_MESSAGE,
    ),
  },
});

export type TCreateExpenseRoute = typeof createExpenseRoute;
