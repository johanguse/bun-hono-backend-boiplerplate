import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { db } from "../../db";
import { users } from "../../db/schema";
import { env } from "../../lib/env";
import { createJWT } from "../../lib/jwt";
import {
  createPasswordResetToken,
  createVerificationToken,
  verifyEmailToken,
  verifyPasswordResetToken,
} from "../../lib/otp";
import {
  authMiddleware,
  authRateLimiter,
  passwordResetRateLimiter,
  requireAuth,
} from "../../middleware";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../../services/email.service";
import onboardingRoutes from "./onboarding";
import otpRoutes from "./otp";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./schemas";

const auth = new Hono();

/**
 * Helper to set session cookie
 */
function setSessionCookie(c: Context, token: string): void {
  const isSecure = env.FRONTEND_URL.startsWith("https");

  c.header(
    "Set-Cookie",
    `ba_session=${token}; HttpOnly; ${isSecure ? "Secure; " : ""}SameSite=${
      isSecure ? "None" : "Lax"
    }; Path=/; Max-Age=${env.JWT_LIFETIME_SECONDS}`,
  );
}

/**
 * Clear session cookie
 */
function clearSessionCookie(c: Context): void {
  c.header("Set-Cookie", "ba_session=; HttpOnly; Path=/; Max-Age=0");
}

/**
 * Login with email and password
 * POST /auth/jwt/login
 */
auth.post("/jwt/login", authRateLimiter, zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  try {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !user.hashedPassword) {
      return c.json({ detail: "Invalid email or password" }, 400);
    }

    // Verify password
    const isValid = await Bun.password.verify(password, user.hashedPassword);
    if (!isValid) {
      return c.json({ detail: "Invalid email or password" }, 400);
    }

    // Check if user is active
    if (!user.isActive) {
      return c.json({ detail: "Account is disabled" }, 400);
    }

    // Create JWT token
    const token = await createJWT({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
    });

    // Set session cookie
    setSessionCookie(c, token);

    const expiresAt = new Date(Date.now() + env.JWT_LIFETIME_SECONDS * 1000).toISOString();

    return c.json({
      access_token: token,
      token_type: "bearer",
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        emailVerified: user.isVerified,
        role: user.role,
        is_verified: user.isVerified,
        is_superuser: user.isSuperuser,
        onboarding_completed: user.onboardingCompleted,
        onboarding_step: user.onboardingStep,
        createdAt: user.createdAt?.toISOString() || null,
        updatedAt: user.updatedAt?.toISOString() || null,
      },
      session: {
        token,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ detail: "Login failed" }, 500);
  }
});

/**
 * Logout
 * POST /auth/jwt/logout
 */
auth.post("/jwt/logout", authMiddleware, requireAuth, async (c) => {
  clearSessionCookie(c);
  return c.json({ success: true });
});

/**
 * Register new user
 * POST /auth/register
 */
auth.post("/register", authRateLimiter, zValidator("json", registerSchema), async (c) => {
  const { email, password, name } = c.req.valid("json");

  try {
    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      return c.json({ detail: "REGISTER_USER_ALREADY_EXISTS" }, 400);
    }

    // Hash password
    const hashedPassword = await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 19456,
      timeCost: 2,
    });

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email,
        hashedPassword,
        name: name || null,
        isActive: true,
        isSuperuser: false,
        isVerified: false,
        onboardingCompleted: false,
        onboardingStep: 0,
      })
      .returning();

    // Send verification email
    const verifyToken = await createVerificationToken(email);
    await sendVerificationEmail(email, verifyToken, name);

    // Send welcome email
    await sendWelcomeEmail(email, name);

    if (!user) {
      return c.json({ detail: "Registration failed" }, 500);
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      is_active: user.isActive,
      is_superuser: user.isSuperuser,
      is_verified: user.isVerified,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ detail: "Registration failed" }, 500);
  }
});

/**
 * Request password reset
 * POST /auth/forgot-password
 */
auth.post(
  "/forgot-password",
  passwordResetRateLimiter,
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    try {
      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      // Always return success to prevent email enumeration
      if (!user) {
        return c.json({ success: true });
      }

      // Create and send password reset token
      const token = await createPasswordResetToken(email);
      await sendPasswordResetEmail(email, token, user.name);

      return c.json({ success: true });
    } catch (error) {
      console.error("Forgot password error:", error);
      return c.json({ success: true }); // Don't reveal errors
    }
  },
);

/**
 * Reset password with token
 * POST /auth/reset-password
 */
auth.post(
  "/reset-password",
  passwordResetRateLimiter,
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { email, token, password } = c.req.valid("json");

    try {
      // Verify token
      const isValid = await verifyPasswordResetToken(email, token);

      if (!isValid) {
        return c.json({ detail: "RESET_PASSWORD_BAD_TOKEN" }, 400);
      }

      // Find user
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        return c.json({ detail: "RESET_PASSWORD_BAD_TOKEN" }, 400);
      }

      // Hash new password
      const hashedPassword = await Bun.password.hash(password, {
        algorithm: "argon2id",
        memoryCost: 19456,
        timeCost: 2,
      });

      // Update password
      await db
        .update(users)
        .set({ hashedPassword, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Reset password error:", error);
      return c.json({ detail: "Password reset failed" }, 500);
    }
  },
);

/**
 * Request email verification
 * POST /auth/request-verify-token
 */
auth.post(
  "/request-verify-token",
  authRateLimiter,
  zValidator("json", forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid("json");

    try {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        return c.json({ success: true }); // Don't reveal if user exists
      }

      if (user.isVerified) {
        return c.json({ detail: "VERIFY_USER_ALREADY_VERIFIED" }, 400);
      }

      const token = await createVerificationToken(email);
      await sendVerificationEmail(email, token, user.name);

      return c.json({ success: true });
    } catch (error) {
      console.error("Request verify token error:", error);
      return c.json({ success: true });
    }
  },
);

/**
 * Verify email with token
 * POST /auth/verify
 */
auth.post("/verify", zValidator("json", verifyEmailSchema), async (c) => {
  const { email, token } = c.req.valid("json");

  try {
    const isValid = await verifyEmailToken(email, token);

    if (!isValid) {
      return c.json({ detail: "VERIFY_USER_BAD_TOKEN" }, 400);
    }

    // Update user verification status
    await db
      .update(users)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(users.email, email));

    return c.json({ success: true });
  } catch (error) {
    console.error("Verify email error:", error);
    return c.json({ detail: "Verification failed" }, 500);
  }
});

// Mount OTP routes
auth.route("/otp", otpRoutes);

// Mount onboarding routes (requires auth)
auth.use("/onboarding/*", authMiddleware, requireAuth);
auth.route("/onboarding", onboardingRoutes);

export default auth;
