import { pgTable, serial, timestamp, varchar, text, integer, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const projects = pgTable(
  "projects",
  {
    id: serial().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    repo_url: varchar("repo_url", { length: 500 }).notNull().unique(),
    owner: varchar("owner", { length: 255 }).notNull(),
    repo_name: varchar("repo_name", { length: 255 }).notNull(),
    description: text("description"),
    stars: integer("stars").default(0),
    language: varchar("language", { length: 100 }),
    readme_content: text("readme_content"),
    file_structure: text("file_structure"),
    analysis_result: text("analysis_result"),
    analysis_status: varchar("analysis_status", { length: 20 }).default("pending").notNull(),
    topics: jsonb("topics"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("projects_owner_idx").on(table.owner),
    index("projects_analysis_status_idx").on(table.analysis_status),
    index("projects_created_at_idx").on(table.created_at),
  ]
);

export const learningProgress = pgTable(
  "learning_progress",
  {
    id: serial().primaryKey(),
    project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).default("not_started").notNull(),
    progress_percentage: integer("progress_percentage").default(0).notNull(),
    notes: text("notes"),
    started_at: timestamp("started_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("learning_progress_project_id_idx").on(table.project_id),
    index("learning_progress_status_idx").on(table.status),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: serial().primaryKey(),
    project_id: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_project_id_idx").on(table.project_id),
    index("conversations_created_at_idx").on(table.created_at),
  ]
);

const { createInsertSchema } = createSchemaFactory({ coerce: { date: true } });
export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  repo_url: true,
  owner: true,
  repo_name: true,
  description: true,
  stars: true,
  language: true,
  readme_content: true,
  file_structure: true,
});
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof insertProjectSchema.type;

export const insertConversationSchema = createInsertSchema(conversations).pick({
  project_id: true,
  role: true,
  content: true,
});
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof insertConversationSchema.type;

export const insertLearningProgressSchema = createInsertSchema(learningProgress).pick({
  project_id: true,
  title: true,
  status: true,
  progress_percentage: true,
  notes: true,
  started_at: true,
  completed_at: true,
});
export type LearningProgress = typeof learningProgress.$inferSelect;
export type InsertLearningProgress = typeof insertLearningProgressSchema.type;
