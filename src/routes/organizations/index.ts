import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../../db";
import {
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
} from "../../db/schema";
import { authMiddleware, orgRateLimiter, requireAuth } from "../../middleware";
import { sendInvitationEmail } from "../../services/email.service";
import {
  ALLOWED_IMAGE_TYPES,
  deleteFile,
  isValidFileType,
  uploadFile,
} from "../../services/storage.service";

const orgsRouter = new Hono();

// Apply auth middleware to all routes
orgsRouter.use("*", authMiddleware, requireAuth);

// Schemas
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

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(100).default(30),
});

/**
 * Helper to check if user is org member with specific role
 */
async function checkOrgAccess(
  userId: number,
  orgId: number,
  allowedRoles?: string[],
): Promise<{ allowed: boolean; role?: string }> {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId)),
    )
    .limit(1);

  if (!membership) {
    return { allowed: false };
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    return { allowed: false, role: membership.role };
  }

  return { allowed: true, role: membership.role };
}

/**
 * Create organization
 * POST /organizations
 */
orgsRouter.post("/", orgRateLimiter, zValidator("json", createOrgSchema), async (c) => {
  const user = c.get("user");
  const { name, description } = c.req.valid("json");

  try {
    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug: `${slug}-${Date.now()}`,
        description: description || null,
      })
      .returning();

    if (!org) {
      return c.json({ detail: "Failed to create organization" }, 500);
    }

    // Add user as owner
    await db.insert(organizationMembers).values({
      userId: user!.id,
      organizationId: org.id,
      role: "owner",
    });

    return c.json(
      {
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        logo_url: org.logoUrl,
        plan_name: org.planName,
        subscription_status: org.subscriptionStatus,
        max_projects: org.maxProjects,
        active_projects: org.activeProjects,
        created_at: org.createdAt?.toISOString(),
        updated_at: org.updatedAt?.toISOString(),
      },
      201,
    );
  } catch (error) {
    console.error("Create organization error:", error);
    return c.json({ detail: "Failed to create organization" }, 500);
  }
});

/**
 * Get user's organizations
 * GET /organizations
 */
orgsRouter.get("/", zValidator("query", paginationSchema), async (c) => {
  const user = c.get("user");
  const { page, size } = c.req.valid("query");

  try {
    const offset = (page - 1) * size;

    // Get organizations where user is a member
    const memberships = await db
      .select({
        organization: organizations,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, user!.id))
      .orderBy(desc(organizations.createdAt))
      .limit(size)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user!.id));

    const count = countResult[0]?.count ?? 0;

    return c.json({
      items: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        description: m.organization.description,
        logo_url: m.organization.logoUrl,
        plan_name: m.organization.planName,
        subscription_status: m.organization.subscriptionStatus,
        max_projects: m.organization.maxProjects,
        active_projects: m.organization.activeProjects,
        created_at: m.organization.createdAt?.toISOString(),
        updated_at: m.organization.updatedAt?.toISOString(),
        my_role: m.role,
      })),
      total: Number(count),
      page,
      size,
      pages: Math.ceil(Number(count) / size),
    });
  } catch (error) {
    console.error("List organizations error:", error);
    return c.json({ detail: "Failed to list organizations" }, 500);
  }
});

/**
 * Get organization by ID
 * GET /organizations/:id
 */
orgsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);

  try {
    // Check access
    const access = await checkOrgAccess(user!.id, orgId);
    if (!access.allowed) {
      return c.json({ detail: "Organization not found" }, 404);
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    if (!org) {
      return c.json({ detail: "Organization not found" }, 404);
    }

    // Get members
    const members = await db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));

    return c.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logo_url: org.logoUrl,
      plan_name: org.planName,
      subscription_status: org.subscriptionStatus,
      max_projects: org.maxProjects,
      active_projects: org.activeProjects,
      created_at: org.createdAt?.toISOString(),
      updated_at: org.updatedAt?.toISOString(),
      my_role: access.role,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          avatar_url: m.user.avatarUrl,
        },
        created_at: m.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return c.json({ detail: "Failed to get organization" }, 500);
  }
});

/**
 * Update organization
 * PUT /organizations/:id
 */
orgsRouter.put("/:id", zValidator("json", updateOrgSchema), async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);
  const data = c.req.valid("json");

  try {
    // Check access (owner or admin only)
    const access = await checkOrgAccess(user!.id, orgId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const [updated] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    if (!updated) {
      return c.json({ detail: "Organization not found" }, 404);
    }

    return c.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      logo_url: updated.logoUrl,
      plan_name: updated.planName,
      subscription_status: updated.subscriptionStatus,
      max_projects: updated.maxProjects,
      active_projects: updated.activeProjects,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Update organization error:", error);
    return c.json({ detail: "Failed to update organization" }, 500);
  }
});

/**
 * Delete organization
 * DELETE /organizations/:id
 */
orgsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);

  try {
    // Check access (owner only)
    const access = await checkOrgAccess(user!.id, orgId, ["owner"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    await db.delete(organizations).where(eq(organizations.id, orgId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete organization error:", error);
    return c.json({ detail: "Failed to delete organization" }, 500);
  }
});

/**
 * Upload organization logo
 * POST /organizations/:id/logo
 */
orgsRouter.post("/:id/logo", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);

  try {
    // Check access
    const access = await checkOrgAccess(user!.id, orgId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

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

    // Get org
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    // Delete old logo if exists
    if (org?.logoUrl) {
      const oldKey = org.logoUrl.split("/").slice(-2).join("/");
      await deleteFile(oldKey);
    }

    // Upload new logo
    const result = await uploadFile({
      file,
      filename: file.name,
      folder: "org-logos",
      contentType: file.type,
    });

    if (!result) {
      return c.json({ detail: "Upload failed" }, 500);
    }

    // Update org logo URL
    await db
      .update(organizations)
      .set({ logoUrl: result.url, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    return c.json({ logo_url: result.url });
  } catch (error) {
    console.error("Upload logo error:", error);
    return c.json({ detail: "Upload failed" }, 500);
  }
});

/**
 * Delete organization logo
 * DELETE /organizations/:id/logo
 */
orgsRouter.delete("/:id/logo", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);

  try {
    const access = await checkOrgAccess(user!.id, orgId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    if (org?.logoUrl) {
      const key = org.logoUrl.split("/").slice(-2).join("/");
      await deleteFile(key);

      await db
        .update(organizations)
        .set({ logoUrl: null, updatedAt: new Date() })
        .where(eq(organizations.id, orgId));
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete logo error:", error);
    return c.json({ detail: "Delete failed" }, 500);
  }
});

/**
 * Invite member to organization
 * POST /organizations/:id/invite
 */
orgsRouter.post("/:id/invite", zValidator("json", inviteMemberSchema), async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);
  const { email, role, message } = c.req.valid("json");

  try {
    // Check access (owner or admin only)
    const access = await checkOrgAccess(user!.id, orgId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    // Check if already a member
    const [invitee] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (invitee) {
      const [existingMembership] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, invitee.id),
            eq(organizationMembers.organizationId, orgId),
          ),
        )
        .limit(1);

      if (existingMembership) {
        return c.json({ detail: "User is already a member" }, 400);
      }
    }

    // Check for existing pending invitation
    const [existingInvite] = await db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.email, email),
          eq(organizationInvitations.organizationId, orgId),
          eq(organizationInvitations.status, "pending"),
        ),
      )
      .limit(1);

    if (existingInvite) {
      return c.json({ detail: "Invitation already sent" }, 400);
    }

    // Get organization
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    // Create invitation
    const [invitation] = await db
      .insert(organizationInvitations)
      .values({
        organizationId: orgId,
        invitedById: user!.id,
        email,
        role,
        status: "pending",
        inviteeId: invitee?.id || null,
      })
      .returning();

    if (!invitation) {
      return c.json({ detail: "Failed to create invitation" }, 500);
    }

    // Send invitation email
    await sendInvitationEmail(
      email,
      user!.name || user!.email,
      org!.name,
      String(invitation.id),
      message,
    );

    return c.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      created_at: invitation.createdAt?.toISOString(),
    });
  } catch (error) {
    console.error("Invite member error:", error);
    return c.json({ detail: "Failed to send invitation" }, 500);
  }
});

/**
 * Get organization members
 * GET /organizations/:id/members
 */
orgsRouter.get("/:id/members", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);

  try {
    const access = await checkOrgAccess(user!.id, orgId);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const members = await db
      .select({
        id: organizationMembers.id,
        role: organizationMembers.role,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
        createdAt: organizationMembers.createdAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, orgId));

    return c.json({
      items: members.map((m) => ({
        id: m.id,
        role: m.role,
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          avatar_url: m.user.avatarUrl,
        },
        created_at: m.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List members error:", error);
    return c.json({ detail: "Failed to list members" }, 500);
  }
});

/**
 * Remove member from organization
 * DELETE /organizations/:id/members/:memberId
 */
orgsRouter.delete("/:id/members/:memberId", async (c) => {
  const user = c.get("user");
  const orgId = parseInt(c.req.param("id"), 10);
  const memberId = parseInt(c.req.param("memberId"), 10);

  try {
    // Check access (owner or admin only)
    const access = await checkOrgAccess(user!.id, orgId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    // Get member to be removed
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .limit(1);

    if (!member || member.organizationId !== orgId) {
      return c.json({ detail: "Member not found" }, 404);
    }

    // Can't remove owner
    if (member.role === "owner") {
      return c.json({ detail: "Cannot remove owner" }, 400);
    }

    // Can't remove yourself
    if (member.userId === user!.id) {
      return c.json({ detail: "Cannot remove yourself" }, 400);
    }

    await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return c.json({ detail: "Failed to remove member" }, 500);
  }
});

export default orgsRouter;
