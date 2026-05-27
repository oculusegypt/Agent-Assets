import { drizzle } from "drizzle-orm/sqlite-proxy";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Walk up from cwd to find workspace root (contains pnpm-workspace.yaml)
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, "data", "acis.db");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "data", "acis.db");
}

const DB_PATH = resolveDbPath();
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

try {
  sqlite.exec(`ALTER TABLE generation_jobs ADD COLUMN result TEXT`);
} catch {}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS agent_patches (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    patch_type TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    applied_by TEXT NOT NULL DEFAULT 'billie',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER DEFAULT (unixepoch()),
    rolled_back_at INTEGER
  )
`);

export const db = drizzle(
  async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    if (method === "run") {
      stmt.run(...(params as any[]));
      return { rows: [] };
    }
    const rows = (stmt.all(...(params as any[])) as Record<string, unknown>[]).map(
      (row) => Object.values(row),
    );
    return { rows };
  },
  { schema },
);

export * from "./schema";
