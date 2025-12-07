import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

describe("Zod v4 Validation", () => {
  describe("Basic types", () => {
    it("should validate strings", () => {
      const schema = z.string();
      expect(schema.safeParse("hello").success).toBe(true);
      expect(schema.safeParse(123).success).toBe(false);
    });

    it("should validate numbers", () => {
      const schema = z.number();
      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse("42").success).toBe(false);
    });

    it("should validate booleans", () => {
      const schema = z.boolean();
      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse("true").success).toBe(false);
    });
  });

  describe("String formats (Zod v4 syntax)", () => {
    it("should validate email with z.email()", () => {
      const schema = z.email();
      expect(schema.safeParse("test@example.com").success).toBe(true);
      expect(schema.safeParse("invalid-email").success).toBe(false);
    });

    it("should validate URL with z.url()", () => {
      const schema = z.url();
      expect(schema.safeParse("https://example.com").success).toBe(true);
      expect(schema.safeParse("not-a-url").success).toBe(false);
    });

    it("should validate UUID with z.uuid()", () => {
      const schema = z.uuid();
      expect(schema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
      expect(schema.safeParse("not-a-uuid").success).toBe(false);
    });
  });

  describe("Object schemas", () => {
    it("should validate objects", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      expect(schema.safeParse({ name: "John", age: 30 }).success).toBe(true);
      expect(schema.safeParse({ name: "John" }).success).toBe(false);
    });

    it("should handle optional fields", () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });

      expect(schema.safeParse({ name: "John" }).success).toBe(true);
      expect(schema.safeParse({ name: "John", nickname: "Johnny" }).success).toBe(true);
    });

    it("should handle nullable fields", () => {
      const schema = z.object({
        name: z.string(),
        bio: z.string().nullable(),
      });

      expect(schema.safeParse({ name: "John", bio: null }).success).toBe(true);
      expect(schema.safeParse({ name: "John", bio: "Hello" }).success).toBe(true);
    });
  });

  describe("Array schemas", () => {
    it("should validate arrays", () => {
      const schema = z.array(z.string());
      expect(schema.safeParse(["a", "b", "c"]).success).toBe(true);
      expect(schema.safeParse([1, 2, 3]).success).toBe(false);
    });

    it("should validate array with min/max", () => {
      const schema = z.array(z.number()).min(1).max(5);
      expect(schema.safeParse([1, 2, 3]).success).toBe(true);
      expect(schema.safeParse([]).success).toBe(false);
      expect(schema.safeParse([1, 2, 3, 4, 5, 6]).success).toBe(false);
    });
  });

  describe("Enum schemas", () => {
    it("should validate enums", () => {
      const schema = z.enum(["admin", "member", "viewer"]);
      expect(schema.safeParse("admin").success).toBe(true);
      expect(schema.safeParse("invalid").success).toBe(false);
    });
  });

  describe("Coercion", () => {
    it("should coerce strings to numbers", () => {
      const schema = z.coerce.number();
      const result = schema.safeParse("42");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(42);
      }
    });

    it("should coerce strings to booleans", () => {
      const schema = z.coerce.boolean();
      expect(schema.safeParse("true").success).toBe(true);
    });
  });

  describe("Transforms", () => {
    it("should transform values", () => {
      const schema = z.string().transform((val) => val.toUpperCase());
      const result = schema.safeParse("hello");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("HELLO");
      }
    });

    it("should handle empty string transform to undefined", () => {
      const schema = z
        .string()
        .transform((val) => (val === "" ? undefined : val))
        .pipe(z.string().optional());

      expect(schema.safeParse("").success).toBe(true);
      expect(schema.safeParse("value").success).toBe(true);
    });
  });

  describe("Default values", () => {
    it("should apply defaults", () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default("member"),
      });

      const result = schema.safeParse({ name: "John" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("member");
      }
    });
  });

  describe("Error handling", () => {
    it("should provide error details", () => {
      const schema = z.object({
        email: z.email(),
        age: z.number().min(18),
      });

      const result = schema.safeParse({
        email: "invalid",
        age: 15,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
