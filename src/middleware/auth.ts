import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler, Next } from "hono";
import { db } from "../db";
import type { User } from "../db/schema";
import { users } from "../db/schema";
import { extractToken, verifyJWT } from "../lib/jwt";

// Extend Hono context to include user
declare module "hono" {
  interface ContextVariableMap {
    user: User | null;
    userId: number | null;
  }
}

/**
 * Auth middleware that extracts and validates JWT token
 * Sets user and userId in context if valid
 */
export const authMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const authHeader = c.req.header("authorization");
  const cookie = c.req.header("cookie");
  const token = extractToken(authHeader, cookie);

  if (!token) {
    c.set("user", null);
    c.set("userId", null);
    return next();
  }

  try {
    const payload = await verifyJWT(token);
    if (!payload || !payload.sub) {
      c.set("user", null);
      c.set("userId", null);
      return next();
    }

    const userId = parseInt(payload.sub, 10);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user || !user.isActive) {
      c.set("user", null);
      c.set("userId", null);
      return next();
    }

    c.set("user", user);
    c.set("userId", user.id);
  } catch {
    c.set("user", null);
    c.set("userId", null);
  }

  return next();
};

/**
 * Require authentication - returns 401 if not authenticated
 */
export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = c.get("user");

  if (!user) {
    return c.json(
      {
        detail: "Not authenticated",
        error: "unauthorized",
      },
      401,
    );
  }

  return next();
};

/**
 * Require verified email
 */
export const requireVerified: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ detail: "Not authenticated", error: "unauthorized" }, 401);
  }

  if (!user.isVerified) {
    return c.json({ detail: "Email not verified", error: "email_not_verified" }, 403);
  }

  return next();
};

/**
 * Require superuser/admin role
 */
export const requireAdmin: MiddlewareHandler = async (c: Context, next: Next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ detail: "Not authenticated", error: "unauthorized" }, 401);
  }

  if (!user.isSuperuser && user.role !== "admin") {
    return c.json({ detail: "Admin access required", error: "forbidden" }, 403);
  }

  return next();
};
