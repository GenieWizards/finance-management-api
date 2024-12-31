import { configureOpenAPI } from "./common/lib/configure-open-api.lib";
import { createApp } from "./common/lib/create-app.lib";
import { activityRouter } from "./modules/activities/activity.index";
import { authRouter } from "./modules/auth/auth.index";
import { categoryRouter } from "./modules/categories/category.index";
import { expenseRouter } from "./modules/expenses/expense.index";
import { groupRouters } from "./modules/group/group.index";
import { healthCheckRouter } from "./modules/health-check/health-check.index";
import { settlementsRouter } from "./modules/settlements/settlements.index";

export const app = createApp();

const routesV1 = [
  authRouter,
  categoryRouter,
  groupRouters,
  activityRouter,
  expenseRouter,
  settlementsRouter,
];

configureOpenAPI(app);

app.route("/api", healthCheckRouter);

routesV1.forEach((route) => {
  app.route("/api/v1", route);
});

app.get("/", (c) => {
  return c.text("Finance Management API!");
});
