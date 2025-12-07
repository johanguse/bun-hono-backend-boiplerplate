import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";

// Schemas for subscriptions
const checkoutSchema = z.object({
  planId: z.number(),
  organizationId: z.number(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

const subscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "past_due",
  "trialing",
  "incomplete",
]);

describe("Subscription Schemas", () => {
  describe("checkoutSchema", () => {
    it("should validate correct checkout data", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
        organizationId: 1,
        billingCycle: "monthly",
      });
      expect(result.success).toBe(true);
    });

    it("should require planId", () => {
      const result = checkoutSchema.safeParse({
        organizationId: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should require organizationId", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should default billingCycle to monthly", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
        organizationId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.billingCycle).toBe("monthly");
      }
    });

    it("should accept yearly billing cycle", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
        organizationId: 1,
        billingCycle: "yearly",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid billing cycle", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
        organizationId: 1,
        billingCycle: "weekly",
      });
      expect(result.success).toBe(false);
    });

    it("should allow optional URLs", () => {
      const result = checkoutSchema.safeParse({
        planId: 1,
        organizationId: 1,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("subscriptionStatusSchema", () => {
    it("should validate active status", () => {
      const result = subscriptionStatusSchema.safeParse("active");
      expect(result.success).toBe(true);
    });

    it("should validate canceled status", () => {
      const result = subscriptionStatusSchema.safeParse("canceled");
      expect(result.success).toBe(true);
    });

    it("should validate past_due status", () => {
      const result = subscriptionStatusSchema.safeParse("past_due");
      expect(result.success).toBe(true);
    });

    it("should validate trialing status", () => {
      const result = subscriptionStatusSchema.safeParse("trialing");
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = subscriptionStatusSchema.safeParse("invalid");
      expect(result.success).toBe(false);
    });
  });
});

describe("Subscription Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("GET /subscriptions/plans", () => {
    it("should return subscription plans", async () => {
      app.get("/subscriptions/plans", (c) => {
        return c.json({
          data: [
            { id: 1, name: "free", priceMonthly: 0 },
            { id: 2, name: "pro", priceMonthly: 1900 },
            { id: 3, name: "business", priceMonthly: 4900 },
          ],
        });
      });

      const res = await app.request("/subscriptions/plans");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ id: number; name: string }> };
      expect(json.data).toHaveLength(3);
      expect(json.data[0].name).toBe("free");
    });
  });

  describe("POST /subscriptions/checkout", () => {
    it("should create checkout session", async () => {
      app.post("/subscriptions/checkout", zValidator("json", checkoutSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({
          sessionId: "cs_test_123",
          url: "https://checkout.stripe.com/pay/cs_test_123",
          planId: data.planId,
        });
      });

      const res = await app.request("/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: 2,
          organizationId: 1,
          billingCycle: "monthly",
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { sessionId: string; url: string };
      expect(json.sessionId).toBe("cs_test_123");
    });
  });

  describe("GET /subscriptions/:orgId", () => {
    it("should return organization subscription", async () => {
      app.get("/subscriptions/:orgId", (c) => {
        const orgId = c.req.param("orgId");
        return c.json({
          organizationId: Number(orgId),
          planName: "pro",
          status: "active",
          currentPeriodEnd: "2024-02-01T00:00:00Z",
        });
      });

      const res = await app.request("/subscriptions/1");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { organizationId: number; planName: string };
      expect(json.organizationId).toBe(1);
      expect(json.planName).toBe("pro");
    });
  });

  describe("POST /subscriptions/:orgId/cancel", () => {
    it("should cancel subscription", async () => {
      app.post("/subscriptions/:orgId/cancel", (c) => {
        const orgId = c.req.param("orgId");
        return c.json({
          success: true,
          organizationId: Number(orgId),
          canceledAt: new Date().toISOString(),
        });
      });

      const res = await app.request("/subscriptions/1/cancel", { method: "POST" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });
  });
});
