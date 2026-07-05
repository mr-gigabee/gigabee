import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

const ALLOWED_ORIGINS = [
  "https://gigabee.io",
  "https://www.gigabee.io",
];

if (process.env["NODE_ENV"] !== "production") {
  const devDomain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["DEV_DOMAIN"];
  if (devDomain) ALLOWED_ORIGINS.push(`https://${devDomain}`);
  ALLOWED_ORIGINS.push("http://localhost:25992", "http://localhost:5173");
}

export const CORS_OPTIONS = {
  origin(
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error("CORS policy violation"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

export const SOCKET_CORS = {
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST"],
};

// Normalise client IP — prefers X-Forwarded-For (set by the reverse proxy),
// then falls through to req.ip, normalising IPv6 via the library helper.
function clientIp(req: Request): string {
  const forwarded = (req.headers["x-forwarded-for"] as string)
    ?.split(",")[0]
    ?.trim();
  if (forwarded) return forwarded;
  return ipKeyGenerator(req.ip ?? "127.0.0.1");
}

const baseLimit = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skipSuccessfulRequests: false,
};

export const globalRateLimit = rateLimit({
  ...baseLimit,
  windowMs: 60 * 1000,
  limit: 200,
  keyGenerator: clientIp,
});

export const authRateLimit = rateLimit({
  ...baseLimit,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many auth attempts. Try again in 15 minutes." },
  keyGenerator: clientIp,
});

export const chatRateLimit = rateLimit({
  ...baseLimit,
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: "Chat rate limit reached. Please wait a moment." },
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return `token:${auth.slice(-16)}`;
    return clientIp(req);
  },
});

export const workerRateLimit = rateLimit({
  ...baseLimit,
  windowMs: 10 * 1000,
  limit: 60,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return `worker:${auth.slice(-16)}`;
    return clientIp(req);
  },
});
