import { Router } from "express";
import { db } from "@workspace/db";
import { nexusTasksTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const TYPE_TO_AGENT: Record<string, string> = {
  document: "Document Processor",
  spreadsheet: "Spreadsheet Analyst",
  presentation: "Presentation Designer",
  email: "Email Manager",
  meeting: "Meeting Manager",
  calendar: "Calendar Scheduler",
  knowledge: "Knowledge Curator",
  research: "Research Analyst",
  workflow: "Workflow Automation",
  crm: "CRM Manager",
};

router.get("/tasks", async (_req, res) => {
  const tasks = await db.select().from(nexusTasksTable)
    .orderBy(desc(nexusTasksTable.created_at))
    .limit(50);
  res.json(tasks.map(t => ({
    ...t,
    created_at: t.created_at?.toISOString() || new Date().toISOString(),
    completed_at: t.completed_at?.toISOString() || null,
  })));
});

router.post("/tasks", async (req, res) => {
  const { title, description, type, priority } = req.body;
  const id = randomUUID();
  const assignedAgent = TYPE_TO_AGENT[type] || "NEXUS Orchestrator";
  const riskScore = priority === "urgent" ? 7 : priority === "high" ? 5 : priority === "medium" ? 3 : 1;

  const [task] = await db.insert(nexusTasksTable).values({
    id,
    title,
    description,
    type,
    assigned_agent: assignedAgent,
    status: "running",
    priority,
    risk_score: riskScore,
    progress: 0,
  }).returning();

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "agent_started",
    agent_name: assignedAgent,
    title: `NEXUS: ${title}`,
    description: `Assigned to ${assignedAgent} | Priority: ${priority} | Risk: ${riskScore}/10`,
  });

  // Simulate progressive completion
  setTimeout(async () => {
    const result = generateNexusResult(type, title);
    await db.update(nexusTasksTable).set({
      status: "completed",
      progress: 100,
      result,
      completed_at: new Date(),
    }).where(eq(nexusTasksTable.id, id));
    await db.insert(activityTable).values({
      id: randomUUID(),
      type: "agent_completed",
      agent_name: assignedAgent,
      title: `NEXUS completed: ${title}`,
      description: result.substring(0, 150),
    });
  }, 5000 + Math.random() * 10000);

  res.status(201).json({
    ...task,
    created_at: task.created_at?.toISOString() || new Date().toISOString(),
    completed_at: null,
  });
});

router.get("/summary", async (_req, res) => {
  const tasks = await db.select().from(nexusTasksTable);
  const completed = tasks.filter(t => t.status === "completed");
  const running = tasks.filter(t => t.status === "running");
  const pending = tasks.filter(t => t.status === "pending");
  const failed = tasks.filter(t => t.status === "failed");

  const avgTime = completed.length > 0
    ? completed
        .filter(t => t.completed_at && t.created_at)
        .reduce((sum, t) => sum + ((t.completed_at!.getTime() - t.created_at!.getTime()) / 60000), 0) / completed.length
    : 8.5;

  res.json({
    tasks_total: tasks.length,
    tasks_completed: completed.length,
    tasks_running: running.length,
    tasks_pending: pending.length,
    tasks_failed: failed.length,
    avg_completion_time_min: Math.round(avgTime * 10) / 10 || 8.5,
    sub_agents_active: Math.min(10, running.length + 2),
    documents_processed: tasks.filter(t => t.type === "document" && t.status === "completed").length,
    emails_handled: tasks.filter(t => t.type === "email" && t.status === "completed").length,
    meetings_managed: tasks.filter(t => t.type === "meeting" && t.status === "completed").length,
  });
});

function generateNexusResult(type: string, title: string): string {
  const results: Record<string, string> = {
    document: `Document processed: "${title}". Extracted 3 key sections, 12 action items, and 5 critical decisions. Summary generated in Arabic and English. Formatted for distribution.`,
    email: `Email analysis complete. Classified as high-priority. Suggested response drafted with formal tone. Follow-up scheduled for tomorrow 9 AM.`,
    calendar: `Calendar optimized. Removed 2 conflicts, proposed 3 alternative meeting slots. Blocked focus time 10 AM–12 PM daily.`,
    meeting: `Meeting notes transcribed: 47 minutes. 8 action items extracted, owners assigned. Summary sent to all participants.`,
    spreadsheet: `Spreadsheet analyzed: 2,847 rows. Created dashboard with 4 KPI charts. Anomaly detected in Q3 column G — flagged for review.`,
    presentation: `Presentation created: 12 slides. Executive summary, data visualizations, and recommendations. Branded template applied.`,
    knowledge: `Knowledge base updated with 15 new entries. Semantic search index rebuilt. 3 duplicate concepts merged.`,
    research: `Research complete on "${title}": 24 sources analyzed, 8 key insights extracted, competitive landscape mapped.`,
    crm: `CRM records updated: 12 contacts enriched, 3 deals advanced, pipeline value increased by $45,000.`,
    workflow: `Workflow automated: 5-step pipeline configured. Estimated time savings: 3.2 hours/week per user.`,
  };
  return results[type] || `Task "${title}" completed successfully by NEXUS sub-agent.`;
}

export default router;
