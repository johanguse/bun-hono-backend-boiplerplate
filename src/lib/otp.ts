import { and, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { emailTokens } from "../db/schema";

const OTP_EXPIRY_MINUTES = 15;

/**
 * Generate a 6-digit OTP code
 */
function generateOTPCode(): string {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

/**
 * Hash an OTP code using SHA-256
 */
async function hashOTP(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create and store an OTP token for an email
 */
export async function createOTPToken(email: string): Promise<string> {
  const code = generateOTPCode();
  const tokenHash = await hashOTP(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const id = crypto.randomUUID();

  // Delete any existing OTP tokens for this email
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userEmail, email), eq(emailTokens.tokenType, "otp")));

  // Create new OTP token
  await db.insert(emailTokens).values({
    id,
    userEmail: email,
    tokenType: "otp",
    tokenHash,
    expiresAt,
  });

  return code;
}

/**
 * Verify an OTP code for an email
 * Returns the email if valid, null otherwise
 */
export async function verifyOTPToken(email: string, code: string): Promise<string | null> {
  const tokenHash = await hashOTP(code);
  const now = new Date();

  // Find valid token
  const [token] = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userEmail, email),
        eq(emailTokens.tokenType, "otp"),
        eq(emailTokens.tokenHash, tokenHash),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!token) {
    return null;
  }

  // Delete used token
  await db.delete(emailTokens).where(eq(emailTokens.id, token.id));

  return token.userEmail;
}

/**
 * Create a verification token (for email verification)
 */
export async function createVerificationToken(email: string): Promise<string> {
  const token = crypto.randomUUID();
  const tokenHash = await hashOTP(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const id = crypto.randomUUID();

  // Delete any existing verification tokens for this email
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userEmail, email), eq(emailTokens.tokenType, "verification")));

  // Create new verification token
  await db.insert(emailTokens).values({
    id,
    userEmail: email,
    tokenType: "verification",
    tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(email: string, token: string): Promise<boolean> {
  const tokenHash = await hashOTP(token);
  const now = new Date();

  const [found] = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userEmail, email),
        eq(emailTokens.tokenType, "verification"),
        eq(emailTokens.tokenHash, tokenHash),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!found) {
    return false;
  }

  // Delete used token
  await db.delete(emailTokens).where(eq(emailTokens.id, found.id));

  return true;
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = crypto.randomUUID();
  const tokenHash = await hashOTP(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const id = crypto.randomUUID();

  // Delete any existing password reset tokens for this email
  await db
    .delete(emailTokens)
    .where(and(eq(emailTokens.userEmail, email), eq(emailTokens.tokenType, "password_reset")));

  // Create new password reset token
  await db.insert(emailTokens).values({
    id,
    userEmail: email,
    tokenType: "password_reset",
    tokenHash,
    expiresAt,
  });

  return token;
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(email: string, token: string): Promise<boolean> {
  const tokenHash = await hashOTP(token);
  const now = new Date();

  const [found] = await db
    .select()
    .from(emailTokens)
    .where(
      and(
        eq(emailTokens.userEmail, email),
        eq(emailTokens.tokenType, "password_reset"),
        eq(emailTokens.tokenHash, tokenHash),
        gt(emailTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!found) {
    return false;
  }

  // Delete used token
  await db.delete(emailTokens).where(eq(emailTokens.id, found.id));

  return true;
}
