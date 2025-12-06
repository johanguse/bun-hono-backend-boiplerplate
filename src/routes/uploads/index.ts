import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { users } from "../../db/schema";
import { env } from "../../lib/env";
import { apiRateLimiter, authMiddleware, requireAuth } from "../../middleware";
import {
  deleteFile,
  getPresignedUrl,
  getUploadPresignedUrl,
  uploadFile,
} from "../../services/storage.service";

// Helper to get public URL
function getPublicUrl(key: string): string {
  if (env.R2_PUBLIC_URL) {
    return `${env.R2_PUBLIC_URL}/${key}`;
  }
  return `${env.R2_ENDPOINT_URL}/${env.R2_BUCKET_NAME || "uploads"}/${key}`;
}

const uploadsRouter = new Hono();

// Schemas
const presignedUrlSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  folder: z.enum(["avatars", "logos", "attachments", "documents"]).default("attachments"),
});

const deleteFileSchema = z.object({
  key: z.string().min(1),
});

const downloadUrlSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.coerce.number().min(60).max(3600).default(3600),
});

// Protected routes
uploadsRouter.use("*", authMiddleware, requireAuth, apiRateLimiter);

/**
 * Get presigned upload URL
 * POST /uploads/presigned-url
 */
uploadsRouter.post("/presigned-url", zValidator("json", presignedUrlSchema), async (c) => {
  const user = c.get("user");
  const { filename, contentType, folder } = c.req.valid("json");

  try {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

    const result = await getUploadPresignedUrl({
      filename: sanitizedFilename,
      folder,
      contentType,
      userId: user!.id,
    });

    if (!result) {
      return c.json({ detail: "Failed to generate upload URL" }, 500);
    }

    return c.json({
      upload_url: result.uploadUrl,
      key: result.key,
      public_url: getPublicUrl(result.key),
      expires_in: 3600,
    });
  } catch (error) {
    console.error("Generate presigned URL error:", error);
    return c.json({ detail: "Failed to generate upload URL" }, 500);
  }
});

/**
 * Get presigned download URL
 * POST /uploads/download-url
 */
uploadsRouter.post("/download-url", zValidator("json", downloadUrlSchema), async (c) => {
  const { key, expiresIn } = c.req.valid("json");

  try {
    const url = await getPresignedUrl(key, expiresIn);

    if (!url) {
      return c.json({ detail: "Failed to generate download URL" }, 500);
    }

    return c.json({
      download_url: url,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error("Generate download URL error:", error);
    return c.json({ detail: "Failed to generate download URL" }, 500);
  }
});

/**
 * Upload file directly
 * POST /uploads/file
 */
uploadsRouter.post("/file", async (c) => {
  const user = c.get("user");

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "attachments";

    if (!file) {
      return c.json({ detail: "No file provided" }, 400);
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ detail: "File too large. Maximum size is 10MB" }, 400);
    }

    // Validate content type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
    ];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ detail: "File type not allowed" }, 400);
    }

    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

    // Upload file
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile({
      file: buffer,
      filename: sanitizedFilename,
      folder,
      contentType: file.type,
      userId: user!.id,
    });

    if (!result) {
      return c.json({ detail: "Failed to upload file" }, 500);
    }

    return c.json({
      key: result.key,
      url: result.url,
      size: file.size,
      content_type: file.type,
      filename: file.name,
    });
  } catch (error) {
    console.error("Upload file error:", error);
    return c.json({ detail: "Failed to upload file" }, 500);
  }
});

/**
 * Delete file
 * DELETE /uploads/file
 */
uploadsRouter.delete("/file", zValidator("json", deleteFileSchema), async (c) => {
  const user = c.get("user");
  const { key } = c.req.valid("json");

  try {
    // Security: ensure user can only delete their own files
    // Admin can delete any file
    const isAdmin = user!.isSuperuser;
    const isOwner = key.includes(`/${user!.id}/`);

    if (!isAdmin && !isOwner) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const success = await deleteFile(key);

    if (!success) {
      return c.json({ detail: "Failed to delete file" }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return c.json({ detail: "Failed to delete file" }, 500);
  }
});

/**
 * Upload user avatar
 * POST /uploads/avatar
 */
uploadsRouter.post("/avatar", async (c) => {
  const user = c.get("user");

  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return c.json({ detail: "No file provided" }, 400);
    }

    // Validate file size (max 5MB for avatars)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ detail: "File too large. Maximum size is 5MB" }, 400);
    }

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ detail: "Only image files are allowed" }, 400);
    }

    const ext = file.name.split(".").pop() || "png";

    // Delete old avatar if exists
    const [currentUser] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);

    if (currentUser?.avatarUrl) {
      try {
        // Extract key from URL
        const oldKey = currentUser.avatarUrl.split("/").slice(-3).join("/");
        if (oldKey.startsWith("avatars/")) {
          await deleteFile(oldKey);
        }
      } catch {
        // Ignore deletion errors
      }
    }

    // Upload new avatar
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile({
      file: buffer,
      filename: `avatar.${ext}`,
      folder: "avatars",
      contentType: file.type,
      userId: user!.id,
    });

    if (!result) {
      return c.json({ detail: "Failed to upload avatar" }, 500);
    }

    const avatarUrl = result.url;

    // Update user
    await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, user!.id));

    return c.json({
      avatar_url: avatarUrl,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    return c.json({ detail: "Failed to upload avatar" }, 500);
  }
});

/**
 * Delete user avatar
 * DELETE /uploads/avatar
 */
uploadsRouter.delete("/avatar", async (c) => {
  const user = c.get("user");

  try {
    // Get current avatar
    const [currentUser] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);

    if (currentUser?.avatarUrl) {
      try {
        const oldKey = currentUser.avatarUrl.split("/").slice(-3).join("/");
        if (oldKey.startsWith("avatars/")) {
          await deleteFile(oldKey);
        }
      } catch {
        // Ignore deletion errors
      }
    }

    // Update user
    await db
      .update(users)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(users.id, user!.id));

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete avatar error:", error);
    return c.json({ detail: "Failed to delete avatar" }, 500);
  }
});

export default uploadsRouter;
