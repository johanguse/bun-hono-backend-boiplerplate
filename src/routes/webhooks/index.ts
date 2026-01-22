import { eq } from "drizzle-orm";
import { Hono } from "hono";
import Stripe from "stripe";
import { db } from "../../db";
import { billingHistory, customerSubscriptions, subscriptionPlans } from "../../db/schema";
import { env } from "../../lib/env";

const webhooksRouter = new Hono();

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
  })
  : null;

/**
 * Stripe webhook handler
 * POST /webhooks/stripe
 */
webhooksRouter.post("/stripe", async (c) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "No signature" }, 400);
  }

  let event: Stripe.Event;

  try {
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return c.json({ error: "Webhook handler failed" }, 500);
  }
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (!stripe) return;

  const organizationId = session.metadata?.organization_id;
  const planId = session.metadata?.plan_id;

  if (!organizationId || !session.subscription) {
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Get period dates safely using type assertion for older API versions
  const subData = subscription as any;
  const periodStart = subData.current_period_start
    ? new Date(subData.current_period_start * 1000)
    : null;
  const periodEnd = subData.current_period_end ? new Date(subData.current_period_end * 1000) : null;

  // Update local subscription record
  await db
    .update(customerSubscriptions)
    .set({
      stripeSubscriptionId: subscription.id,
      planId: planId ? parseInt(planId, 10) : null,
      status: subscription.status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(customerSubscriptions.organizationId, parseInt(organizationId, 10)));

  console.log(`Checkout complete for org ${organizationId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find subscription by customer ID
  const [existing] = await db
    .select()
    .from(customerSubscriptions)
    .where(eq(customerSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (!existing) {
    console.log(`No subscription found for customer ${customerId}`);
    return;
  }

  // Get plan from price ID
  const priceId = subscription.items.data[0]?.price.id;
  let planId: number | null = null;

  if (priceId) {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.stripePriceIdMonthly, priceId))
      .limit(1);

    if (plan) {
      planId = plan.id;
    } else {
      const [yearlyPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.stripePriceIdYearly, priceId))
        .limit(1);
      if (yearlyPlan) {
        planId = yearlyPlan.id;
      }
    }
  }

  // Get period dates safely
  const subData = subscription as any;
  const periodStart = subData.current_period_start
    ? new Date(subData.current_period_start * 1000)
    : null;
  const periodEnd = subData.current_period_end ? new Date(subData.current_period_end * 1000) : null;

  // Update subscription
  await db
    .update(customerSubscriptions)
    .set({
      stripeSubscriptionId: subscription.id,
      planId,
      status: subscription.status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(customerSubscriptions.id, existing.id));

  console.log(`Subscription updated for customer ${customerId}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  await db
    .update(customerSubscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customerSubscriptions.stripeCustomerId, customerId));

  console.log(`Subscription deleted for customer ${customerId}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(customerSubscriptions)
    .where(eq(customerSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (!subscription) {
    return;
  }

  // Record billing history (amount in cents)
  const invoiceData = invoice as any;
  await db.insert(billingHistory).values({
    subscriptionId: subscription.id,
    stripeInvoiceId: invoice.id ?? undefined,
    amount: invoiceData.amount_paid ?? 0,
    currency: (invoiceData.currency ?? "usd").toUpperCase(),
    status: "paid",
    invoiceDate: new Date((invoiceData.created ?? Date.now() / 1000) * 1000),
    paidAt: invoiceData.status_transitions?.paid_at
      ? new Date(invoiceData.status_transitions.paid_at * 1000)
      : new Date(),
    invoiceUrl: invoiceData.hosted_invoice_url ?? undefined,
    invoicePdf: invoiceData.invoice_pdf ?? undefined,
    description: `Invoice for subscription`,
  });

  console.log(`Invoice paid for customer ${customerId}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find subscription
  const [subscription] = await db
    .select()
    .from(customerSubscriptions)
    .where(eq(customerSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (!subscription) {
    return;
  }

  // Record failed payment (amount in cents)
  const invoiceData = invoice as any;
  await db.insert(billingHistory).values({
    subscriptionId: subscription.id,
    stripeInvoiceId: invoice.id ?? undefined,
    amount: invoiceData.amount_due ?? 0,
    currency: (invoiceData.currency ?? "usd").toUpperCase(),
    status: "failed",
    invoiceDate: new Date((invoiceData.created ?? Date.now() / 1000) * 1000),
    invoiceUrl: invoiceData.hosted_invoice_url ?? undefined,
    invoicePdf: invoiceData.invoice_pdf ?? undefined,
    description: `Failed payment for subscription`,
  });

  // Update subscription status
  await db
    .update(customerSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(customerSubscriptions.id, subscription.id));

  console.log(`Invoice failed for customer ${customerId}`);
}

export default webhooksRouter;
