import { z } from "zod/v4";

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.url(),

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  JWT_SECRET: z.string().min(16),
  JWT_LIFETIME_SECONDS: z.coerce.number().default(3600),

  // Frontend
  FRONTEND_URL: z.url().default("http://localhost:5173"),

  // Email (Resend) - accepts "Name <email>" format or plain email
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(
      z
        .string()
        .regex(/^(.+\s)?<?[\w.-]+@[\w.-]+\.\w+>?$/, "Invalid email format")
        .optional(),
    ),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),

  // Cloudflare R2
  R2_ENDPOINT_URL: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // Sentry
  SENTRY_DSN: z
    .string()
    .transform((val) => (val === "" ? undefined : val))
    .pipe(z.url().optional()),

  // Fiscal Nacional
  FISCAL_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
