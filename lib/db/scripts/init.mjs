#!/usr/bin/env node
/**
 * Initialize the SQLite database at data/acis.db in the workspace root.
 * Creates all tables if they don't exist. Safe to run multiple times (idempotent).
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

function findWorkspaceRoot() {
  if (process.env.DB_PATH) return null; // will use env var directly
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const DB_PATH = process.env.DB_PATH || path.join(findWorkspaceRoot(), "data", "acis.db");
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  system TEXT NOT NULL,
  description TEXT NOT NULL,
  description_ar TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  model TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '[]',
  subagents TEXT NOT NULL DEFAULT '[]',
  executions_today INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 100,
  avg_response_ms INTEGER NOT NULL DEFAULT 1200,
  last_active TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  prompt TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  tokens_used INTEGER,
  model_used TEXT
);

CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  agent_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_id TEXT,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  billie_response TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'concept',
  phase INTEGER NOT NULL DEFAULT 1,
  total_phases INTEGER NOT NULL DEFAULT 7,
  story_prompt TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'ar',
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  scenes_count INTEGER NOT NULL DEFAULT 0,
  assets_generated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  model_used TEXT NOT NULL,
  estimated_seconds INTEGER NOT NULL DEFAULT 30,
  output_url TEXT,
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  title TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS nexus_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  assigned_agent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  risk_score INTEGER NOT NULL DEFAULT 2,
  progress INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT,
  agent_name TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_at INTEGER DEFAULT (unixepoch())
);
`);

console.log(`\u2705 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062c\u0627\u0647\u0632\u0629: ${DB_PATH}`);
db.close();
