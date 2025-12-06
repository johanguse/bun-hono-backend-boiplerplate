import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { users } from "./users";

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    action: varchar("action", { length: 100 }).notNull(),
    actionType: varchar("action_type", { length: 20 }).notNull(),
    description: text("description").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Foreign keys
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: integer("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
  },
  (table) => [
    index("ix_activity_logs_created_at").on(table.createdAt),
    index("ix_activity_logs_action_type").on(table.actionType),
    index("ix_activity_logs_org_user").on(table.organizationId, table.userId),
  ],
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [activityLogs.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [activityLogs.projectId],
    references: [projects.id],
  }),
}));

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
