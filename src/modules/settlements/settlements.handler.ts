import type { AppRouteHandler } from "@/common/lib/types";
import { AUTHORIZATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";

import { updateSettlementRepository } from "./settlements.repository";
import type { IUpdateSettlementsRoute } from "./settlements.route";

export const updateSettlement: AppRouteHandler<
  IUpdateSettlementsRoute
> = async (c) => {
  const user = c.get("user");
  const { settlementId } = c.req.valid("param");
  const payload = c.req.valid("json");
  const logger = c.get("logger");

  if (!user) {
    logger.error("User is not logged in");
    return c.json(
      {
        success: false,
        message: AUTHORIZATION_ERROR_MESSAGE,
      },
      HTTPStatusCodes.UNAUTHORIZED,
    );
  }

  const settlement = await updateSettlementRepository(payload, settlementId);

  if (!settlement) {
    logger.error("Settlement not found");
    return c.json(
      {
        success: false,
        message: "Settlement not found",
      },
      HTTPStatusCodes.NOT_FOUND,
    );
  }

  logger.info(`Settlement with id: ${settlementId} updated successfully`);
  return c.json(
    {
      success: true,
      message: "Settlement updated successfully",
    },
    HTTPStatusCodes.OK,
  );
};
