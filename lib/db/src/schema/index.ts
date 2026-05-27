import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

const now = sql`(strftime('%s', 'now'))`;

export const agentsTable = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  system: text("system").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  status: text("status").notNull().default("online"),
  model: text("model").notNull(),
  capabilities: text("capabilities", { mode: "json" }).notNull().default([]),
  subagents: text("subagents", { mode: "json" }).notNull().default([]),
  executions_today: integer("executions_today").notNull().default(0),
  success_rate: real("success_rate").notNull().default(100),
  avg_response_ms: integer("avg_response_ms").notNull().default(1200),
  last_active: text("last_active"),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  prompt: text("prompt"),
  updated_at: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const agentExecutionsTable = sqliteTable("agent_executions", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  error: text("error"),
  duration_ms: integer("duration_ms"),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  completed_at: integer("completed_at", { mode: "timestamp" }),
  tokens_used: integer("tokens_used"),
  model_used: text("model_used"),
});

export const systemAlertsTable = sqliteTable("system_alerts", {
  id: text("id").primaryKey(),
  severity: text("severity").notNull(),
  agent_id: text("agent_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  resolved_at: integer("resolved_at", { mode: "timestamp" }),
});

export const complaintsTable = sqliteTable("complaints", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  agent_id: text("agent_id"),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  billie_response: text("billie_response"),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  resolved_at: integer("resolved_at", { mode: "timestamp" }),
});

export const projectsTable = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  type: text("type").notNull(),
  status: text("status").notNull().default("concept"),
  phase: integer("phase").notNull().default(1),
  total_phases: integer("total_phases").notNull().default(7),
  story_prompt: text("story_prompt").notNull(),
  language: text("language").notNull().default("ar"),
  duration_seconds: integer("duration_seconds").notNull().default(60),
  scenes_count: integer("scenes_count").notNull().default(0),
  assets_generated: integer("assets_generated").notNull().default(0),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updated_at: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const generationJobsTable = sqliteTable("generation_jobs", {
  id: text("id").primaryKey(),
  project_id: text("project_id").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("queued"),
  model_used: text("model_used").notNull(),
  estimated_seconds: integer("estimated_seconds").notNull().default(30),
  output_url: text("output_url"),
  started_at: integer("started_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  completed_at: integer("completed_at", { mode: "timestamp" }),
});

export const conversationsTable = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id").notNull(),
  agent_name: text("agent_name").notNull(),
  title: text("title").notNull(),
  message_count: integer("message_count").notNull().default(0),
  last_message_at: integer("last_message_at", { mode: "timestamp" }),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const messagesTable = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model_used: text("model_used"),
  tokens_used: integer("tokens_used"),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const nexusTasksTable = sqliteTable("nexus_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  assigned_agent: text("assigned_agent").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  risk_score: integer("risk_score").notNull().default(2),
  progress: integer("progress").notNull().default(0),
  result: text("result"),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  completed_at: integer("completed_at", { mode: "timestamp" }),
});

export const activityTable = sqliteTable("activity", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  agent_id: text("agent_id"),
  agent_name: text("agent_name"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const systemSettingsTable = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  updated_at: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const agentPatchesTable = sqliteTable("agent_patches", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id").notNull(),
  patch_type: text("patch_type").notNull(),
  field: text("field").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value").notNull(),
  reason: text("reason").notNull(),
  applied_by: text("applied_by").notNull().default("billie"),
  status: text("status").notNull().default("active"),
  created_at: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  rolled_back_at: integer("rolled_back_at", { mode: "timestamp" }),
});

export const insertAgentSchema = createInsertSchema(agentsTable);
export const insertExecutionSchema = createInsertSchema(agentExecutionsTable);
export const insertAlertSchema = createInsertSchema(systemAlertsTable);
export const insertComplaintSchema = createInsertSchema(complaintsTable);
export const insertProjectSchema = createInsertSchema(projectsTable);
export const insertConversationSchema = createInsertSchema(conversationsTable);
export const insertMessageSchema = createInsertSchema(messagesTable);
export const insertNexusTaskSchema = createInsertSchema(nexusTasksTable);
export const insertActivitySchema = createInsertSchema(activityTable);

export type Agent = typeof agentsTable.$inferSelect;
export type AgentExecution = typeof agentExecutionsTable.$inferSelect;
export type SystemAlert = typeof systemAlertsTable.$inferSelect;
export type Complaint = typeof complaintsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type NexusTask = typeof nexusTasksTable.$inferSelect;
export type Activity = typeof activityTable.$inferSelect;
