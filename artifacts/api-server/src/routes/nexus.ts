import { Router } from "express";
import { db } from "@workspace/db";
import { nexusTasksTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callQwen, callGemini, isArabicDominant } from "../lib/ai.js";

const router = Router();

const TYPE_TO_AGENT: Record<string, string> = {
  document: "معالج المستندات",
  spreadsheet: "محلل جداول البيانات",
  presentation: "مصمم العروض التقديمية",
  email: "مدير البريد الإلكتروني",
  meeting: "مدير الاجتماعات",
  calendar: "جدوال التقويم",
  knowledge: "أمين المعرفة",
  research: "محلل الأبحاث",
  workflow: "أتمتة سير العمل",
  crm: "مدير علاقات العملاء",
};

const TYPE_PROMPTS: Record<string, string> = {
  document: `أنت معالج مستندات ذكي في نظام NEXUS المكتبي.
مهمتك: تحليل المستند المُقدَّم وإنتاج ملخصاً تنفيذياً يشمل: النقاط الرئيسية، بنود العمل، القرارات المهمة.
اكتب بالعربية إذا كان المحتوى عربياً.`,
  spreadsheet: `أنت محلل بيانات متخصص في نظام NEXUS.
مهمتك: تحليل جداول البيانات واكتشاف الأنماط والشذوذات وتقديم رؤى قابلة للتنفيذ.`,
  presentation: `أنت مصمم عروض تقديمية محترف في نظام NEXUS.
مهمتك: إنشاء هيكل عرض تقديمي احترافي مع محتوى مقنع ومنظّم.`,
  email: `أنت مدير بريد إلكتروني ذكي في نظام NEXUS.
مهمتك: تحليل البريد وتصنيفه وصياغة ردود مناسبة ومهنية.`,
  meeting: `أنت مدير اجتماعات متخصص في نظام NEXUS.
مهمتك: استخراج نقاط العمل وتلخيص الاجتماعات وتعيين المسؤوليات.`,
  research: `أنت محلل أبحاث متعمق في نظام NEXUS.
مهمتك: إجراء بحث شامل وتقديم تقرير منظم مع مصادر وتوصيات.`,
  knowledge: `أنت أمين المعرفة في نظام NEXUS.
مهمتك: تنظيم وفهرسة المعرفة المؤسسية وجعلها قابلة للبحث والاسترجاع.`,
  workflow: `أنت محرك أتمتة سير العمل في نظام NEXUS.
مهمتك: تصميم خطوات سير العمل الآلي وتحديد نقاط التكامل.`,
  crm: `أنت مدير علاقات العملاء في نظام NEXUS.
مهمتك: تحليل بيانات العملاء وتقديم رؤى لتحسين العلاقات وزيادة المبيعات.`,
  calendar: `أنت مدير التقويم الذكي في نظام NEXUS.
مهمتك: تحسين الجداول الزمنية وحل التعارضات واقتراح أوقات مثالية.`,
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
  const assignedAgent = TYPE_TO_AGENT[type] || "منسق NEXUS";
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
    description: `مُسند إلى ${assignedAgent} | الأولوية: ${priority} | الخطورة: ${riskScore}/10`,
  });

  const taskInput = `المهمة: ${title}\n${description ? `الوصف: ${description}` : ""}\nالأولوية: ${priority}`;
  const systemPrompt = TYPE_PROMPTS[type] || TYPE_PROMPTS.document;
  const useQwen = isArabicDominant(taskInput);

  (async () => {
    try {
      const r = await callGemini(systemPrompt, taskInput, "flash");
      const result = r.text;

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
        title: `NEXUS أكمل: ${title}`,
        description: result.substring(0, 150),
      });
    } catch (err: any) {
      console.error("NEXUS task error:", err?.message);
      await db.update(nexusTasksTable).set({
        status: "failed",
        progress: 0,
        result: `خطأ في المعالجة: ${err?.message || "فشل غير معروف"}`,
        completed_at: new Date(),
      }).where(eq(nexusTasksTable.id, id));
    }
  })();

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
    : 0;

  res.json({
    tasks_total: tasks.length,
    tasks_completed: completed.length,
    tasks_running: running.length,
    tasks_pending: pending.length,
    tasks_failed: failed.length,
    avg_completion_time_min: Math.round(avgTime * 10) / 10 || 0,
    sub_agents_active: Math.min(10, running.length + 2),
    documents_processed: tasks.filter(t => t.type === "document" && t.status === "completed").length,
    emails_handled: tasks.filter(t => t.type === "email" && t.status === "completed").length,
    meetings_managed: tasks.filter(t => t.type === "meeting" && t.status === "completed").length,
  });
});

export default router;
