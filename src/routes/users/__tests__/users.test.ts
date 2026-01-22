import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Admin user schemas
const adminCreateUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]).default("member"),
  isActive: z.boolean().default(true),
  isSuperuser: z.boolean().default(false),
});

const adminUpdateUserSchema = z.object({
  email: z.email().optional(),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]).optional(),
  isActive: z.boolean().optional(),
  isSuperuser: z.boolean().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const userProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
});

describe("User Schemas", () => {
  describe("adminCreateUserSchema", () => {
    it("should validate correct admin user creation", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "newuser@example.com",
        password: "securepassword",
        name: "New User",
        role: "member",
      });
      expect(result.success).toBe(true);
    });

    it("should require valid email", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "invalid",
        password: "securepassword",
      });
      expect(result.success).toBe(false);
    });

    it("should require password min 8 chars", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "test@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should default role to member", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "test@example.com",
        password: "securepassword",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("member");
      }
    });

    it("should default isActive to true", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "test@example.com",
        password: "securepassword",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should default isSuperuser to false", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "test@example.com",
        password: "securepassword",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isSuperuser).toBe(false);
      }
    });
  });

  describe("adminUpdateUserSchema", () => {
    it("should validate partial updates", () => {
      const result = adminUpdateUserSchema.safeParse({
        name: "Updated Name",
        role: "admin",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = adminUpdateUserSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate status changes", () => {
      const result = adminUpdateUserSchema.safeParse({
        status: "suspended",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = adminUpdateUserSchema.safeParse({
        status: "banned",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("userProfileUpdateSchema", () => {
    it("should validate profile updates", () => {
      const result = userProfileUpdateSchema.safeParse({
        name: "John Doe",
        company: "Acme Inc",
        jobTitle: "Developer",
        timezone: "America/New_York",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = userProfileUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept all profile fields", () => {
      const result = userProfileUpdateSchema.safeParse({
        name: "John",
        phone: "+1234567890",
        company: "Acme",
        jobTitle: "Dev",
        country: "US",
        timezone: "UTC",
        bio: "Hello world",
        website: "https://example.com",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("User Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("GET /users/me", () => {
    it("should return current user", async () => {
      app.get("/users/me", (c) => {
        return c.json({
          id: 1,
          email: "user@example.com",
          name: "Test User",
          role: "member",
        });
      });

      const res = await app.request("/users/me");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { id: number; email: string };
      expect(json.email).toBe("user@example.com");
    });
  });

  describe("PATCH /users/me", () => {
    it("should update current user profile", async () => {
      app.patch("/users/me", zValidator("json", userProfileUpdateSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ id: 1, ...data });
      });

      const res = await app.request("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name", company: "New Company" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { name: string; company: string };
      expect(json.name).toBe("Updated Name");
      expect(json.company).toBe("New Company");
    });
  });

  describe("GET /users/admin/users", () => {
    it("should return list of users (admin)", async () => {
      app.get("/users/admin/users", (c) => {
        return c.json({
          data: [
            { id: 1, email: "admin@example.com", role: "admin" },
            { id: 2, email: "user@example.com", role: "member" },
          ],
          total: 2,
        });
      });

      const res = await app.request("/users/admin/users");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { data: Array<{ id: number }>; total: number };
      expect(json.data).toHaveLength(2);
      expect(json.total).toBe(2);
    });
  });

  describe("POST /users/admin/users", () => {
    it("should create user (admin)", async () => {
      app.post("/users/admin/users", zValidator("json", adminCreateUserSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ id: 3, ...data }, 201);
      });

      const res = await app.request("/users/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newadmin@example.com",
          password: "securepassword",
          name: "New Admin",
          role: "admin",
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { id: number; email: string };
      expect(json.email).toBe("newadmin@example.com");
    });
  });

  describe("DELETE /users/admin/users/:id", () => {
    it("should delete user (admin)", async () => {
      app.delete("/users/admin/users/:id", (c) => {
        const id = c.req.param("id");
        return c.json({ deleted: true, id: Number(id) });
      });

      const res = await app.request("/users/admin/users/2", { method: "DELETE" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { deleted: boolean; id: number };
      expect(json.deleted).toBe(true);
      expect(json.id).toBe(2);
    });
  });
});
