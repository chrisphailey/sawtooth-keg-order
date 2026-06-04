import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "node:fs";
import path from "node:path";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { HealthCheckResponse } from "@workspace/api-zod";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const publicDir = path.resolve(__dirname, "../../sawtooth-keg/dist/public");
const shouldServeClient =
  process.env.NODE_ENV === "production" && fs.existsSync(publicDir);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/healthz", (_req, res) => {
  res.json(HealthCheckResponse.parse({ status: "ok" }));
});

if (shouldServeClient) {
  app.use(express.static(publicDir, { index: false }));
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      !["GET", "HEAD"].includes(req.method) ||
      !req.accepts("html")
    ) {
      return next();
    }

    res.sendFile(path.join(publicDir, "index.html"));
  });
} else if (process.env.NODE_ENV === "production") {
  logger.warn({ publicDir }, "Client build directory was not found");
}

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
