import { zValidator } from "@hono/zod-validator";
import { asc, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../../db";
import { customerSubscriptions, users } from "../../db/schema";
import { apiRateLimiter, authMiddleware, requireAdmin, requireAuth } from "../../middleware";
import {
  ALLOWED_IMAGE_TYPES,
  deleteFile,
  isValidFileType,
  uploadFile,
} from "../../services/storage.service";
import { updateCustomerBillingInfo } from "../../services/stripe.service";

const usersRouter = new Hono();

// Apply auth middleware to all routes
usersRouter.use("*", authMiddleware);

// Schemas
const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  companyName: z.string().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(100).default(30),
});

const adminUpdateUserSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  isActive: z.boolean().optional(),
  isSuperuser: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  maxTeams: z.number().optional(),
});

/**
 * Get current user
 * GET /users/me
 */
usersRouter.get("/me", requireAuth, async (c) => {
  const user = c.get("user");

  return c.json({
    id: user!.id,
    email: user!.email,
    name: user!.name,
    role: user!.role,
    status: user!.status,
    is_active: user!.isActive,
    is_superuser: user!.isSuperuser,
    is_verified: user!.isVerified,
    max_teams: user!.maxTeams,
    avatar_url: user!.avatarUrl,
    phone: user!.phone,
    company: user!.company,
    job_title: user!.jobTitle,
    country: user!.country,
    timezone: user!.timezone,
    bio: user!.bio,
    website: user!.website,
    tax_id: user!.taxId,
    address_street: user!.addressStreet,
    address_city: user!.addressCity,
    address_state: user!.addressState,
    address_postal_code: user!.addressPostalCode,
    company_name: user!.companyName,
    onboarding_completed: user!.onboardingCompleted,
    onboarding_step: user!.onboardingStep,
    created_at: user!.createdAt?.toISOString(),
    updated_at: user!.updatedAt?.toISOString(),
  });
});

/**
 * Update current user
 * PATCH /users/me
 */
usersRouter.patch("/me", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  try {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user!.id))
      .returning();

    if (!updated) {
      return c.json({ detail: "Failed to update user" }, 500);
    }

    // Sync billing info to Stripe customer metadata if billing fields were updated
    const hasBillingUpdate = data.taxId || data.addressStreet || data.addressCity || 
      data.addressState || data.addressPostalCode || data.country || data.companyName;
    
    if (hasBillingUpdate) {
      // Find user's Stripe customer ID from their subscription
      const [subscription] = await db
        .select({ stripeCustomerId: customerSubscriptions.stripeCustomerId })
        .from(customerSubscriptions)
        .innerJoin(
          db.select().from(users).where(eq(users.id, updated.id)).as("u"),
          sql`true` // We'll filter by org membership in a real implementation
        )
        .limit(1);

      if (subscription?.stripeCustomerId) {
        // Sync to Stripe for NFSE/invoice compliance
        await updateCustomerBillingInfo({
          customerId: subscription.stripeCustomerId,
          name: updated.companyName || updated.name || undefined,
          email: updated.email,
          taxId: updated.taxId || undefined,
          address: {
            line1: updated.addressStreet || undefined,
            city: updated.addressCity || undefined,
            state: updated.addressState || undefined,
            postal_code: updated.addressPostalCode || undefined,
            country: updated.country || undefined,
          },
          metadata: {
            company_name: updated.companyName || "",
            user_id: String(updated.id),
          },
        }).catch((err) => {
          console.warn("Failed to sync billing info to Stripe:", err);
          // Don't fail the request if Stripe sync fails
        });
      }
    }

    return c.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      status: updated.status,
      is_active: updated.isActive,
      is_superuser: updated.isSuperuser,
      is_verified: updated.isVerified,
      max_teams: updated.maxTeams,
      avatar_url: updated.avatarUrl,
      phone: updated.phone,
      company: updated.company,
      job_title: updated.jobTitle,
      country: updated.country,
      timezone: updated.timezone,
      bio: updated.bio,
      website: updated.website,
      tax_id: updated.taxId,
      address_street: updated.addressStreet,
      address_city: updated.addressCity,
      address_state: updated.addressState,
      address_postal_code: updated.addressPostalCode,
      company_name: updated.companyName,
      onboarding_completed: updated.onboardingCompleted,
      onboarding_step: updated.onboardingStep,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Update user error:", error);
    return c.json({ detail: "Failed to update user" }, 500);
  }
});

/**
 * Upload profile image
 * POST /users/profile/image
 */
usersRouter.post("/profile/image", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!file || !(file instanceof File)) {
      return c.json({ detail: "No file provided" }, 400);
    }

    if (!isValidFileType(file.type, ALLOWED_IMAGE_TYPES)) {
      return c.json({ detail: "Invalid file type" }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ detail: "File too large (max 5MB)" }, 400);
    }

    // Delete old avatar if exists
    if (user!.avatarUrl) {
      const oldKey = user!.avatarUrl.split("/").slice(-2).join("/");
      await deleteFile(oldKey);
    }

    // Upload new avatar
    const result = await uploadFile({
      file,
      filename: file.name,
      folder: "avatars",
      contentType: file.type,
      userId: user!.id,
    });

    if (!result) {
      return c.json({ detail: "Upload failed" }, 500);
    }

    // Update user avatar URL
    await db
      .update(users)
      .set({ avatarUrl: result.url, updatedAt: new Date() })
      .where(eq(users.id, user!.id));

    return c.json({ avatar_url: result.url });
  } catch (error) {
    console.error("Upload avatar error:", error);
    return c.json({ detail: "Upload failed" }, 500);
  }
});

/**
 * Delete profile image
 * DELETE /users/profile/image
 */
usersRouter.delete("/profile/image", requireAuth, async (c) => {
  const user = c.get("user");

  try {
    if (user!.avatarUrl) {
      const key = user!.avatarUrl.split("/").slice(-2).join("/");
      await deleteFile(key);

      await db
        .update(users)
        .set({ avatarUrl: null, updatedAt: new Date() })
        .where(eq(users.id, user!.id));
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete avatar error:", error);
    return c.json({ detail: "Delete failed" }, 500);
  }
});

// ============= Admin Routes =============

/**
 * List all users (admin)
 * GET /users/admin/users
 */
usersRouter.get(
  "/admin/users",
  requireAdmin,
  apiRateLimiter,
  zValidator(
    "query",
    paginationSchema.extend({
      search: z.string().optional(),
      status: z.string().optional(),
      role: z.string().optional(),
      sortBy: z.enum(["createdAt", "email", "name"]).default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }),
  ),
  async (c) => {
    const { page, size, search, status, role, sortBy, sortOrder } = c.req.valid("query");

    try {
      const offset = (page - 1) * size;

      // Build where conditions
      const conditions = [];
      if (search) {
        conditions.push(
          sql`(${users.email} ILIKE ${`%${search}%`} OR ${users.name} ILIKE ${`%${search}%`})`,
        );
      }
      if (status) {
        conditions.push(eq(users.status, status));
      }
      if (role) {
        conditions.push(eq(users.role, role));
      }

      const whereClause =
        conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause);

      const count = countResult[0]?.count ?? 0;

      // Get users
      const sortColumn =
        sortBy === "email" ? users.email : sortBy === "name" ? users.name : users.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const items = await db
        .select()
        .from(users)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(size)
        .offset(offset);

      return c.json({
        items: items.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          is_active: u.isActive,
          is_superuser: u.isSuperuser,
          is_verified: u.isVerified,
          created_at: u.createdAt?.toISOString(),
          updated_at: u.updatedAt?.toISOString(),
        })),
        total: Number(count),
        page,
        size,
        pages: Math.ceil(Number(count) / size),
      });
    } catch (error) {
      console.error("List users error:", error);
      return c.json({ detail: "Failed to list users" }, 500);
    }
  },
);

/**
 * Get user by ID (admin)
 * GET /users/admin/users/:id
 */
usersRouter.get("/admin/users/:id", requireAdmin, async (c) => {
  const id = parseInt(c.req.param("id"), 10);

  try {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!user) {
      return c.json({ detail: "User not found" }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      is_active: user.isActive,
      is_superuser: user.isSuperuser,
      is_verified: user.isVerified,
      max_teams: user.maxTeams,
      avatar_url: user.avatarUrl,
      phone: user.phone,
      company: user.company,
      job_title: user.jobTitle,
      country: user.country,
      timezone: user.timezone,
      bio: user.bio,
      website: user.website,
      tax_id: user.taxId,
      address_street: user.addressStreet,
      address_city: user.addressCity,
      address_state: user.addressState,
      address_postal_code: user.addressPostalCode,
      company_name: user.companyName,
      onboarding_completed: user.onboardingCompleted,
      onboarding_step: user.onboardingStep,
      created_at: user.createdAt?.toISOString(),
      updated_at: user.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return c.json({ detail: "Failed to get user" }, 500);
  }
});

/**
 * Update user (admin)
 * PATCH /users/admin/users/:id
 */
usersRouter.patch(
  "/admin/users/:id",
  requireAdmin,
  zValidator("json", adminUpdateUserSchema),
  async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    const data = c.req.valid("json");

    try {
      const [updated] = await db
        .update(users)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updated) {
        return c.json({ detail: "User not found" }, 404);
      }

      return c.json({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        is_active: updated.isActive,
        is_superuser: updated.isSuperuser,
        is_verified: updated.isVerified,
        updated_at: updated.updatedAt?.toISOString(),
      });
    } catch (error) {
      console.error("Update user error:", error);
      return c.json({ detail: "Failed to update user" }, 500);
    }
  },
);

/**
 * Delete user (admin)
 * DELETE /users/admin/users/:id
 */
usersRouter.delete("/admin/users/:id", requireAdmin, async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const currentUser = c.get("user");

  // Prevent self-deletion
  if (currentUser!.id === id) {
    return c.json({ detail: "Cannot delete yourself" }, 400);
  }

  try {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();

    if (!deleted) {
      return c.json({ detail: "User not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return c.json({ detail: "Failed to delete user" }, 500);
  }
});

export default usersRouter;
