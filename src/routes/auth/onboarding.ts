import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../../db";
import { organizationMembers, organizations, users } from "../../db/schema";
import {
  onboardingCompleteSchema,
  onboardingProfileUpdateSchema,
  onboardingStepUpdateSchema,
} from "./schemas";

const onboarding = new Hono();

// Schema for creating org during onboarding
const onboardingOrgSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

/**
 * Get onboarding status
 * GET /auth/onboarding/status
 */
onboarding.get("/status", async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  return c.json({
    onboarding_completed: user.onboardingCompleted,
    onboarding_step: user.onboardingStep,
    profile: {
      name: user.name,
      phone: user.phone,
      company: user.company,
      jobTitle: user.jobTitle,
      country: user.country,
      timezone: user.timezone,
      bio: user.bio,
      website: user.website,
    },
  });
});

/**
 * Update profile during onboarding
 * PATCH /auth/onboarding/profile
 */
onboarding.patch("/profile", zValidator("json", onboardingProfileUpdateSchema), async (c) => {
  const user = c.get("user");
  const data = c.req.valid("json");

  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) {
      return c.json({ detail: "Failed to update profile" }, 500);
    }

    return c.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      company: updated.company,
      jobTitle: updated.jobTitle,
      country: updated.country,
      timezone: updated.timezone,
      bio: updated.bio,
      website: updated.website,
      onboarding_completed: updated.onboardingCompleted,
      onboarding_step: updated.onboardingStep,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return c.json({ detail: "Failed to update profile" }, 500);
  }
});

/**
 * Create organization during onboarding
 * POST /auth/onboarding/organization
 */
onboarding.post("/organization", zValidator("json", onboardingOrgSchema), async (c) => {
  const user = c.get("user");
  const { name, description } = c.req.valid("json");

  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  try {
    // Generate slug from name
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
      userId: user.id,
      organizationId: org.id,
      role: "owner",
    });

    return c.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      createdAt: org.createdAt?.toISOString(),
    });
  } catch (error) {
    console.error("Create organization error:", error);
    return c.json({ detail: "Failed to create organization" }, 500);
  }
});

/**
 * Update onboarding step
 * PATCH /auth/onboarding/step
 */
onboarding.patch("/step", zValidator("json", onboardingStepUpdateSchema), async (c) => {
  const user = c.get("user");
  const { step, completed } = c.req.valid("json");

  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        onboardingStep: step,
        onboardingCompleted: completed,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) {
      return c.json({ detail: "Failed to update step" }, 500);
    }

    return c.json({
      onboarding_step: updated.onboardingStep,
      onboarding_completed: updated.onboardingCompleted,
    });
  } catch (error) {
    console.error("Update step error:", error);
    return c.json({ detail: "Failed to update step" }, 500);
  }
});

/**
 * Complete onboarding
 * POST /auth/onboarding/complete
 */
onboarding.post("/complete", zValidator("json", onboardingCompleteSchema), async (c) => {
  const user = c.get("user");
  const { completed } = c.req.valid("json");

  if (!user) {
    return c.json({ detail: "Not authenticated" }, 401);
  }

  try {
    const [updated] = await db
      .update(users)
      .set({
        onboardingCompleted: completed,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) {
      return c.json({ detail: "Failed to complete onboarding" }, 500);
    }

    return c.json({
      onboarding_completed: updated.onboardingCompleted,
      onboarding_step: updated.onboardingStep,
    });
  } catch (error) {
    console.error("Complete onboarding error:", error);
    return c.json({ detail: "Failed to complete onboarding" }, 500);
  }
});

export default onboarding;
