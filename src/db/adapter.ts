import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import env from "@/env";

import * as schema from "./schemas";

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, {
  casing: "snake_case",
  schema,
  logger: true,
});

export type TDb = typeof db;
