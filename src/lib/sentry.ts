import * as Sentry from "@sentry/bun";

const dsn = process.env.SENTRY_DSN;

// Initialize Sentry only if DSN is provided
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Adds request headers and IP for users
    sendDefaultPii: true,

    // Enable debug mode in development
    debug: process.env.NODE_ENV === "development",

    // Filter out health check transactions
    beforeSendTransaction(event) {
      if (event.transaction?.includes("/health")) {
        return null;
      }
      return event;
    },

    // Configure integrations
    integrations: [
      // Automatically instrument Bun's fetch
      Sentry.bunServerIntegration(),
    ],
  });

  console.log("✅ Sentry initialized");
} else if (process.env.NODE_ENV === "production") {
  console.warn("⚠️ SENTRY_DSN not set - error tracking disabled");
}

export { Sentry };

/**
 * Capture an exception with optional context
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!dsn) return undefined;

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
): string | undefined {
  if (!dsn) return undefined;

  return Sentry.captureMessage(message, level);
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: number; email: string; name?: string | null }): void {
  if (!dsn) return;

  Sentry.setUser({
    id: String(user.id),
    email: user.email,
    username: user.name || undefined,
  });
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!dsn) return;

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
  if (!dsn) return;

  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Wrap a function with Sentry error handling
 */
export function withSentry<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: Record<string, unknown>,
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error, context);
          throw error;
        });
      }
      return result;
    } catch (error) {
      captureException(error, context);
      throw error;
    }
  }) as T;
}
