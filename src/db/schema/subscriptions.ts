import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).unique().notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  description: text("description"),

  // Stripe IDs
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 100 }),
  stripePriceIdYearly: varchar("stripe_price_id_yearly", { length: 100 }),
  stripeProductId: varchar("stripe_product_id", { length: 100 }),

  // Pricing (in cents)
  priceMonthlyUsd: integer("price_monthly_usd").default(0).notNull(),
  priceYearlyUsd: integer("price_yearly_usd").default(0).notNull(),
  priceMonthlyEur: integer("price_monthly_eur"),
  priceYearlyEur: integer("price_yearly_eur"),
  priceMonthlyGbp: integer("price_monthly_gbp"),
  priceYearlyGbp: integer("price_yearly_gbp"),
  priceMonthlyBrl: integer("price_monthly_brl"),
  priceYearlyBrl: integer("price_yearly_brl"),

  // Plan limits
  maxProjects: integer("max_projects").default(1).notNull(),
  maxUsers: integer("max_users").default(1).notNull(),
  maxStorageGb: integer("max_storage_gb").default(1).notNull(),

  // AI limits
  maxAiCreditsMonthly: integer("max_ai_credits_monthly").default(0).notNull(),
  aiFeaturesEnabled: json("ai_features_enabled").$type<string[]>().default([]),

  // Features
  features: json("features").$type<Record<string, boolean>>().default({}),

  // Metadata
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(customerSubscriptions),
}));

export const customerSubscriptions = pgTable("customer_subscriptions", {
  id: serial("id").primaryKey(),

  // Foreign keys
  organizationId: integer("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  planId: integer("plan_id").references(() => subscriptionPlans.id, {
    onDelete: "set null",
  }),

  // Stripe identifiers
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }).unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id", {
    length: 100,
  }).unique(),

  // Subscription status
  status: varchar("status", { length: 20 }).default("inactive").notNull(), // active, canceled, past_due, unpaid, incomplete, trialing

  // Billing cycle
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),

  // Usage tracking
  currentUsersCount: integer("current_users_count").default(0).notNull(),
  currentProjectsCount: integer("current_projects_count").default(0).notNull(),
  currentStorageGb: integer("current_storage_gb").default(0).notNull(),

  // Metadata
  extraData: json("extra_data").$type<Record<string, unknown>>().default({}),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const customerSubscriptionsRelations = relations(customerSubscriptions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customerSubscriptions.organizationId],
    references: [organizations.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [customerSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  billingHistory: many(billingHistory),
}));

export const billingHistory = pgTable("billing_history", {
  id: serial("id").primaryKey(),

  // Foreign key
  subscriptionId: integer("subscription_id")
    .references(() => customerSubscriptions.id, { onDelete: "cascade" })
    .notNull(),

  // Invoice details
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 100 }).unique(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),

  // Payment information
  amount: integer("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("usd").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // paid, failed, pending, refunded

  // Dates
  invoiceDate: timestamp("invoice_date", { withTimezone: true }).defaultNow().notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  // URLs
  invoiceUrl: text("invoice_url"),
  invoicePdf: text("invoice_pdf"),

  // Metadata
  description: text("description"),
  extraData: json("extra_data").$type<Record<string, unknown>>().default({}),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const billingHistoryRelations = relations(billingHistory, ({ one }) => ({
  subscription: one(customerSubscriptions, {
    fields: [billingHistory.subscriptionId],
    references: [customerSubscriptions.id],
  }),
}));

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type CustomerSubscription = typeof customerSubscriptions.$inferSelect;
export type NewCustomerSubscription = typeof customerSubscriptions.$inferInsert;
export type BillingHistory = typeof billingHistory.$inferSelect;
export type NewBillingHistory = typeof billingHistory.$inferInsert;
