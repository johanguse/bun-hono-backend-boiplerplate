import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../../db";
import { organizationMembers, organizations, projects } from "../../db/schema";
import { apiRateLimiter, authMiddleware, requireAuth } from "../../middleware";

const projectsRouter = new Hono();

// Apply auth middleware to all routes
projectsRouter.use("*", authMiddleware, requireAuth);

// Schemas
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
  organizationId: z.coerce.number().optional(),
});

/**
 * Helper to check if user has access to organization
 */
async function checkOrgAccess(userId: number, orgId: number): Promise<boolean> {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId)),
    )
    .limit(1);

  return !!membership;
}

/**
 * Create project
 * POST /projects
 */
projectsRouter.post("/", apiRateLimiter, zValidator("json", createProjectSchema), async (c) => {
  const user = c.get("user");
  const { name, description, organizationId } = c.req.valid("json");

  try {
    // Check org access
    const hasAccess = await checkOrgAccess(user!.id, organizationId);
    if (!hasAccess) {
      return c.json({ detail: "Organization not found" }, 404);
    }

    // Check project limit
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (org && org.activeProjects >= org.maxProjects) {
      return c.json({ detail: "Project limit reached. Please upgrade your plan." }, 403);
    }

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        name,
        description: description || null,
        organizationId,
      })
      .returning();

    if (!project) {
      return c.json({ detail: "Failed to create project" }, 500);
    }

    // Increment active projects count
    await db
      .update(organizations)
      .set({
        activeProjects: sql`${organizations.activeProjects} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    return c.json(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        organization_id: project.organizationId,
        created_at: project.createdAt?.toISOString(),
        updated_at: project.updatedAt?.toISOString(),
      },
      201,
    );
  } catch (error) {
    console.error("Create project error:", error);
    return c.json({ detail: "Failed to create project" }, 500);
  }
});

/**
 * List projects
 * GET /projects
 */
projectsRouter.get("/", zValidator("query", paginationSchema), async (c) => {
  const user = c.get("user");
  const { page, size, organizationId } = c.req.valid("query");

  try {
    const offset = (page - 1) * size;

    // Get user's organizations
    const userOrgs = await db
      .select({ orgId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, user!.id));

    const orgIds = userOrgs.map((o) => o.orgId);

    if (orgIds.length === 0) {
      return c.json({
        items: [],
        total: 0,
        page,
        size,
        pages: 0,
      });
    }

    // Filter by specific org if provided
    const targetOrgIds = organizationId ? orgIds.filter((id) => id === organizationId) : orgIds;

    if (targetOrgIds.length === 0) {
      return c.json({
        items: [],
        total: 0,
        page,
        size,
        pages: 0,
      });
    }

    // Get projects with org info
    const projectsWithOrg = await db
      .select({
        project: projects,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
      })
      .from(projects)
      .innerJoin(organizations, eq(projects.organizationId, organizations.id))
      .where(sql`${projects.organizationId} IN ${targetOrgIds}`)
      .orderBy(desc(projects.createdAt))
      .limit(size)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(sql`${projects.organizationId} IN ${targetOrgIds}`);

    const count = countResult[0]?.count ?? 0;

    return c.json({
      items: projectsWithOrg.map((p) => ({
        id: p.project.id,
        name: p.project.name,
        description: p.project.description,
        organization_id: p.project.organizationId,
        organization: {
          id: p.organization.id,
          name: p.organization.name,
          slug: p.organization.slug,
        },
        created_at: p.project.createdAt?.toISOString(),
        updated_at: p.project.updatedAt?.toISOString(),
      })),
      total: Number(count),
      page,
      size,
      pages: Math.ceil(Number(count) / size),
    });
  } catch (error) {
    console.error("List projects error:", error);
    return c.json({ detail: "Failed to list projects" }, 500);
  }
});

/**
 * Get project by ID
 * GET /projects/:id
 */
projectsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const projectId = parseInt(c.req.param("id"), 10);

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Check org access
    const hasAccess = await checkOrgAccess(user!.id, project.organizationId);
    if (!hasAccess) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Get organization info
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, project.organizationId))
      .limit(1);

    return c.json({
      id: project.id,
      name: project.name,
      description: project.description,
      organization_id: project.organizationId,
      organization: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
          }
        : null,
      created_at: project.createdAt?.toISOString(),
      updated_at: project.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Get project error:", error);
    return c.json({ detail: "Failed to get project" }, 500);
  }
});

/**
 * Update project
 * PUT /projects/:id
 */
projectsRouter.put("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const user = c.get("user");
  const projectId = parseInt(c.req.param("id"), 10);
  const data = c.req.valid("json");

  try {
    // Get project
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Check org access
    const hasAccess = await checkOrgAccess(user!.id, project.organizationId);
    if (!hasAccess) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Update project
    const [updated] = await db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      return c.json({ detail: "Failed to update project" }, 500);
    }

    return c.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      organization_id: updated.organizationId,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Update project error:", error);
    return c.json({ detail: "Failed to update project" }, 500);
  }
});

/**
 * Delete project
 * DELETE /projects/:id
 */
projectsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const projectId = parseInt(c.req.param("id"), 10);

  try {
    // Get project
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

    if (!project) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Check org access
    const hasAccess = await checkOrgAccess(user!.id, project.organizationId);
    if (!hasAccess) {
      return c.json({ detail: "Project not found" }, 404);
    }

    // Delete project
    await db.delete(projects).where(eq(projects.id, projectId));

    // Decrement active projects count
    await db
      .update(organizations)
      .set({
        activeProjects: sql`GREATEST(${organizations.activeProjects} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, project.organizationId));

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return c.json({ detail: "Failed to delete project" }, 500);
  }
});

export default projectsRouter;
