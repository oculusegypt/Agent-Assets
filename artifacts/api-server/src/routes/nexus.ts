import { Router } from "express";
import { db } from "@workspace/db";
import { nexusTasksTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callAIForTask } from "../lib/ai.js";
import { broadcast } from "../lib/ws.js";

const router = Router();

const TYPE_TO_AGENT: Record<string, string> = {
  document:     "معالج المستندات",
  spreadsheet:  "محلل جداول البيانات",
  presentation: "مصمم العروض التقديمية",
  email:        "مدير البريد الإلكتروني",
  meeting:      "مدير الاجتماعات",
  calendar:     "منسق التقويم",
  knowledge:    "أمين المعرفة",
  research:     "محلل الأبحاث",
  workflow:     "أتمتة سير العمل",
  crm:          "مدير علاقات العملاء",
};

const TYPE_PROMPTS: Record<string, string> = {
  document: `أنت معالج مستندات ذكي في نظام NEXUS.
مهمتك: تحليل المستند أو الطلب وتقديم:
• ملخص تنفيذي منظم
• النقاط الرئيسية (مرقّمة)
• بنود العمل المستخرجة
• القرارات المهمة
• التوصيات والخطوات التالية
اكتب بالعربية بأسلوب مهني محكم.`,

  spreadsheet: `أنت محلل بيانات متخصص في نظام NEXUS.
مهمتك:
• تحليل الأرقام والبيانات المقدّمة
• اكتشاف الأنماط والاتجاهات والشذوذات
• مقارنة المؤشرات بالمعايير الصناعية
• تقديم رؤى قابلة للتنفيذ مع أرقام دقيقة
• اقتراح تحسينات مبنية على البيانات
اكتب بالعربية بأسلوب تحليلي دقيق.`,

  presentation: `أنت مصمم عروض تقديمية احترافي في نظام NEXUS.
مهمتك: إنشاء هيكل عرض تقديمي شامل يتضمن:
• عنوان وملخص تنفيذي
• هيكل الشرائح مع العناوين والنقاط الرئيسية
• الرسائل المحورية لكل شريحة
• توصيات التصميم البصري
• شريحة ختامية مقنعة مع CTA
اكتب بالعربية بأسلوب إقناعي.`,

  email: `أنت مدير بريد إلكتروني ذكي في نظام NEXUS.
مهمتك: صياغة بريد إلكتروني مثالي يتضمن:
• سطر موضوع جذاب وواضح
• تحية مناسبة للسياق
• نص رسالة مهني ومنظم
• CTA واضح
• نهاية احترافية
• نسخة عربية وإنجليزية عند الحاجة
اكتب بأسلوب مهني رسمي أو ودي حسب السياق.`,

  meeting: `أنت مدير اجتماعات في نظام NEXUS.
مهمتك: إعداد محضر اجتماع احترافي يتضمن:
• ملخص الاجتماع والحضور والتاريخ
• القرارات المتخذة (مرقّمة)
• نقاط العمل مع المسؤول والموعد
• المواضيع المؤجلة
• الخطوات التالية
اكتب بالعربية بصيغة رسمية.`,

  research: `أنت محلل أبحاث عميق في نظام NEXUS.
مهمتك: تقديم تقرير بحثي شامل يتضمن:
• ملخص تنفيذي
• نتائج البحث الرئيسية (مع أمثلة وأرقام)
• تحليل المخاطر والفرص
• مقارنة الخيارات المتاحة
• توصيات مرتّبة بالأولوية
• مصادر مقترحة للبحث الإضافي
اكتب بالعربية بأسلوب أكاديمي-تطبيقي.`,

  knowledge: `أنت أمين المعرفة في نظام NEXUS.
مهمتك: تنظيم وتوثيق المعرفة المؤسسية:
• فهرسة المعلومات بشكل منطقي
• إنشاء وثائق مرجعية واضحة
• تصنيف المحتوى بعلامات دلالية
• ربط المفاهيم المتشابهة
• إعداد ملخص للتعلم السريع
اكتب بالعربية بأسلوب موسوعي.`,

  workflow: `أنت محرك أتمتة سير العمل في نظام NEXUS.
مهمتك: تصميم سير عمل تلقائي فعّال:
• رسم خريطة العملية خطوة بخطوة
• تحديد نقاط التكامل والأدوات المطلوبة
• بناء شجرة قرارات واضحة
• وصف متطلبات API والبيانات
• تقدير الوقت المُوفَّر
اكتب بالعربية بأسلوب تقني عملي.`,

  crm: `أنت مدير علاقات العملاء في نظام NEXUS.
مهمتك: تحليل وتطوير استراتيجية العملاء:
• تحليل مرحلة العميل في خط الأنابيب
• توصيات لتقوية العلاقة
• صياغة رسائل تواصل مخصصة
• تحديد فرص البيع الإضافي
• مقترحات للاحتفاظ بالعملاء
اكتب بالعربية بأسلوب تجاري.`,

  calendar: `أنت منسق التقويم الذكي في نظام NEXUS.
مهمتك: تحسين إدارة الوقت:
• تحليل الجدول الزمني الحالي
• اقتراح أوقات الاجتماعات المثالية
• حل التعارضات بأقل خسائر
• تقدير مدة المهام بدقة
• توصيات لتحسين الإنتاجية اليومية
اكتب بالعربية بأسلوب تنظيمي.`,
};

const TASK_TEMPLATES = [
  {
    id: "tpl-weekly-report",
    name: "تقرير أسبوعي",
    type: "document",
    priority: "high",
    description: "أعدّ تقريراً أسبوعياً شاملاً يتضمن إنجازات الفريق، العقبات، الأهداف القادمة، والمؤشرات الرئيسية.",
    icon: "FileText",
  },
  {
    id: "tpl-meeting-minutes",
    name: "محضر اجتماع",
    type: "meeting",
    priority: "medium",
    description: "استخرج بنود العمل والقرارات والمسؤوليات من ملاحظات الاجتماع.",
    icon: "CalendarDays",
  },
  {
    id: "tpl-research-report",
    name: "تقرير بحثي",
    type: "research",
    priority: "medium",
    description: "ابحث وحلّل موضوعاً محدداً وقدّم تقريراً شاملاً مع توصيات قابلة للتنفيذ.",
    icon: "Search",
  },
  {
    id: "tpl-client-proposal",
    name: "عرض للعميل",
    type: "presentation",
    priority: "high",
    description: "أنشئ عرض تقديمي احترافي للعميل يوضح القيمة المضافة والحل المقترح.",
    icon: "Presentation",
  },
  {
    id: "tpl-follow-up-email",
    name: "بريد متابعة",
    type: "email",
    priority: "medium",
    description: "اكتب بريداً إلكترونياً مهنياً لمتابعة اجتماع أو صفقة سابقة.",
    icon: "Mail",
  },
  {
    id: "tpl-process-automation",
    name: "أتمتة عملية",
    type: "workflow",
    priority: "high",
    description: "صمّم سير عمل تلقائي لعملية متكررة لتوفير الوقت والجهد.",
    icon: "Workflow",
  },
  {
    id: "tpl-data-analysis",
    name: "تحليل بيانات",
    type: "spreadsheet",
    priority: "medium",
    description: "حلّل مجموعة بيانات واكتشف الأنماط والرؤى القابلة للتنفيذ.",
    icon: "BarChart3",
  },
  {
    id: "tpl-knowledge-doc",
    name: "توثيق معرفي",
    type: "knowledge",
    priority: "low",
    description: "وثّق إجراءات أو معرفة مؤسسية لتسهيل التعلم والمشاركة.",
    icon: "BookOpen",
  },
];

router.get("/tasks", async (_req, res) => {
  const tasks = await db.select().from(nexusTasksTable)
    .orderBy(desc(nexusTasksTable.created_at)).limit(50);
  res.json(tasks.map(t => ({
    ...t,
    created_at: t.created_at?.toISOString() || new Date().toISOString(),
    completed_at: t.completed_at?.toISOString() || null,
  })));
});

router.get("/templates", (_req, res) => {
  res.json(TASK_TEMPLATES);
});

router.post("/tasks", async (req, res) => {
  const { title, description, type, priority } = req.body;
  const id = randomUUID();
  const assignedAgent = TYPE_TO_AGENT[type] || "منسق NEXUS";
  const riskScore = priority === "urgent" ? 7 : priority === "high" ? 5 : priority === "medium" ? 3 : 1;

  const [task] = await db.insert(nexusTasksTable).values({
    id, title, description, type, priority,
    status: "running", assigned_agent: assignedAgent, risk_score: riskScore,
  }).returning();

  const typeAr: Record<string, string> = {
    document: "مستند", spreadsheet: "جدول بيانات", presentation: "عرض تقديمي",
    email: "بريد", meeting: "اجتماع", research: "بحث",
    knowledge: "معرفة", workflow: "سير عمل", crm: "CRM", calendar: "تقويم",
  };

  await db.insert(activityTable).values({
    id: randomUUID(), type: "agent_started",
    title: `${assignedAgent} بدأ مهمة جديدة`,
    description: `${title} | النوع: ${typeAr[type] || type} | الأولوية: ${priority}`,
  });

  broadcast("nexus_updated");
  broadcast("activity_updated");

  res.status(201).json({
    ...task,
    created_at: task.created_at?.toISOString() || new Date().toISOString(),
    completed_at: null,
  });

  setImmediate(async () => {
    try {
      const prompt = TYPE_PROMPTS[type] || `أنت وكيل NEXUS. نفّذ المهمة التالية باحترافية عالية. أجب بالعربية.`;
      const userMsg = `المهمة: ${title}\n\nالتفاصيل:\n${description}`;
      const aiRes = await callAIForTask("text_simple", prompt, userMsg);

      await db.update(nexusTasksTable).set({
        status: "completed",
        result: aiRes.text,
        completed_at: new Date(),
      } as any).where(eq(nexusTasksTable.id, id));

      await db.insert(activityTable).values({
        id: randomUUID(), type: "agent_completed",
        title: `${assignedAgent} أكمل المهمة`,
        description: `${title} | ${aiRes.tokens} رمز | ${aiRes.model}`,
      });
      broadcast("nexus_updated");
      broadcast("activity_updated");
      broadcast("metrics_updated");
    } catch (err: any) {
      await db.update(nexusTasksTable).set({
        status: "failed",
        result: `خطأ: ${err?.message}`,
        completed_at: new Date(),
      } as any).where(eq(nexusTasksTable.id, id));
    }
  });
});

router.get("/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const [task] = await db.select().from(nexusTasksTable).where(eq(nexusTasksTable.id, taskId));
  if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
  res.json({
    ...task,
    created_at: task.created_at?.toISOString() || new Date().toISOString(),
    completed_at: task.completed_at?.toISOString() || null,
  });
});

router.delete("/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  await db.delete(nexusTasksTable).where(eq(nexusTasksTable.id, taskId));
  res.json({ success: true, deleted_id: taskId });
});

router.patch("/tasks/:taskId/status", async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  const allowed = ["pending", "running", "completed", "failed"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "حالة غير صالحة" });
  const [task] = await db.update(nexusTasksTable)
    .set({ status, ...(status === "completed" ? { completed_at: new Date() } : {}) })
    .where(eq(nexusTasksTable.id, taskId))
    .returning();
  if (!task) return res.status(404).json({ error: "المهمة غير موجودة" });
  broadcast("nexus_updated");
  res.json({ success: true, task: { ...task, created_at: task.created_at?.toISOString() || new Date().toISOString(), completed_at: task.completed_at?.toISOString() || null } });
});

router.post("/recover-stuck", async (_req, res) => {
  try {
    const stuck = await db.select().from(nexusTasksTable).where(eq(nexusTasksTable.status, "running"));
    if (stuck.length === 0) return res.json({ recovered: 0 });
    for (const task of stuck) {
      await db.update(nexusTasksTable)
        .set({ status: "pending" })
        .where(eq(nexusTasksTable.id, task.id));
    }
    res.json({ recovered: stuck.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "فشل الاسترداد" });
  }
});

router.get("/summary", async (_req, res) => {
  const tasks = await db.select().from(nexusTasksTable);
  const completed = tasks.filter(t => t.status === "completed").length;
  const running = tasks.filter(t => t.status === "running").length;
  const failed = tasks.filter(t => t.status === "failed").length;
  const pending = tasks.filter(t => t.status === "pending").length;

  const typeCounts = Object.keys(TYPE_TO_AGENT).reduce((acc, type) => {
    acc[type] = tasks.filter(t => t.type === type).length;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    total: tasks.length, completed, running, failed, pending,
    by_type: typeCounts,
    completion_rate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  });
});

export default router;
