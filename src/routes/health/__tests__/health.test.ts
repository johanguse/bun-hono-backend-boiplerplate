import { Hono } from "hono";
import { describe, expect, it } from "vitest";

describe("Health Routes", () => {
  const app = new Hono();

  // Simple health endpoints for testing
  app.get("/health/ping", (c) => c.json({ status: "ok" }));
  app.get("/health/live", (c) => c.json({ status: "alive" }));
  app.get("/health/ready", (c) => c.json({ status: "ready" }));

  it("should return ok on ping", async () => {
    const res = await app.request("/health/ping");
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("ok");
  });

  it("should return alive on liveness check", async () => {
    const res = await app.request("/health/live");
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("alive");
  });

  it("should return ready on readiness check", async () => {
    const res = await app.request("/health/ready");
    expect(res.status).toBe(200);

    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("ready");
  });
});
