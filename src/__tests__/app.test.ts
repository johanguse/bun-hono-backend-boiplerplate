import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

describe("Hono App Integration", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("Basic routing", () => {
    it("should handle GET requests", async () => {
      app.get("/test", (c) => c.json({ message: "GET works" }));

      const res = await app.request("/test");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { message: string };
      expect(json.message).toBe("GET works");
    });

    it("should handle POST requests with JSON body", async () => {
      app.post("/test", async (c) => {
        const body = await c.req.json();
        return c.json({ received: body });
      });

      const res = await app.request("/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });

      expect(res.status).toBe(200);

      const json = (await res.json()) as { received: { name: string } };
      expect(json.received.name).toBe("test");
    });

    it("should return 404 for unknown routes", async () => {
      const res = await app.request("/unknown");
      expect(res.status).toBe(404);
    });
  });

  describe("Zod validation middleware", () => {
    it("should validate request body with Zod", async () => {
      const schema = z.object({
        email: z.email(),
        name: z.string().min(1),
      });

      app.post("/validated", zValidator("json", schema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ success: true, data });
      });

      // Valid request
      const validRes = await app.request("/validated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com", name: "Test" }),
      });

      expect(validRes.status).toBe(200);
      const validJson = (await validRes.json()) as { success: boolean };
      expect(validJson.success).toBe(true);

      // Invalid request - bad email
      const invalidRes = await app.request("/validated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", name: "Test" }),
      });

      expect(invalidRes.status).toBe(400);
    });

    it("should validate query parameters", async () => {
      const querySchema = z.object({
        page: z.coerce.number().min(1).default(1),
        size: z.coerce.number().min(1).max(100).default(10),
      });

      app.get("/items", zValidator("query", querySchema), (c) => {
        const { page, size } = c.req.valid("query" as const);
        return c.json({ page, size });
      });

      const res = await app.request("/items?page=2&size=20");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { page: number; size: number };
      expect(json.page).toBe(2);
      expect(json.size).toBe(20);
    });
  });

  describe("Error handling", () => {
    it("should handle errors with onError", async () => {
      app.onError((err, c) => {
        return c.json({ error: err.message }, 500);
      });

      app.get("/error", () => {
        throw new Error("Test error");
      });

      const res = await app.request("/error");
      expect(res.status).toBe(500);

      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Test error");
    });
  });

  describe("Middleware", () => {
    it("should execute middleware in order", async () => {
      const order: string[] = [];

      app.use("*", async (c, next) => {
        order.push("middleware1");
        await next();
        order.push("middleware1-after");
      });

      app.use("*", async (c, next) => {
        order.push("middleware2");
        await next();
        order.push("middleware2-after");
      });

      app.get("/order", (c) => {
        order.push("handler");
        return c.json({ ok: true });
      });

      await app.request("/order");

      expect(order).toEqual([
        "middleware1",
        "middleware2",
        "handler",
        "middleware2-after",
        "middleware1-after",
      ]);
    });
  });
});
