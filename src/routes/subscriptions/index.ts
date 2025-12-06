import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod/v4";
import { db } from "../../db";
import {
  billingHistory,
  customerSubscriptions,
  organizationMembers,
  organizations,
  subscriptionPlans,
} from "../../db/schema";
import { env } from "../../lib/env";
import { apiRateLimiter, authMiddleware, requireAuth } from "../../middleware";
import {
  cancelSubscription,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
} from "../../services/stripe.service";

const subscriptionsRouter = new Hono();

// Schemas
const checkoutSchema = z.object({
  organizationId: z.number(),
  priceId: z.string(),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).max(100).default(30),
});

/**
 * Helper to check org access
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
 * List subscription plans
 * GET /subscriptions/plans
 */
subscriptionsRouter.get("/plans", async (c) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    return c.json({
      items: plans.map((p) => ({
        id: p.id,
        name: p.name,
        display_name: p.displayName,
        description: p.description,
        stripe_price_id_monthly: p.stripePriceIdMonthly,
        stripe_price_id_yearly: p.stripePriceIdYearly,
        price_monthly_usd: p.priceMonthlyUsd,
        price_yearly_usd: p.priceYearlyUsd,
        max_projects: p.maxProjects,
        max_users: p.maxUsers,
        max_storage_gb: p.maxStorageGb,
        max_ai_credits_monthly: p.maxAiCreditsMonthly,
        features: p.features,
        ai_features_enabled: p.aiFeaturesEnabled,
      })),
    });
  } catch (error) {
    console.error("List plans error:", error);
    return c.json({ detail: "Failed to list plans" }, 500);
  }
});

// Protected routes
subscriptionsRouter.use("*", authMiddleware, requireAuth);

/**
 * Create checkout session
 * POST /subscriptions/checkout
 */
subscriptionsRouter.post(
  "/checkout",
  apiRateLimiter,
  zValidator("json", checkoutSchema),
  async (c) => {
    const user = c.get("user");
    const { organizationId, priceId, interval } = c.req.valid("json");

    try {
      // Check org access (owner or admin only)
      const access = await checkOrgAccess(user!.id, organizationId, ["owner", "admin"]);
      if (!access.allowed) {
        return c.json({ detail: "Access denied" }, 403);
      }

      // Get or create customer subscription
      let [subscription] = await db
        .select()
        .from(customerSubscriptions)
        .where(eq(customerSubscriptions.organizationId, organizationId))
        .limit(1);

      let customerId = subscription?.stripeCustomerId;

      // Create Stripe customer if needed
      if (!customerId) {
        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, organizationId))
          .limit(1);

        const customer = await createCustomer({
          email: user!.email,
          name: org?.name,
          metadata: {
            organization_id: String(organizationId),
          },
        });

        if (!customer) {
          return c.json({ detail: "Failed to create customer" }, 500);
        }

        customerId = customer.id;

        // Create subscription record
        if (!subscription) {
          [subscription] = await db
            .insert(customerSubscriptions)
            .values({
              organizationId,
              stripeCustomerId: customerId,
              status: "inactive",
            })
            .returning();
        } else {
          await db
            .update(customerSubscriptions)
            .set({ stripeCustomerId: customerId })
            .where(eq(customerSubscriptions.id, subscription.id));
        }
      }

      // Get plan by price ID
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(
          interval === "yearly"
            ? eq(subscriptionPlans.stripePriceIdYearly, priceId)
            : eq(subscriptionPlans.stripePriceIdMonthly, priceId),
        )
        .limit(1);

      // Create checkout session
      const session = await createCheckoutSession({
        customerId,
        priceId,
        successUrl: `${env.FRONTEND_URL}/settings/billing?success=true`,
        cancelUrl: `${env.FRONTEND_URL}/settings/billing?canceled=true`,
        metadata: {
          organization_id: String(organizationId),
          plan_id: plan ? String(plan.id) : "",
        },
      });

      if (!session) {
        return c.json({ detail: "Failed to create checkout session" }, 500);
      }

      return c.json({ checkout_url: session.url });
    } catch (error) {
      console.error("Create checkout error:", error);
      return c.json({ detail: "Failed to create checkout" }, 500);
    }
  },
);

/**
 * Get subscription for organization
 * GET /subscriptions/:organizationId
 */
subscriptionsRouter.get("/:organizationId", async (c) => {
  const user = c.get("user");
  const organizationId = parseInt(c.req.param("organizationId"), 10);

  try {
    const access = await checkOrgAccess(user!.id, organizationId);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const [subscription] = await db
      .select({
        subscription: customerSubscriptions,
        plan: subscriptionPlans,
      })
      .from(customerSubscriptions)
      .leftJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
      .where(eq(customerSubscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription) {
      return c.json({
        subscription: null,
        plan: null,
      });
    }

    return c.json({
      subscription: {
        id: subscription.subscription.id,
        status: subscription.subscription.status,
        current_period_start: subscription.subscription.currentPeriodStart?.toISOString(),
        current_period_end: subscription.subscription.currentPeriodEnd?.toISOString(),
        cancel_at_period_end: subscription.subscription.cancelAtPeriodEnd,
        canceled_at: subscription.subscription.canceledAt?.toISOString(),
        trial_start: subscription.subscription.trialStart?.toISOString(),
        trial_end: subscription.subscription.trialEnd?.toISOString(),
        current_users_count: subscription.subscription.currentUsersCount,
        current_projects_count: subscription.subscription.currentProjectsCount,
      },
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            display_name: subscription.plan.displayName,
            max_projects: subscription.plan.maxProjects,
            max_users: subscription.plan.maxUsers,
            max_storage_gb: subscription.plan.maxStorageGb,
          }
        : null,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    return c.json({ detail: "Failed to get subscription" }, 500);
  }
});

/**
 * Get billing portal URL
 * POST /subscriptions/:organizationId/portal
 */
subscriptionsRouter.post("/:organizationId/portal", async (c) => {
  const user = c.get("user");
  const organizationId = parseInt(c.req.param("organizationId"), 10);

  try {
    const access = await checkOrgAccess(user!.id, organizationId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const [subscription] = await db
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription?.stripeCustomerId) {
      return c.json({ detail: "No subscription found" }, 404);
    }

    const session = await createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${env.FRONTEND_URL}/settings/billing`,
    });

    if (!session) {
      return c.json({ detail: "Failed to create portal session" }, 500);
    }

    return c.json({ portal_url: session.url });
  } catch (error) {
    console.error("Create portal error:", error);
    return c.json({ detail: "Failed to create portal" }, 500);
  }
});

/**
 * Cancel subscription
 * POST /subscriptions/:organizationId/cancel
 */
subscriptionsRouter.post("/:organizationId/cancel", async (c) => {
  const user = c.get("user");
  const organizationId = parseInt(c.req.param("organizationId"), 10);

  try {
    const access = await checkOrgAccess(user!.id, organizationId, ["owner", "admin"]);
    if (!access.allowed) {
      return c.json({ detail: "Access denied" }, 403);
    }

    const [subscription] = await db
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.organizationId, organizationId))
      .limit(1);

    if (!subscription?.stripeSubscriptionId) {
      return c.json({ detail: "No active subscription" }, 404);
    }

    // Cancel at period end
    await cancelSubscription(subscription.stripeSubscriptionId, false);

    // Update local record
    await db
      .update(customerSubscriptions)
      .set({
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptions.id, subscription.id));

    return c.json({ success: true });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return c.json({ detail: "Failed to cancel subscription" }, 500);
  }
});

/**
 * Get billing history
 * GET /subscriptions/:organizationId/billing-history
 */
subscriptionsRouter.get(
  "/:organizationId/billing-history",
  zValidator("query", paginationSchema),
  async (c) => {
    const user = c.get("user");
    const organizationId = parseInt(c.req.param("organizationId"), 10);
    const { page, size } = c.req.valid("query");

    try {
      const access = await checkOrgAccess(user!.id, organizationId);
      if (!access.allowed) {
        return c.json({ detail: "Access denied" }, 403);
      }

      // Get subscription
      const [subscription] = await db
        .select()
        .from(customerSubscriptions)
        .where(eq(customerSubscriptions.organizationId, organizationId))
        .limit(1);

      if (!subscription) {
        return c.json({
          items: [],
          total: 0,
          page,
          size,
          pages: 0,
        });
      }

      const offset = (page - 1) * size;

      // Get billing history
      const history = await db
        .select()
        .from(billingHistory)
        .where(eq(billingHistory.subscriptionId, subscription.id))
        .orderBy(desc(billingHistory.invoiceDate))
        .limit(size)
        .offset(offset);

      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(billingHistory)
        .where(eq(billingHistory.subscriptionId, subscription.id));
      const count = countResult[0]?.count ?? 0;

      return c.json({
        items: history.map((h) => ({
          id: h.id,
          amount: h.amount,
          currency: h.currency,
          status: h.status,
          invoice_date: h.invoiceDate?.toISOString(),
          paid_at: h.paidAt?.toISOString(),
          invoice_url: h.invoiceUrl,
          invoice_pdf: h.invoicePdf,
          description: h.description,
        })),
        total: Number(count),
        page,
        size,
        pages: Math.ceil(Number(count) / size),
      });
    } catch (error) {
      console.error("Get billing history error:", error);
      return c.json({ detail: "Failed to get billing history" }, 500);
    }
  },
);

export default subscriptionsRouter;
