import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { CORS_OPTIONS, globalRateLimit } from "./lib/security";

const app: Express = express();

// ── Trust reverse proxy (Cloudflare) ─────────────────────────────────────────
app.set("trust proxy", 1);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
// Remove X-Powered-By (helmet does this) and block fingerprinting
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors(CORS_OPTIONS));

// ── Structured request logging ───────────────────────────────────────────────
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
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Body parsing with size limits (prevent payload floods) ───────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// ── Global rate limit (200 req/min per IP) ───────────────────────────────────
app.use(globalRateLimit);

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler (no stack traces in production) ─────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const isProd = process.env["NODE_ENV"] === "production";
  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: "Internal server error",
    ...(isProd ? {} : { message: err.message }),
  });
});

export default app;
