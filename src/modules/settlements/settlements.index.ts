import { createRouter } from "@/common/lib/create-app.lib";

import * as handlers from "./settlements.handler";
import * as routes from "./settlements.route";

export const settlementsRouter = createRouter().openapi(
  routes.updateSettlementRoute,
  handlers.updateSettlement,
);
