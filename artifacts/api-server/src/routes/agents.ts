import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callAI, getAgentSystemPrompt, getAgentTier, AGENT_SYSTEM_PROMPTS } from "../lib/ai.js";

const router = Router();

router.get("/", async (_req, res) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);
  res.json(agents.map(a => ({ ...a, capabilities: a.capabilities as string[], subagents: a.subagents as string[] })));
});

router.get("/executions", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const execs = await db.select().from(agentExecutionsTable)
    .orderBy(desc(agentExecutionsTable.created_at)).limit(limit);
  res.json(execs.map(e => ({
    ...e,
    created_at: e.created_at?.toISOString() || new Date().toISOString(),
    completed_at: e.completed_at?.toISOString() || null,
  })));
});

router.get("/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });
  res.json({ ...agent, capabilities: agent.capabilities as string[], subagents: agent.subagents as string[] });
});

router.post("/:agentId/execute", async (req, res) => {
  const { agentId } = req.params;
  const { action, prompt, parameters } = req.body;

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  const execId = randomUUID();
  const startTime = Date.now();

  const [exec] = await db.insert(agentExecutionsTable).values({
    id: execId, agent_id: agentId, action, status: "running", model_used: agent.model,
  }).returning();

  try {
    const systemPrompt = getAgentSystemPrompt(agentId, agent.nameAr || agent.name);
    const userMessage = prompt
      ? `المهمة: ${action}\n\nالتفاصيل: ${prompt}`
      : `نفّذ المهمة التالية بدقة واحترافية عالية: ${action}`;

    const tier = getAgentTier(agentId);
    const aiRes = await callAI(systemPrompt, userMessage, tier);
    const result = aiRes.text;
    const tokenCount = aiRes.tokens;
    const modelUsed = aiRes.model;
    const duration = Date.now() - startTime;

    await db.update(agentExecutionsTable).set({
      status: "completed", result, duration_ms: duration,
      completed_at: new Date(), tokens_used: tokenCount, model_used: modelUsed,
    }).where(eq(agentExecutionsTable.id, execId));

    await db.update(agentsTable).set({
      executions_today: agent.executions_today + 1,
      last_active: new Date().toISOString(), status: "online",
    }).where(eq(agentsTable.id, agentId));

    await db.insert(activityTable).values({
      id: randomUUID(), type: "agent_completed",
      agent_id: agentId, agent_name: agent.nameAr || agent.name,
      title: `${agent.nameAr || agent.name} أكمل المهمة`,
      description: `المهمة: ${action} | المدة: ${Math.floor(duration / 1000)}ث | الرموز: ${tokenCount} | النموذج: ${modelUsed}`,
    });

    res.json({
      id: execId, agentId, action, status: "completed", result, error: null,
      duration_ms: duration, created_at: exec.created_at?.toISOString() || new Date().toISOString(),
      completed_at: new Date().toISOString(), tokens_used: tokenCount, model_used: modelUsed,
    });
  } catch (err: any) {
    console.error(`[وكيل ${agentId}] خطأ في التنفيذ:`, err?.message);
    const errMsg = err?.message || "فشل التنفيذ — تحقق من مفاتيح الذكاء الاصطناعي";
    await db.update(agentExecutionsTable).set({
      status: "failed", error: errMsg,
      duration_ms: Date.now() - startTime, completed_at: new Date(),
    }).where(eq(agentExecutionsTable.id, execId));

    res.status(500).json({
      id: execId, agentId, action, status: "failed", result: null, error: errMsg,
      duration_ms: Date.now() - startTime,
      created_at: exec.created_at?.toISOString() || new Date().toISOString(),
      completed_at: new Date().toISOString(), tokens_used: 0, model_used: agent.model,
    });
  }
});

router.get("/:agentId/executions", async (req, res) => {
  const { agentId } = req.params;
  const execs = await db.select().from(agentExecutionsTable)
    .where(eq(agentExecutionsTable.agent_id, agentId))
    .orderBy(desc(agentExecutionsTable.created_at)).limit(20);
  res.json(execs.map(e => ({
    ...e,
    created_at: e.created_at?.toISOString() || new Date().toISOString(),
    completed_at: e.completed_at?.toISOString() || null,
  })));
});

router.post("/pipeline-stream", async (req, res) => {
  const { agent_ids, input, pipeline_name } = req.body;
  if (!Array.isArray(agent_ids) || agent_ids.length === 0) {
    return res.status(400).json({ error: "agent_ids مطلوب" });
  }
  if (!input) return res.status(400).json({ error: "input مطلوب" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const pipelineId = randomUUID();
  const startTime = Date.now();
  const allSteps: Array<{ agent_id: string; agent_name: string; result: string; tokens: number; model: string; duration_ms: number }> = [];
  let totalTokens = 0;

  send({ type: "pipeline_start", pipeline_id: pipelineId, agent_count: agent_ids.length, pipeline_name: pipeline_name || "خط أنابيب مخصص" });

  try {
    for (let i = 0; i < agent_ids.length; i++) {
      const agentId = agent_ids[i];
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
      if (!agent) {
        send({ type: "step_skip", index: i, agent_id: agentId, reason: "الوكيل غير موجود" });
        continue;
      }

      send({ type: "step_start", index: i, agent_id: agentId, agent_name: agent.nameAr || agent.name, total: agent_ids.length });

      const stepStart = Date.now();
      const systemPrompt = getAgentSystemPrompt(agentId, agent.nameAr || agent.name);

      const contextParts: string[] = [`الفكرة الأصلية:\n${input}`];
      if (allSteps.length > 0) {
        contextParts.push("\n\n=== السياق المتراكم من الوكلاء السابقين ===");
        allSteps.forEach((s, idx) => {
          contextParts.push(`\n--- الوكيل ${idx + 1}: ${s.agent_name} ---\n${s.result}`);
        });
        contextParts.push(`\n\n=== مهمتك (الوكيل ${i + 1} من ${agent_ids.length}) ===\nبناءً على كل ما سبق، قم بدورك التكاملي في هذا المشروع المشترك. مخرجاتك ستُمرَّر للوكيل التالي.`);
      }

      const aiRes = await callAI(systemPrompt, contextParts.join(""), i <= 1 ? "pro" : "flash");
      const stepDuration = Date.now() - stepStart;
      totalTokens += aiRes.tokens;

      const step = { agent_id: agentId, agent_name: agent.nameAr || agent.name, result: aiRes.text, tokens: aiRes.tokens, model: aiRes.model, duration_ms: stepDuration };
      allSteps.push(step);

      await db.update(agentsTable).set({ executions_today: agent.executions_today + 1, last_active: new Date().toISOString(), status: "online" }).where(eq(agentsTable.id, agentId));

      await db.insert(agentExecutionsTable).values({
        id: randomUUID(), agent_id: agentId, action: `خط أنابيب: ${pipeline_name || "مخصص"} — المرحلة ${i + 1}`,
        status: "completed", result: aiRes.text, duration_ms: stepDuration,
        completed_at: new Date(), tokens_used: aiRes.tokens, model_used: aiRes.model,
      });

      send({ type: "step_complete", index: i, step, steps_done: allSteps.length, total: agent_ids.length });
    }

    const totalDuration = Date.now() - startTime;

    await db.insert(activityTable).values({
      id: randomUUID(), type: "agent_completed",
      title: `خط أنابيب مكتمل: ${pipeline_name || "مخصص"}`,
      description: `${allSteps.length} وكيل | ${totalTokens} رمز | ${Math.floor(totalDuration / 1000)}ث`,
    });

    send({
      type: "pipeline_complete",
      pipeline_id: pipelineId,
      steps: allSteps,
      final_output: allSteps[allSteps.length - 1]?.result || "",
      total_tokens: totalTokens,
      total_duration_ms: totalDuration,
      agent_count: allSteps.length,
    });
  } catch (err: any) {
    send({ type: "pipeline_error", error: err?.message || "فشل غير متوقع", steps: allSteps });
  }

  res.end();
});

router.post("/pipeline", async (req, res) => {
  const { agent_ids, input, pipeline_name } = req.body;
  if (!Array.isArray(agent_ids) || agent_ids.length === 0) {
    return res.status(400).json({ error: "agent_ids مطلوب كمصفوفة" });
  }
  if (!input) {
    return res.status(400).json({ error: "input مطلوب" });
  }

  const pipelineId = randomUUID();
  const startTime = Date.now();
  const steps: Array<{ agent_id: string; agent_name: string; result: string; tokens: number; model: string; duration_ms: number }> = [];
  let currentInput = input;
  let totalTokens = 0;

  try {
    for (let i = 0; i < agent_ids.length; i++) {
      const agentId = agent_ids[i];
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
      if (!agent) {
        console.warn(`[خط أنابيب] الوكيل ${agentId} غير موجود، تخطّي`);
        continue;
      }

      const stepStart = Date.now();
      const systemPrompt = getAgentSystemPrompt(agentId, agent.nameAr || agent.name);

      const contextMessage = i === 0
        ? `المهمة الأصلية:\n${currentInput}`
        : `المهمة الأصلية:\n${input}\n\n=== مخرجات المرحلة السابقة (${steps[i - 1]?.agent_name}) ===\n${steps[i - 1]?.result}\n\n=== مهمتك الآن ===\nبناءً على ما سبق، قم بدورك في خط الإنتاج:`;

      const aiRes = await callAI(systemPrompt, contextMessage, "flash");
      const stepDuration = Date.now() - stepStart;
      totalTokens += aiRes.tokens;

      steps.push({
        agent_id: agentId,
        agent_name: agent.nameAr || agent.name,
        result: aiRes.text,
        tokens: aiRes.tokens,
        model: aiRes.model,
        duration_ms: stepDuration,
      });

      currentInput = aiRes.text;

      await db.update(agentsTable).set({
        executions_today: agent.executions_today + 1,
        last_active: new Date().toISOString(), status: "online",
      }).where(eq(agentsTable.id, agentId));
    }

    const totalDuration = Date.now() - startTime;

    await db.insert(activityTable).values({
      id: randomUUID(), type: "agent_completed",
      title: `خط أنابيب مكتمل: ${pipeline_name || "خط مخصص"}`,
      description: `${agent_ids.length} وكيل | ${totalTokens} رمز | ${Math.floor(totalDuration / 1000)}ث`,
    });

    res.json({
      pipeline_id: pipelineId,
      pipeline_name: pipeline_name || "خط أنابيب مخصص",
      status: "completed",
      steps,
      final_output: steps[steps.length - 1]?.result || "",
      total_tokens: totalTokens,
      total_duration_ms: totalDuration,
      agent_count: steps.length,
    });
  } catch (err: any) {
    console.error("[خط أنابيب] خطأ:", err?.message);
    res.status(500).json({
      pipeline_id: pipelineId, status: "failed",
      error: err?.message || "فشل خط الأنابيب",
      steps,
      total_duration_ms: Date.now() - startTime,
    });
  }
});

router.post("/batch", async (req, res) => {
  const { agent_ids, input } = req.body;
  if (!Array.isArray(agent_ids) || !input) {
    return res.status(400).json({ error: "agent_ids و input مطلوبان" });
  }

  const results = await Promise.allSettled(
    agent_ids.map(async (agentId: string) => {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
      if (!agent) return { agent_id: agentId, error: "غير موجود" };
      const systemPrompt = getAgentSystemPrompt(agentId, agent.nameAr || agent.name);
      const aiRes = await callAI(systemPrompt, input, "flash");
      return { agent_id: agentId, agent_name: agent.nameAr || agent.name, result: aiRes.text, tokens: aiRes.tokens, model: aiRes.model };
    })
  );

  res.json({
    input,
    responses: results.map((r, i) => ({
      agent_id: agent_ids[i],
      ...(r.status === "fulfilled" ? r.value : { error: (r.reason as any)?.message }),
    })),
  });
});

export default router;
