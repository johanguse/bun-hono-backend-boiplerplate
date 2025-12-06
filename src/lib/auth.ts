import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
    // Custom password hashing with Argon2 (Bun native)
    password: {
      hash: async (password: string) => {
        return await Bun.password.hash(password, {
          algorithm: "argon2id",
          memoryCost: 19456,
          timeCost: 2,
        });
      },
      verify: async (data: { password: string; hash: string }) => {
        return await Bun.password.verify(data.password, data.hash);
      },
    },
  },
  session: {
    expiresIn: env.JWT_LIFETIME_SECONDS,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    cookiePrefix: "ba",
    generateId: () => crypto.randomUUID(),
  },
  // Social providers (optional)
  ...(env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET && {
      socialProviders: {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
        ...(env.GITHUB_CLIENT_ID &&
          env.GITHUB_CLIENT_SECRET && {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }),
      },
    }),
});

export type Session = typeof auth.$Infer.Session;
