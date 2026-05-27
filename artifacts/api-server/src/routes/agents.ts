import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callGemini, callQwen, getAgentSystemPrompt, isArabicDominant } from "../lib/ai.js";

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

  try {
    const systemPrompt = getAgentSystemPrompt(agentId, agent.name);
    const userMessage = prompt
      ? `المهمة: ${action}\n\nالتفاصيل: ${prompt}`
      : `نفّذ المهمة التالية: ${action}`;

    const aiRes = await callGemini(systemPrompt, userMessage, "flash");
    const result = aiRes.text;
    const tokenCount = aiRes.tokens;
    const modelUsed = "gemini-2.5-flash";

    const duration = Date.now() - startTime;

    await db.update(agentExecutionsTable).set({
      status: "completed",
      result,
      duration_ms: duration,
      completed_at: new Date(),
      tokens_used: tokenCount,
      model_used: modelUsed,
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
      title: `${agent.nameAr || agent.name} أكمل المهمة`,
      description: `الإجراء: ${action} | المدة: ${Math.floor(duration / 1000)}ث | الرموز: ${tokenCount}`,
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
      model_used: modelUsed,
    });
  } catch (err: any) {
    console.error(`Agent ${agentId} execution error:`, err?.message);
    const errMsg = err?.message || "فشل التنفيذ";
    await db.update(agentExecutionsTable).set({
      status: "failed",
      error: errMsg,
      duration_ms: Date.now() - startTime,
      completed_at: new Date(),
    }).where(eq(agentExecutionsTable.id, execId));

    res.status(500).json({
      id: execId,
      agentId,
      action,
      status: "failed",
      result: null,
      error: errMsg,
      duration_ms: Date.now() - startTime,
      created_at: exec.created_at?.toISOString() || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      tokens_used: 0,
      model_used: agent.model,
    });
  }
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
