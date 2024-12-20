import { apiReference } from "@scalar/hono-api-reference";

import env from "@/env";

import packageJSON from "../../../package.json";
import type { AppOpenAPI } from "./types";

export function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: env.API_TITLE,
    },
  });

  app.get(
    "/reference",
    apiReference({
      theme: "kepler",
      spec: {
        url: "/doc",
      },
      defaultHttpClient: {
        targetKey: "javascript",
        clientKey: "fetch",
      },
    }),
  );
}