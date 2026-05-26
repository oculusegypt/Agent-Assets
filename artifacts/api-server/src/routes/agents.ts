import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", async (_req, res) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);
  res.json(agents.map(a => ({ ...a, capabilities: a.capabilities as string[], subagents: a.subagents as string[] })));
});

router.get("/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  res.json({ ...agent, capabilities: agent.capabilities as string[], subagents: agent.subagents as string[] });
});

router.post("/:agentId/execute", async (req, res) => {
  const { agentId } = req.params;
  const { action, prompt, parameters } = req.body;

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const execId = randomUUID();
  const startTime = Date.now();

  const [exec] = await db.insert(agentExecutionsTable).values({
    id: execId,
    agent_id: agentId,
    action,
    status: "running",
    model_used: agent.model,
  }).returning();

  // Simulate execution with a realistic delay based on model
  const delayMs = Math.floor(Math.random() * 2000) + 800;
  const tokenCount = Math.floor(Math.random() * 2000) + 200;

  const responses: Record<string, string> = {
    story: `تحليل القصة مكتمل. تم تحديد 3 فصول رئيسية، 12 مشهداً، وقوس عاطفي قوي مع ذروة في الفصل الثاني. النمط السينمائي: دراما تاريخية مع لقطات جوية ملحمية.`,
    analyze: `Analysis complete. System health at ${Math.floor(85 + Math.random() * 15)}%. All ${agent.subagents ? (agent.subagents as string[]).length : 0} sub-agents operational. No critical issues detected.`,
    generate: `Generation pipeline initiated. Estimated completion: ${Math.floor(Math.random() * 25) + 5} minutes. Using ${agent.model} for primary processing.`,
    default: `Task "${action}" completed successfully. Agent ${agent.name} processed the request using ${agent.model}. ${Math.floor(Math.random() * 10) + 3} operations performed.`,
  };

  const result = responses[action.toLowerCase()] || responses.default;
  const duration = Date.now() - startTime + delayMs;

  await db.update(agentExecutionsTable).set({
    status: "completed",
    result,
    duration_ms: duration,
    completed_at: new Date(),
    tokens_used: tokenCount,
  }).where(eq(agentExecutionsTable.id, execId));

  await db.update(agentsTable).set({
    executions_today: agent.executions_today + 1,
    last_active: new Date().toISOString(),
    status: "online",
  }).where(eq(agentsTable.id, agentId));

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "agent_completed",
    agent_id: agentId,
    agent_name: agent.name,
    title: `${agent.name} completed task`,
    description: `Action: ${action} | Duration: ${Math.floor(duration / 1000)}s | Tokens: ${tokenCount}`,
  });

  res.json({
    id: execId,
    agentId,
    action,
    status: "completed",
    result,
    error: null,
    duration_ms: duration,
    created_at: exec.created_at?.toISOString() || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    tokens_used: tokenCount,
    model_used: agent.model,
  });
});

router.get("/:agentId/executions", async (req, res) => {
  const { agentId } = req.params;
  const execs = await db.select().from(agentExecutionsTable)
    .where(eq(agentExecutionsTable.agent_id, agentId))
    .orderBy(desc(agentExecutionsTable.created_at))
    .limit(20);
  res.json(execs.map(e => ({
    ...e,
    created_at: e.created_at?.toISOString() || new Date().toISOString(),
    completed_at: e.completed_at?.toISOString() || null,
  })));
});

export default router;
