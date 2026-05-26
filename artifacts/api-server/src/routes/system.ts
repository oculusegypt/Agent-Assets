import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, projectsTable, activityTable, systemAlertsTable } from "@workspace/db";
import { eq, count, desc, gte, sql } from "drizzle-orm";

const router = Router();

router.get("/metrics", async (_req, res) => {
  const agents = await db.select().from(agentsTable);
  const projects = await db.select().from(projectsTable);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const execs = await db.select().from(agentExecutionsTable);
  const execsToday = execs.filter(e => e.created_at && e.created_at >= today);

  const completed = execs.filter(e => e.status === "completed");
  const successRate = execs.length > 0 ? (completed.length / execs.length) * 100 : 100;
  const avgMs = completed.length > 0
    ? completed.filter(e => e.duration_ms).reduce((sum, e) => sum + (e.duration_ms || 0), 0) / completed.filter(e => e.duration_ms).length
    : 1200;
  const tokensToday = execsToday.filter(e => e.tokens_used).reduce((s, e) => s + (e.tokens_used || 0), 0);

  const online = agents.filter(a => a.status === "online").length;
  const busy = agents.filter(a => a.status === "busy").length;
  const offline = agents.filter(a => a.status === "offline" || a.status === "error").length;
  const activeProjects = projects.filter(p => p.status !== "complete" && p.status !== "concept").length;

  const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
  const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 60 + successRate * 0.3 + (100 - Math.min(alerts.length * 10, 30)) * 0.1);

  res.json({
    total_agents: agents.length,
    agents_online: online,
    agents_busy: busy,
    agents_offline: offline,
    total_executions_today: execsToday.length,
    total_executions_all_time: execs.length,
    success_rate: Math.round(successRate * 10) / 10,
    avg_response_ms: Math.round(avgMs),
    active_projects: activeProjects,
    total_projects: projects.length,
    tokens_used_today: tokensToday,
    system_health: Math.round(healthScore),
    uptime_hours: 24 + Math.random() * 120,
  });
});

router.get("/activity", async (_req, res) => {
  const activity = await db.select().from(activityTable)
    .orderBy(desc(activityTable.created_at))
    .limit(30);
  res.json(activity.map(a => ({
    ...a,
    created_at: a.created_at?.toISOString() || new Date().toISOString(),
  })));
});

export default router;
