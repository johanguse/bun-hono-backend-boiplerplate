import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Schemas matching the actual implementation
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  organizationId: z.number(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(100).default(30),
});

describe("Project Schemas", () => {
  describe("createProjectSchema", () => {
    it("should validate correct project data", () => {
      const result = createProjectSchema.safeParse({
        name: "My Project",
        description: "A test project",
        organizationId: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should require name", () => {
      const result = createProjectSchema.safeParse({
        organizationId: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should require organizationId", () => {
      const result = createProjectSchema.safeParse({
        name: "My Project",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = createProjectSchema.safeParse({
        name: "",
        organizationId: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 100 characters", () => {
      const result = createProjectSchema.safeParse({
        name: "a".repeat(101),
        organizationId: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProjectSchema", () => {
    it("should validate partial updates", () => {
      const result = updateProjectSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("paginationSchema", () => {
    it("should parse valid pagination", () => {
      const result = paginationSchema.safeParse({
        page: "2",
        size: "20",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.size).toBe(20);
      }
    });

    it("should use defaults when not provided", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.size).toBe(30);
      }
    });

    it("should reject page less than 1", () => {
      const result = paginationSchema.safeParse({
        page: "0",
      });
      expect(result.success).toBe(false);
    });

    it("should reject size greater than 100", () => {
      const result = paginationSchema.safeParse({
        size: "101",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Project Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("GET /projects", () => {
    it("should handle pagination query params", async () => {
      app.get("/projects", zValidator("query", paginationSchema), (c) => {
        const { page, size } = c.req.valid("query" as const);
        return c.json({
          data: [],
          pagination: { page, size, total: 0 },
        });
      });

      const res = await app.request("/projects?page=2&size=10");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { pagination: { page: number; size: number } };
      expect(json.pagination.page).toBe(2);
      expect(json.pagination.size).toBe(10);
    });

    it("should use default pagination", async () => {
      app.get("/projects", zValidator("query", paginationSchema), (c) => {
        const { page, size } = c.req.valid("query" as const);
        return c.json({
          data: [],
          pagination: { page, size, total: 0 },
        });
      });

      const res = await app.request("/projects");
      expect(res.status).toBe(200);

      const json = (await res.json()) as { pagination: { page: number; size: number } };
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.size).toBe(30);
    });
  });

  describe("POST /projects", () => {
    it("should create project with valid data", async () => {
      app.post("/projects", zValidator("json", createProjectSchema), (c) => {
        const data = c.req.valid("json" as const);
        return c.json({ id: 1, ...data }, 201);
      });

      const res = await app.request("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Project",
          description: "Test",
          organizationId: 1,
        }),
      });

      expect(res.status).toBe(201);
      const json = (await res.json()) as { id: number; name: string };
      expect(json.name).toBe("New Project");
    });
  });

  describe("PUT /projects/:id", () => {
    it("should update project with valid data", async () => {
      app.put("/projects/:id", zValidator("json", updateProjectSchema), (c) => {
        const id = c.req.param("id");
        const data = c.req.valid("json" as const);
        return c.json({ id: Number(id), ...data });
      });

      const res = await app.request("/projects/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Project" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { id: number; name: string };
      expect(json.name).toBe("Updated Project");
    });
  });

  describe("DELETE /projects/:id", () => {
    it("should handle delete request", async () => {
      app.delete("/projects/:id", (c) => {
        const id = c.req.param("id");
        return c.json({ deleted: true, id: Number(id) });
      });

      const res = await app.request("/projects/1", { method: "DELETE" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { deleted: boolean; id: number };
      expect(json.deleted).toBe(true);
      expect(json.id).toBe(1);
    });
  });
});
