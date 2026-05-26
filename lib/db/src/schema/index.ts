import { pgTable, text, serial, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  system: text("system").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  status: text("status").notNull().default("online"),
  model: text("model").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  subagents: jsonb("subagents").notNull().default([]),
  executions_today: integer("executions_today").notNull().default(0),
  success_rate: real("success_rate").notNull().default(100),
  avg_response_ms: integer("avg_response_ms").notNull().default(1200),
  last_active: text("last_active"),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  prompt: text("prompt"),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const agentExecutionsTable = pgTable("agent_executions", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id").notNull(),
  action: text("action").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  error: text("error"),
  duration_ms: integer("duration_ms"),
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
  tokens_used: integer("tokens_used"),
  model_used: text("model_used"),
});

export const systemAlertsTable = pgTable("system_alerts", {
  id: text("id").primaryKey(),
  severity: text("severity").notNull(),
  agent_id: text("agent_id"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  created_at: timestamp("created_at").defaultNow(),
  resolved_at: timestamp("resolved_at"),
});

export const complaintsTable = pgTable("complaints", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  agent_id: text("agent_id"),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  billie_response: text("billie_response"),
  created_at: timestamp("created_at").defaultNow(),
  resolved_at: timestamp("resolved_at"),
});

export const projectsTable = pgTable("projects", {
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
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const generationJobsTable = pgTable("generation_jobs", {
  id: text("id").primaryKey(),
  project_id: text("project_id").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("queued"),
  model_used: text("model_used").notNull(),
  estimated_seconds: integer("estimated_seconds").notNull().default(30),
  output_url: text("output_url"),
  started_at: timestamp("started_at").defaultNow(),
  completed_at: timestamp("completed_at"),
});

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  agent_id: text("agent_id").notNull(),
  agent_name: text("agent_name").notNull(),
  title: text("title").notNull(),
  message_count: integer("message_count").notNull().default(0),
  last_message_at: timestamp("last_message_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  model_used: text("model_used"),
  tokens_used: integer("tokens_used"),
  created_at: timestamp("created_at").defaultNow(),
});

export const nexusTasksTable = pgTable("nexus_tasks", {
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
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
});

export const activityTable = pgTable("activity", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  agent_id: text("agent_id"),
  agent_name: text("agent_name"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  created_at: timestamp("created_at").defaultNow(),
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
