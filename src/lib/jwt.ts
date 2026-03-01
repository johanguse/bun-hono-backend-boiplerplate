import { jwtVerify, SignJWT } from "jose";
import { env } from "./env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface JWTPayload {
  sub: string;
  email: string;
  name?: string;
  role?: string;
  iat?: number;
  exp?: number;
  aud?: string[];
}

/**
 * Create a JWT token for authentication
 */
export async function createJWT(payload: {
  userId: string | number;
  email: string;
  name?: string;
  role?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: String(payload.userId),
    email: payload.email,
    name: payload.name,
    role: payload.role || "member",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setAudience("fastapi-users:auth")
    .setIssuer("better-auth-compat")
    .setExpirationTime(now + env.JWT_LIFETIME_SECONDS)
    .sign(secret);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      audience: "fastapi-users:auth", // Must match the audience set by the FastAPI compat layer
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(authHeader?: string, cookie?: string): string | null {
  // Check Authorization header first
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check for session cookie
  if (cookie) {
    const cookies: Record<string, string> = {};
    for (const c of cookie.split(";")) {
      const [key, value] = c.trim().split("=");
      if (key && value) {
        cookies[key] = value;
      }
    }

    // Check for Better Auth session cookie
    if (cookies.ba_session) {
      return cookies.ba_session;
    }
  }

  return null;
}
