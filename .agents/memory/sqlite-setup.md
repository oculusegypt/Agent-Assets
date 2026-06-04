---
name: SQLite via node:sqlite
description: How to use SQLite in this Replit project — better-sqlite3 fails to compile natively, use built-in node:sqlite instead.
---

## Rule
Use `node:sqlite` (built into Node.js 24) with `drizzle-orm/sqlite-proxy` — do NOT use `better-sqlite3`.

**Why:** `better-sqlite3` requires native compilation via `node-gyp`. In Replit's Nix environment, the compiled binary is not available and `node-gyp` is not in PATH, so install scripts fail silently and the `.node` binding is never produced.

**How to apply:**
- DB connection: `drizzle-orm/sqlite-proxy` + `DatabaseSync` from `node:sqlite`
- Schema: `drizzle-orm/sqlite-core` (`sqliteTable`, `text`, `integer`, `real`)
- DB file lives at `data/acis.db` in workspace root (created automatically)
- Init script: `node lib/db/scripts/init.mjs` — runs `CREATE TABLE IF NOT EXISTS` for all tables
- `scripts/post-merge.sh` calls this init script — tables recreated on any fresh import
- API server sets `DB_PATH` via `$(cd ../.. && pwd)/data/acis.db` in its dev script
- `lib/db/src/index.ts` also auto-detects workspace root by walking up to find `pnpm-workspace.yaml`
- sqlite-proxy callback: `method === 'run'` → `stmt.run(...params)`, else `stmt.all(...params)` mapped to `Object.values(row)`
- `.returning()` works because drizzle uses `method: 'all'` for returning queries (not 'run')
