import type { Context, MiddlewareHandler, Next } from "hono";
import { isProduction } from "../lib/env";

/**
 * Request logging middleware
 * Logs request details and timing
 */
export const loggerMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Format log message
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${method} ${path} ${status} ${duration}ms`;

  if (isProduction) {
    // JSON logging for production
    console.log(
      JSON.stringify({
        timestamp,
        method,
        path,
        status,
        duration,
        userAgent: c.req.header("user-agent"),
        ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
      }),
    );
  } else {
    // Human-readable logging for development
    const color =
      status >= 500
        ? "\x1b[31m" // red
        : status >= 400
          ? "\x1b[33m" // yellow
          : status >= 300
            ? "\x1b[36m" // cyan
            : "\x1b[32m"; // green
    console.log(`${color}${logMessage}\x1b[0m`);
  }
};
