import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./lib/env";
import { openApiSpec } from "./lib/openapi";
import { captureException } from "./lib/sentry";
import { corsMiddleware, loggerMiddleware } from "./middleware";

// Import routes
import authRouter from "./routes/auth";
import onboardingRouter from "./routes/auth/onboarding";
import otpRouter from "./routes/auth/otp";
import fiscalRouter from "./routes/fiscal";
import healthRouter from "./routes/health";
import organizationsRouter from "./routes/organizations";
import projectsRouter from "./routes/projects";
import subscriptionsRouter from "./routes/subscriptions";
import uploadsRouter from "./routes/uploads";
import usersRouter from "./routes/users";
import webhooksRouter from "./routes/webhooks";

// Create app
const app = new Hono();

// Global middleware
app.use("*", corsMiddleware);
app.use("*", secureHeaders());
app.use("*", prettyJSON());

// Use custom logger in production, built-in logger in development
if (env.NODE_ENV === "production") {
  app.use("*", loggerMiddleware);
} else {
  app.use("*", logger());
}

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "API Backend",
    version: "1.0.0",
    docs: "/docs",
    openapi: "/openapi.json",
  });
});

// OpenAPI spec endpoint
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// Swagger UI
app.get(
  "/docs",
  swaggerUI({
    url: "/openapi.json",
    persistAuthorization: true,
  }),
);

// API v1 routes
const apiV1 = new Hono();

// Health routes (no /api/v1 prefix, available at root)
app.route("/health", healthRouter);
app.route("/api/v1/health", healthRouter);

// Webhooks (raw body needed for signature verification)
app.route("/api/v1/webhooks", webhooksRouter);

// Auth routes
apiV1.route("/auth", authRouter);
apiV1.route("/auth/otp", otpRouter);
apiV1.route("/auth/onboarding", onboardingRouter);

// Resource routes
apiV1.route("/users", usersRouter);
apiV1.route("/organizations", organizationsRouter);
apiV1.route("/projects", projectsRouter);
apiV1.route("/subscriptions", subscriptionsRouter);
apiV1.route("/uploads", uploadsRouter);
apiV1.route("/fiscal", fiscalRouter);

// Mount API v1
app.route("/api/v1", apiV1);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      detail: "Not Found",
      path: c.req.path,
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  // Capture error in Sentry
  captureException(err, {
    path: c.req.path,
    method: c.req.method,
  });

  // Don't expose internal errors in production
  const message = env.NODE_ENV === "production" ? "Internal Server Error" : err.message;

  return c.json(
    {
      detail: message,
      ...(env.NODE_ENV !== "production" && { stack: err.stack }),
    },
    500,
  );
});

// Export for Bun
export default {
  port: env.PORT,
  fetch: app.fetch,
};

// Also export app for testing
export { app };
