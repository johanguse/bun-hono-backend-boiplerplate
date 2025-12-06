import { relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

// Organization member roles
export const organizationMemberRoleEnum = pgEnum("organization_member_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 120 }).unique(),
  description: text("description"),
  logoUrl: text("logo_url"),

  // Stripe integration
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeProductId: text("stripe_product_id"),
  planName: varchar("plan_name", { length: 50 }),
  subscriptionStatus: varchar("subscription_status", { length: 20 }),

  // Limits
  maxProjects: integer("max_projects").default(3).notNull(),
  activeProjects: integer("active_projects").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  invitations: many(organizationInvitations),
  projects: many(projects),
  activityLogs: many(activityLogs),
  subscription: one(customerSubscriptions, {
    fields: [organizations.id],
    references: [customerSubscriptions.organizationId],
  }),
}));

export const organizationMembers = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  role: organizationMemberRoleEnum("role").default("member").notNull(),

  // Foreign keys
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationInvitations = pgTable("organization_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, accepted, declined

  // Foreign keys
  organizationId: integer("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  invitedById: integer("invited_by_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  inviteeId: integer("invitee_id").references(() => users.id, {
    onDelete: "set null",
  }),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizationInvitationsRelations = relations(organizationInvitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [organizationInvitations.invitedById],
    references: [users.id],
    relationName: "invitedBy",
  }),
  invitee: one(users, {
    fields: [organizationInvitations.inviteeId],
    references: [users.id],
    relationName: "invitee",
  }),
}));

import { activityLogs } from "./activity-logs";
// Import related tables for relations
import { projects } from "./projects";
import { customerSubscriptions } from "./subscriptions";

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type OrganizationInvitation = typeof organizationInvitations.$inferSelect;
export type NewOrganizationInvitation = typeof organizationInvitations.$inferInsert;
