import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { db } from "../../db";
import { users } from "../../db/schema";
import { env } from "../../lib/env";
import { createJWT } from "../../lib/jwt";
import { createOTPToken, verifyOTPToken } from "../../lib/otp";
import { authRateLimiter } from "../../middleware";
import { sendOTPEmail } from "../../services/email.service";
import { otpSendSchema, otpVerifySchema } from "./schemas";

const otp = new Hono();

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
 * Send OTP code to email
 * POST /auth/otp/send
 */
otp.post("/send", authRateLimiter, zValidator("json", otpSendSchema), async (c) => {
  const { email } = c.req.valid("json");

  try {
    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    // Generate and store OTP
    const code = await createOTPToken(email);

    // Send OTP email
    await sendOTPEmail(email, code, existingUser?.name);

    // In development, log the code
    if (env.NODE_ENV === "development") {
      console.log(`[DEV] OTP code for ${email}: ${code}`);
    }

    return c.json({
      success: true,
      message: "Verification code sent to your email address",
      user_exists: !!existingUser,
    });
  } catch (error) {
    console.error("OTP send error:", error);
    return c.json(
      {
        error: "OTP_SEND_FAILED",
        message: "An error occurred while sending the verification code",
      },
      500,
    );
  }
});

/**
 * Verify OTP code and login/register
 * POST /auth/otp/verify
 */
otp.post("/verify", authRateLimiter, zValidator("json", otpVerifySchema), async (c) => {
  const { email, code, name } = c.req.valid("json");

  try {
    // Verify OTP
    const verifiedEmail = await verifyOTPToken(email, code);

    if (!verifiedEmail) {
      return c.json(
        {
          error: "INVALID_OTP",
          message: "Invalid or expired verification code",
        },
        400,
      );
    }

    // Check if user exists
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user) {
      // Existing user - update name if provided and not set
      if (name && !user.name) {
        await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));

        user = { ...user, name };
      }
    } else {
      // New user - create account
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await Bun.password.hash(randomPassword, {
        algorithm: "argon2id",
      });

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          hashedPassword,
          name: name || null,
          isActive: true,
          isSuperuser: false,
          isVerified: true, // OTP verification counts as email verification
          onboardingCompleted: false,
          onboardingStep: 0,
        })
        .returning();

      user = newUser;
    }

    // Create JWT token
    if (!user) {
      return c.json({ error: "USER_CREATE_FAILED", message: "Failed to create user" }, 500);
    }

    const token = await createJWT({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
    });

    // Set session cookie
    setSessionCookie(c, token);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + env.JWT_LIFETIME_SECONDS * 1000).toISOString();

    return c.json({
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name || name || user.email.split("@")[0],
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
    console.error("OTP verify error:", error);
    return c.json(
      {
        error: "OTP_VERIFY_FAILED",
        message: "An error occurred while verifying the code",
      },
      500,
    );
  }
});

export default otp;
