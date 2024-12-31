import { createRoute, z } from "@hono/zod-openapi";

import jsonContentRequired from "@/common/helpers/json-content-required.helper";
import { jsonContent } from "@/common/helpers/json-content.helper";
import {
  authMiddleware,
  requireAuth,
} from "@/common/middlewares/auth.middleware";
import {
  AUTHORIZATION_ERROR_MESSAGE,
  FORBIDDEN_ERROR_MESSAGE,
  INTERNAL_SERVER_ERROR_MESSAGE,
} from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import { idSchema } from "@/db/schemas/id.model";
import { insertSettlementSchema } from "@/db/schemas/settlement.model";

const tags = ["Settlements"];

export const updateSettlementRoute = createRoute({
  tags,
  method: "patch",
  path: "/settlements/:settlementId",
  summary: "Update settlements by ID",
  middleware: [authMiddleware(), requireAuth()] as const,
  request: {
    params: z.object({
      settlementId: idSchema,
    }),
    body: jsonContentRequired(
      insertSettlementSchema.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
      }),
      "Settlement update",
    ),
  },
  responses: {
    [HTTPStatusCodes.OK]: jsonContent(
      z.object({
        success: z.boolean().default(true),
        message: z.string(),
      }),
      "Settlement updated successfully",
    ),
    [HTTPStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      "Settlement with id does not exist",
    ),
    [HTTPStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      AUTHORIZATION_ERROR_MESSAGE,
    ),
    [HTTPStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        success: z.boolean().default(false),
        message: z.string(),
      }),
      FORBIDDEN_ERROR_MESSAGE,
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

export type IUpdateSettlementsRoute = typeof updateSettlementRoute;
