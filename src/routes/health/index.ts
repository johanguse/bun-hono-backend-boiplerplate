import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../../db";

const healthRouter = new Hono();

/**
 * Health check endpoint
 * GET /health
 */
healthRouter.get("/", async (c) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};
  let overallStatus = "healthy";

  // Database check
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = {
      status: "healthy",
      latency_ms: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: "unhealthy",
      latency_ms: Date.now() - dbStart,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "unhealthy";
  }

  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  checks.memory = {
    status: memoryUsedMB < memoryTotalMB * 0.9 ? "healthy" : "warning",
  };

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime_seconds: Math.round(process.uptime()),
      checks,
      memory: {
        used_mb: memoryUsedMB,
        total_mb: memoryTotalMB,
        rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    },
    overallStatus === "healthy" ? 200 : 503,
  );
});

/**
 * Simple ping endpoint
 * GET /health/ping
 */
healthRouter.get("/ping", (c) => {
  return c.json({ pong: true });
});

/**
 * Ready check endpoint
 * GET /health/ready
 */
healthRouter.get("/ready", async (c) => {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);
    return c.json({ ready: true });
  } catch {
    return c.json({ ready: false }, 503);
  }
});

/**
 * Live check endpoint
 * GET /health/live
 */
healthRouter.get("/live", (c) => {
  return c.json({ live: true });
});

export default healthRouter;
