import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  hashedPassword: text("hashed_password"),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active, invited, suspended
  isActive: boolean("is_active").default(true).notNull(),
  isSuperuser: boolean("is_superuser").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  maxTeams: integer("max_teams").default(3).notNull(),

  // OAuth fields
  oauthProvider: varchar("oauth_provider", { length: 50 }),
  oauthProviderId: varchar("oauth_provider_id", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),

  // Profile fields
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 100 }),
  jobTitle: varchar("job_title", { length: 100 }),
  country: varchar("country", { length: 100 }),
  timezone: varchar("timezone", { length: 50 }),
  bio: varchar("bio", { length: 500 }),
  website: varchar("website", { length: 200 }),

  // Billing fields
  taxId: varchar("tax_id", { length: 100 }),
  addressStreet: varchar("address_street", { length: 255 }),
  addressCity: varchar("address_city", { length: 100 }),
  addressState: varchar("address_state", { length: 100 }),
  addressPostalCode: varchar("address_postal_code", { length: 20 }),
  companyName: varchar("company_name", { length: 255 }),

  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingStep: integer("onboarding_step").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  organizationMemberships: many(organizationMembers),
  sentInvitations: many(organizationInvitations, {
    relationName: "invitedBy",
  }),
  receivedInvitations: many(organizationInvitations, {
    relationName: "invitee",
  }),
  activityLogs: many(activityLogs),
  teamInvitations: many(teamInvitations, { relationName: "invitedBy" }),
}));

// Email tokens for OTP and verification
export const emailTokens = pgTable("email_tokens", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  tokenType: varchar("token_type", { length: 50 }).notNull(), // 'verification', 'password_reset', 'otp'
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

import { activityLogs } from "./activity-logs";
import { teamInvitations } from "./invitations";
// Import related tables for relations
import { organizationInvitations, organizationMembers } from "./organizations";

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EmailToken = typeof emailTokens.$inferSelect;
export type NewEmailToken = typeof emailTokens.$inferInsert;
