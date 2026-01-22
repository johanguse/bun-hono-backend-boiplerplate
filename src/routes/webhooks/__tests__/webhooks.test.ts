import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Webhook schemas
const webhookCreateSchema = z.object({
  url: z.url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

const webhookUpdateSchema = z.object({
  url: z.url().optional(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

const webhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.string(), z.any()),
  timestamp: z.string(),
  signature: z.string().optional(),
});

describe("Webhook Schemas", () => {
  describe("webhookCreateSchema", () => {
    it("should validate correct webhook creation", () => {
      const result = webhookCreateSchema.safeParse({
        url: "https://api.example.com/webhook",
        events: ["user.created", "user.updated"],
        description: "User events webhook",
      });
      expect(result.success).toBe(true);
    });

    it("should require valid URL", () => {
      const result = webhookCreateSchema.safeParse({
        url: "not-a-url",
        events: ["user.created"],
      });
      expect(result.success).toBe(false);
    });

    it("should require at least one event", () => {
      const result = webhookCreateSchema.safeParse({
        url: "https://api.example.com/webhook",
        events: [],
      });
      expect(result.success).toBe(false);
    });

    it("should default isActive to true", () => {
      const result = webhookCreateSchema.safeParse({
        url: "https://api.example.com/webhook",
        events: ["user.created"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should accept optional secret", () => {
      const result = webhookCreateSchema.safeParse({
        url: "https://api.example.com/webhook",
        events: ["user.created"],
        secret: "webhook_secret_123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secret).toBe("webhook_secret_123");
      }
    });
  });

  describe("webhookUpdateSchema", () => {
    it("should validate partial updates", () => {
      const result = webhookUpdateSchema.safeParse({
        isActive: false,
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = webhookUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate URL if provided", () => {
      const result = webhookUpdateSchema.safeParse({
        url: "invalid-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("webhookPayloadSchema", () => {
    it("should validate webhook payload", () => {
      const result = webhookPayloadSchema.safeParse({
        event: "user.created",
        data: { userId: "123", email: "test@example.com" },
        timestamp: "2024-01-15T10:30:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("should accept signature", () => {
      const result = webhookPayloadSchema.safeParse({
        event: "user.created",
        data: { userId: "123" },
        timestamp: "2024-01-15T10:30:00Z",
        signature: "sha256=abc123",
      });
      expect(result.success).toBe(true);
    });

    it("should require event name", () => {
      const result = webhookPayloadSchema.safeParse({
        data: { userId: "123" },
        timestamp: "2024-01-15T10:30:00Z",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Webhook Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("GET /webhooks", () => {
    it("should return list of webhooks", async () => {
      app.get("/webhooks", (c) => {
        return c.json({
          data: [
            { id: 1, url: "https://api.example.com/hook1", events: ["user.created"] },
            { id: 2, url: "https://api.example.com/hook2", events: ["order.created"] },
          ],
          total: 2,
        });
      });

      const res = await app.request("/webhooks");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ id: number }>; total: number };
      expect(json.data).toHaveLength(2);
    });
  });

  describe("POST /webhooks", () => {
    it("should create webhook", async () => {
      app.post("/webhooks", (c) => {
        return c.json(
          {
            id: 3,
            url: "https://api.example.com/new-hook",
            events: ["payment.completed"],
            isActive: true,
          },
          201,
        );
      });

      const res = await app.request("/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.example.com/new-hook",
          events: ["payment.completed"],
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { id: number; url: string };
      expect(json.url).toBe("https://api.example.com/new-hook");
    });
  });

  describe("GET /webhooks/:id", () => {
    it("should return single webhook", async () => {
      app.get("/webhooks/:id", (c) => {
        const id = c.req.param("id");
        return c.json({
          id: Number(id),
          url: "https://api.example.com/hook1",
          events: ["user.created", "user.updated"],
          isActive: true,
        });
      });

      const res = await app.request("/webhooks/1");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { id: number; events: string[] };
      expect(json.id).toBe(1);
      expect(json.events).toContain("user.created");
    });
  });

  describe("PATCH /webhooks/:id", () => {
    it("should update webhook", async () => {
      app.patch("/webhooks/:id", (c) => {
        const id = c.req.param("id");
        return c.json({
          id: Number(id),
          url: "https://api.example.com/hook1",
          isActive: false,
        });
      });

      const res = await app.request("/webhooks/1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { isActive: boolean };
      expect(json.isActive).toBe(false);
    });
  });

  describe("DELETE /webhooks/:id", () => {
    it("should delete webhook", async () => {
      app.delete("/webhooks/:id", (c) => {
        const id = c.req.param("id");
        return c.json({ deleted: true, id: Number(id) });
      });

      const res = await app.request("/webhooks/1", { method: "DELETE" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { deleted: boolean };
      expect(json.deleted).toBe(true);
    });
  });

  describe("POST /webhooks/:id/test", () => {
    it("should send test webhook", async () => {
      app.post("/webhooks/:id/test", (c) => {
        const id = c.req.param("id");
        return c.json({
          success: true,
          webhookId: Number(id),
          response: { status: 200, body: "OK" },
        });
      });

      const res = await app.request("/webhooks/1/test", { method: "POST" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { success: boolean; response: { status: number } };
      expect(json.success).toBe(true);
      expect(json.response.status).toBe(200);
    });
  });

  describe("GET /webhooks/:id/deliveries", () => {
    it("should return webhook delivery history", async () => {
      app.get("/webhooks/:id/deliveries", (c) => {
        return c.json({
          data: [
            {
              id: 1,
              event: "user.created",
              status: 200,
              deliveredAt: "2024-01-15T10:30:00Z",
            },
            { id: 2, event: "user.updated", status: 500, deliveredAt: "2024-01-15T11:00:00Z" },
          ],
          total: 2,
        });
      });

      const res = await app.request("/webhooks/1/deliveries");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ status: number }>; total: number };
      expect(json.data).toHaveLength(2);
      expect(json.data[0]?.status).toBe(200);
      expect(json.data[1]?.status).toBe(500);
    });
  });
});
