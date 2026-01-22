import { afterAll, beforeAll, vi } from "vitest";

// Mock environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.BETTER_AUTH_SECRET = "test-secret-key-min-32-characters-long";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.JWT_SECRET = "test-jwt-secret-16";
  process.env.FRONTEND_URL = "http://localhost:5173";
});

afterAll(() => {
  vi.restoreAllMocks();
});
