import { cors } from "hono/cors";
import { env } from "../lib/env";

/**
 * CORS middleware configuration
 * Allows requests from the frontend URL with credentials
 */
export const corsMiddleware = cors({
  origin: [env.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept", "Accept-Language", "X-Requested-With"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400, // 24 hours
});
