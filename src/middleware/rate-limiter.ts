import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

/**
 * Get real client IP address considering proxies
 */
function getClientIP(c: Context): string {
  // Check X-Forwarded-For header
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0];
    if (firstIP) {
      return firstIP.trim();
    }
  }

  // Check X-Real-IP header
  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback to connection info
  return "127.0.0.1";
}

// Rate limit presets matching FastAPI backend
export const RATE_LIMITS = {
  AUTH: { limit: 5, window: 60 }, // 5 requests per minute
  AUTH_HOURLY: { limit: 20, window: 3600 }, // 20 per hour
  PASSWORD_RESET: { limit: 3, window: 3600 }, // 3 per hour
  PASSWORD_RESET_DAILY: { limit: 10, window: 86400 }, // 10 per day
  EMAIL: { limit: 10, window: 3600 }, // 10 per hour
  ORG: { limit: 30, window: 60 }, // 30 per minute
  API: { limit: 100, window: 60 }, // 100 per minute
  API_HOURLY: { limit: 1000, window: 3600 }, // 1000 per hour
  PUBLIC: { limit: 200, window: 60 }, // 200 per minute
} as const;

/**
 * Create a rate limiter with specified limits
 */
export function createRateLimiter(config: { limit: number; window: number }) {
  return rateLimiter({
    windowMs: config.window * 1000,
    limit: config.limit,
    keyGenerator: (c) => getClientIP(c),
    handler: (c) => {
      return c.json(
        {
          detail: "Too many requests. Please slow down and try again later.",
          error: "rate_limit_exceeded",
          retry_after: `${config.window} seconds`,
        },
        429,
        {
          "Retry-After": String(config.window),
        },
      );
    },
  });
}

// Pre-configured rate limiters
export const authRateLimiter = createRateLimiter(RATE_LIMITS.AUTH);
export const passwordResetRateLimiter = createRateLimiter(RATE_LIMITS.PASSWORD_RESET);
export const emailRateLimiter = createRateLimiter(RATE_LIMITS.EMAIL);
export const orgRateLimiter = createRateLimiter(RATE_LIMITS.ORG);
export const apiRateLimiter = createRateLimiter(RATE_LIMITS.API);
export const publicRateLimiter = createRateLimiter(RATE_LIMITS.PUBLIC);
