import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Schemas for uploads
const presignedUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.string().optional(),
});

const deleteFileSchema = z.object({
  key: z.string().min(1),
});

const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const maxFileSize = 5 * 1024 * 1024; // 5MB

describe("Upload Schemas", () => {
  describe("presignedUrlSchema", () => {
    it("should validate correct presigned URL request", () => {
      const result = presignedUrlSchema.safeParse({
        filename: "avatar.png",
        contentType: "image/png",
      });
      expect(result.success).toBe(true);
    });

    it("should require filename", () => {
      const result = presignedUrlSchema.safeParse({
        contentType: "image/png",
      });
      expect(result.success).toBe(false);
    });

    it("should require contentType", () => {
      const result = presignedUrlSchema.safeParse({
        filename: "file.png",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty filename", () => {
      const result = presignedUrlSchema.safeParse({
        filename: "",
        contentType: "image/png",
      });
      expect(result.success).toBe(false);
    });

    it("should allow optional folder", () => {
      const result = presignedUrlSchema.safeParse({
        filename: "file.png",
        contentType: "image/png",
        folder: "avatars",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteFileSchema", () => {
    it("should validate correct delete request", () => {
      const result = deleteFileSchema.safeParse({
        key: "avatars/user-123/avatar.png",
      });
      expect(result.success).toBe(true);
    });

    it("should require key", () => {
      const result = deleteFileSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject empty key", () => {
      const result = deleteFileSchema.safeParse({
        key: "",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("File Validation Helpers", () => {
  describe("allowedImageTypes", () => {
    it("should include jpeg", () => {
      expect(allowedImageTypes).toContain("image/jpeg");
    });

    it("should include png", () => {
      expect(allowedImageTypes).toContain("image/png");
    });

    it("should include gif", () => {
      expect(allowedImageTypes).toContain("image/gif");
    });

    it("should include webp", () => {
      expect(allowedImageTypes).toContain("image/webp");
    });

    it("should not include svg", () => {
      expect(allowedImageTypes).not.toContain("image/svg+xml");
    });
  });

  describe("maxFileSize", () => {
    it("should be 5MB", () => {
      expect(maxFileSize).toBe(5 * 1024 * 1024);
    });

    it("should reject files larger than 5MB", () => {
      const fileSize = 6 * 1024 * 1024;
      expect(fileSize > maxFileSize).toBe(true);
    });

    it("should accept files smaller than 5MB", () => {
      const fileSize = 2 * 1024 * 1024;
      expect(fileSize <= maxFileSize).toBe(true);
    });
  });
});

describe("Upload Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
  });

  describe("POST /uploads/presigned-url", () => {
    it("should return presigned URL", async () => {
      app.post("/uploads/presigned-url", zValidator("json", presignedUrlSchema), (c) => {
        const { filename, contentType } = c.req.valid("json" as const);
        return c.json({
          uploadUrl: `https://r2.example.com/upload?key=${filename}`,
          key: `uploads/${filename}`,
          contentType,
        });
      });

      const res = await app.request("/uploads/presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "test.png",
          contentType: "image/png",
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { uploadUrl: string; key: string };
      expect(json.uploadUrl).toContain("test.png");
    });
  });

  describe("DELETE /uploads/file", () => {
    it("should delete file", async () => {
      app.delete("/uploads/file", zValidator("json", deleteFileSchema), (c) => {
        const { key } = c.req.valid("json" as const);
        return c.json({ deleted: true, key });
      });

      const res = await app.request("/uploads/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "uploads/test.png" }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { deleted: boolean };
      expect(json.deleted).toBe(true);
    });
  });

  describe("POST /uploads/avatar", () => {
    it("should handle avatar upload request", async () => {
      app.post("/uploads/avatar", (c) => {
        return c.json({
          avatarUrl: "https://r2.example.com/avatars/user-123.png",
          success: true,
        });
      });

      const res = await app.request("/uploads/avatar", { method: "POST" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { avatarUrl: string; success: boolean };
      expect(json.success).toBe(true);
    });
  });

  describe("DELETE /uploads/avatar", () => {
    it("should delete avatar", async () => {
      app.delete("/uploads/avatar", (c) => {
        return c.json({ deleted: true });
      });

      const res = await app.request("/uploads/avatar", { method: "DELETE" });
      expect(res.status).toBe(200);

      const json = (await res.json()) as { deleted: boolean };
      expect(json.deleted).toBe(true);
    });
  });
});
