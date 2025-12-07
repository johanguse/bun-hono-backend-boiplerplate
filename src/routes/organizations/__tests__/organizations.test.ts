import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod/v4";

// Schemas matching the actual implementation
const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

const inviteMemberSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  message: z.string().optional(),
});

describe("Organization Schemas", () => {
  describe("createOrgSchema", () => {
    it("should validate correct organization data", () => {
      const result = createOrgSchema.safeParse({
        name: "My Organization",
        description: "A test organization",
      });
      expect(result.success).toBe(true);
    });

    it("should require name", () => {
      const result = createOrgSchema.safeParse({
        description: "A test organization",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = createOrgSchema.safeParse({
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 100 characters", () => {
      const result = createOrgSchema.safeParse({
        name: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should allow optional description", () => {
      const result = createOrgSchema.safeParse({
        name: "My Organization",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateOrgSchema", () => {
    it("should validate partial updates", () => {
      const result = updateOrgSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = updateOrgSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate description only update", () => {
      const result = updateOrgSchema.safeParse({
        description: "New description",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("inviteMemberSchema", () => {
    it("should validate correct invite data", () => {
      const result = inviteMemberSchema.safeParse({
        email: "member@example.com",
        role: "member",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = inviteMemberSchema.safeParse({
        email: "invalid-email",
        role: "member",
      });
      expect(result.success).toBe(false);
    });

    it("should default role to member", () => {
      const result = inviteMemberSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("member");
      }
    });

    it("should accept admin role", () => {
      const result = inviteMemberSchema.safeParse({
        email: "admin@example.com",
        role: "admin",
      });
      expect(result.success).toBe(true);
    });

    it("should accept viewer role", () => {
      const result = inviteMemberSchema.safeParse({
        email: "viewer@example.com",
        role: "viewer",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", () => {
      const result = inviteMemberSchema.safeParse({
        email: "test@example.com",
        role: "superadmin",
      });
      expect(result.success).toBe(false);
    });

    it("should allow optional message", () => {
      const result = inviteMemberSchema.safeParse({
        email: "test@example.com",
        role: "member",
        message: "Welcome to the team!",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Organization Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("POST /organizations", () => {
    it("should validate organization creation", async () => {
      app.post("/organizations", zValidator("json", createOrgSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ id: 1, ...data }, 201);
      });

      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Org", description: "Test" }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { id: number; name: string };
      expect(json.name).toBe("Test Org");
    });

    it("should reject invalid data", async () => {
      app.post("/organizations", zValidator("json", createOrgSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ id: 1, ...data }, 201);
      });

      const res = await app.request("/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: "Missing name" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /organizations/:id/invite", () => {
    it("should validate invite data", async () => {
      app.post("/organizations/:id/invite", zValidator("json", inviteMemberSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ success: true, invited: data.email });
      });

      const res = await app.request("/organizations/1/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "newmember@example.com", role: "member" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; invited: string };
      expect(json.invited).toBe("newmember@example.com");
    });
  });
});
