import Stripe from "stripe";
import { env } from "../lib/env";

// Initialize Stripe client
export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-11-17.clover",
    })
  : null;

/**
 * Create a Stripe customer
 */
export async function createCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  });
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  return stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
}

/**
 * Create a billing portal session
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  return stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false,
): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event | null {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    console.warn("[DEV] Stripe webhook not configured");
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return null;
  }
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    return null;
  }
  return customer as Stripe.Customer;
}

/**
 * List invoices for a customer
 */
export async function listInvoices(customerId: string, limit = 10): Promise<Stripe.Invoice[]> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return [];
  }

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return invoices.data;
}

/**
 * Update Stripe customer with billing information
 * Used for Brazilian NFSE tax compliance and invoice generation
 */
export async function updateCustomerBillingInfo(params: {
  customerId: string;
  name?: string;
  email?: string;
  taxId?: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer | null> {
  if (!stripe) {
    console.warn("[DEV] Stripe not configured");
    return null;
  }

  const updateData: Stripe.CustomerUpdateParams = {};

  if (params.name) {
    updateData.name = params.name;
  }

  if (params.email) {
    updateData.email = params.email;
  }

  if (params.address) {
    updateData.address = {
      line1: params.address.line1 || "",
      city: params.address.city || "",
      state: params.address.state || "",
      postal_code: params.address.postal_code || "",
      country: params.address.country || "",
    };
  }

  // Store tax ID and billing info in metadata for NFSE/invoice generation
  updateData.metadata = {
    ...params.metadata,
    tax_id: params.taxId || "",
    updated_at: new Date().toISOString(),
  };

  return stripe.customers.update(params.customerId, updateData);
}
