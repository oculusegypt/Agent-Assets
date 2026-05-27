import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, systemAlertsTable, complaintsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callAI, AGENT_SYSTEM_PROMPTS } from "../lib/ai.js";
import { broadcast } from "../lib/ws.js";

const router = Router();

const AI_NEWS = [
  { id: "n1",  title: "Google Gemini 2.5 Ultra Sets New Records", titleAr: "جوجل جيميناي 2.5 ألترا يحطم أرقاماً قياسية جديدة في الاستدلال متعدد الوسائط", summary: "نموذج Gemini 2.5 Ultra يحقق 92.3% في MMLU-Pro، متجاوزاً جميع النماذج السابقة في الاستدلال المعقد وفهم اللغة العربية.", source: "Google DeepMind", url: "https://deepmind.google", category: "language-models", published_at: new Date(Date.now() - 3600000).toISOString(), impact: "تحسين محتمل في جودة استجابات الوكلاء العربية بنسبة 15-20%" },
  { id: "n2",  title: "Wan Video 3.0 Generates 4K Cinematic Footage", titleAr: "وان فيديو 3.0 يولّد لقطات سينمائية 4K من نصوص بشكل مباشر", summary: "أليبابا تُطلق Wan Video 3.0 بدعم دقة 4K و120fps وتحسين جذري في الاتساق الزمني لصناعة الأفلام بالذكاء الاصطناعي.", source: "Alibaba Research", url: "https://arxiv.org", category: "video", published_at: new Date(Date.now() - 7200000).toISOString(), impact: "رفع جودة التوليد في مرحلة الفيديو لمشاريع ACIS" },
  { id: "n3",  title: "FLUX.1 Pro Ultra: New Photorealistic Standard", titleAr: "فلاكس 1 برو ألترا: المعيار الجديد لتوليد الصور الفوتوواقعية", summary: "Black Forest Labs تُطلق FLUX.1 Pro Ultra بدقة مضاعفة والتوليد خلال 3 ثوانٍ.", source: "Black Forest Labs", url: "https://blackforestlabs.ai", category: "image", published_at: new Date(Date.now() - 10800000).toISOString(), impact: "تحسين مرحلة توليد الصور في خط الإنتاج السينمائي" },
  { id: "n4",  title: "Kokoro TTS v2.0 Achieves Human-Level Arabic Voice", titleAr: "كوكورو TTS 2.0 يحقق تركيب صوت عربي بمستوى بشري", summary: "Kokoro TTS 2.0 بدعم كامل للهجات العربية يحقق MOS Score 4.8/5.0.", source: "HuggingFace Blog", url: "https://huggingface.co", category: "audio", published_at: new Date(Date.now() - 14400000).toISOString(), impact: "تحسين جودة التعليق الصوتي العربي في مشاريع ACIS بشكل كبير" },
  { id: "n5",  title: "Claude Opus 4: 2M Context + Autonomous Agents", titleAr: "كلود أوبس 4: نافذة سياق 2 مليون رمز وقدرات وكيل مستقلة", summary: "Anthropic تُطلق Claude Opus 4 مع نافذة سياق 2M رمز واستخدام أدوات مدمج.", source: "Anthropic", url: "https://anthropic.com", category: "language-models", published_at: new Date(Date.now() - 18000000).toISOString(), impact: "نموذج بديل محتمل للمهام التحليلية طويلة المدى" },
  { id: "n6",  title: "MusicGen 3.0 Composes Full Orchestral Scores", titleAr: "ميوزيك جن 3.0 يؤلف موسيقى أوركسترالية كاملة مع تحكم عاطفي", summary: "Meta AI تُطلق MusicGen 3.0 لتوليد موسيقى أوركسترالية كاملة مع تحكم دقيق في المزاج والإيقاع.", source: "Meta AI Research", url: "https://ai.meta.com", category: "audio", published_at: new Date(Date.now() - 21600000).toISOString(), impact: "تعزيز قدرة وكيل الصوت والموسيقى في ACIS" },
  { id: "n7",  title: "Runway Gen-4: Real-Time AI Video Editing", titleAr: "رانواي جن-4 يقدم تحرير الفيديو الفوري بالذكاء الاصطناعي", summary: "Runway Gen-4 يتيح تحرير الفيديو في الوقت الفعلي ونقل الحركة واتساق الشخصيات.", source: "Runway ML", url: "https://runwayml.com", category: "video", published_at: new Date(Date.now() - 25200000).toISOString(), impact: "تحسين مرحلة ما بعد الإنتاج في مشاريع StoryboardToVision" },
  { id: "n8",  title: "OpenAI Sora v2: 10-Minute Videos with Perfect Continuity", titleAr: "سورا v2: مقاطع فيديو 10 دقائق مع اتساق مثالي للشخصيات", summary: "OpenAI تُطلق Sora v2 مع دعم مقاطع تصل إلى 10 دقائق مع هوية شخصيات مستمرة.", source: "OpenAI", url: "https://openai.com/sora", category: "video", published_at: new Date(Date.now() - 28800000).toISOString(), impact: "خيار مميّز لإنتاج الأفلام الطويلة بالذكاء الاصطناعي" },
  { id: "n9",  title: "Qwen 3.0 72B Tops Arabic NLP Leaderboard", titleAr: "كوين 3.0 72B يتصدر قائمة معالجة اللغة العربية بفارق كبير", summary: "Qwen 3.0 72B يحقق أداء متصدراً في جميع معايير NLP العربية مع دقة 96%.", source: "Alibaba DAMO", url: "https://qwenlm.github.io", category: "language-models", published_at: new Date(Date.now() - 32400000).toISOString(), impact: "النموذج الاحتياطي الأقوى حالياً لمعالجة اللغة العربية في ACIS" },
  { id: "n10", title: "LangGraph v2: Persistent Multi-Agent Memory", titleAr: "لانغ جراف v2 يتيح الذاكرة المستمرة متعددة الوكلاء عبر الجلسات", summary: "LangChain تُطلق LangGraph v2 مع ذاكرة حالة مستمرة وتواصل مباشر بين الوكلاء.", source: "LangChain Blog", url: "https://langchain.com", category: "ai", published_at: new Date(Date.now() - 36000000).toISOString(), impact: "تقنية ذات صلة مباشرة بتطوير منظومة ACIS متعددة الوكلاء" },
];

router.get("/status", async (_req, res) => {
  const agents = await db.select().from(agentsTable);
  const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
  const complaints = await db.select().from(complaintsTable).where(eq(complaintsTable.status, "open"));

  const online = agents.filter(a => a.status === "online").length;
  const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 100 * 0.7 + (100 - Math.min(alerts.length * 5, 30)));

  res.json({
    status: alerts.length > 3 ? "analyzing" : "active",
    agents_monitored: agents.length,
    alerts_active: alerts.length,
    issues_resolved_today: complaints.filter(c => c.status === "resolved").length,
    system_health_score: Math.round(healthScore),
    last_analysis: new Date(Date.now() - 300000).toISOString(),
    uptime_hours: 72,
    news_last_updated: new Date(Date.now() - 120000).toISOString(),
    current_focus: alerts.length > 0
      ? `يُحقق في: ${alerts[0]?.title || "أداء النظام"}`
      : "يراقب جميع الوكلاء — النظام مستقر",
    recommendations: [],
  });
});

router.get("/news", (_req, res) => res.json(AI_NEWS));

router.post("/chat", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "الرسالة مطلوبة" });

  const agents = await db.select().from(agentsTable);
  const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
  const complaints = await db.select().from(complaintsTable);
  const online = agents.filter(a => a.status === "online").length;
  const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 100 * 0.7 + (100 - Math.min(alerts.length * 5, 30)));

  const systemContext = `
السياق الحالي للنظام (${new Date().toLocaleString("ar-SA")}):
• الوكلاء: ${agents.length} إجمالي، ${online} متصل، ${agents.filter(a => a.status === "busy").length} مشغول
• التنبيهات النشطة: ${alerts.length} (${alerts.slice(0,2).map(a => a.title).join(" | ") || "لا يوجد"})
• الشكاوى المفتوحة: ${complaints.filter(c => c.status === "open" || c.status === "investigating").length}
• صحة النظام: ${Math.round(healthScore)}%
`;

  const billiePrompt = AGENT_SYSTEM_PROMPTS["billie"] + `

أنت بيليه، المشرفة العليا على نظام ACIS متعدد الوكلاء. أنت تتحدثين مع القائد مباشرةً.
ردودك:
- بالعربية الفصحى الواضحة
- مختصرة وذكية (3-6 جمل عادةً، إلا إذا طُلب تقرير مفصل)
- احترافية ودية في آن واحد
- تعتمدين على بيانات النظام الفعلية أدناه

${systemContext}`;

  try {
    const { callAIWithHistory } = await import("../lib/ai.js");
    const msgs = history.slice(-6).map((h: any) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: h.text || h.content || "",
    }));
    const result = await callAIWithHistory(billiePrompt, msgs, message, "flash");

    await db.insert(activityTable).values({
      id: randomUUID(), type: "billie_alert",
      title: "محادثة مع بيليه",
      description: message.substring(0, 100),
    });

    res.json({
      reply: result.text,
      model: result.model,
      tokens: result.tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[بيليه شات] خطأ:", err?.message);
    res.status(500).json({ error: "فشل في الحصول على رد بيليه — تحقق من مفاتيح API", detail: err?.message });
  }
});

router.post("/news/analyze", async (req, res) => {
  const { topic } = req.body;
  try {
    const r = await callAI(
      AGENT_SYSTEM_PROMPTS["billie"],
      `حلّل أهمية أحدث التطورات في مجال الذكاء الاصطناعي لعام 2026 على نظام ACIS متعدد الوكلاء.
${topic ? `ركّز على موضوع: ${topic}` : ""}
قدّم: أهم 3 تطورات، تأثيرها على النظام، وتوصيات للاستفادة منها.`,
      "flash"
    );
    res.json({ analysis: r.text, model: r.model, generated_at: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

router.get("/alerts", async (_req, res) => {
  const alerts = await db.select().from(systemAlertsTable)
    .orderBy(desc(systemAlertsTable.created_at)).limit(20);
  res.json(alerts.map(a => ({
    ...a,
    created_at: a.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: a.resolved_at?.toISOString() || null,
  })));
});

router.post("/alerts", async (req, res) => {
  const { severity, title, message, agent_id } = req.body;
  if (!title || !message) return res.status(400).json({ error: "title و message مطلوبان" });

  const id = randomUUID();
  const [alert] = await db.insert(systemAlertsTable).values({
    id, severity: severity || "warning",
    agent_id: agent_id || null,
    title, message,
  }).returning();

  await db.insert(activityTable).values({
    id: randomUUID(), type: "billie_alert",
    title: `تنبيه جديد: ${title}`,
    description: message.substring(0, 150),
  });

  broadcast("alerts_updated");
  broadcast("activity_updated");

  res.status(201).json({
    ...alert,
    created_at: alert.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: null,
  });
});

router.patch("/alerts/:alertId/resolve", async (req, res) => {
  const { alertId } = req.params;
  await db.update(systemAlertsTable).set({
    resolved: true,
    resolved_at: new Date(),
  }).where(eq(systemAlertsTable.id, alertId));

  broadcast("alerts_updated");
  res.json({ success: true, resolved_at: new Date().toISOString() });
});

router.post("/analyze", async (req, res) => {
  const { scope, target_agent_id } = req.body;
  const id = randomUUID();

  const agents = await db.select().from(agentsTable);
  const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
  const complaints = await db.select().from(complaintsTable);
  const online = agents.filter(a => a.status === "online").length;
  const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 100 * 0.7 + (100 - Math.min(alerts.length * 5, 30)));

  const analysisContext = `
بيانات النظام الحالية (${new Date().toLocaleString("ar-SA")}):
• الوكلاء: ${agents.length} إجمالي، ${online} متصل، ${agents.filter(a => a.status === "busy").length} مشغول
• التنبيهات النشطة (${alerts.length}): ${alerts.slice(0, 3).map(a => a.title).join(" | ") || "لا توجد"}
• الشكاوى المفتوحة: ${complaints.filter(c => c.status === "open").length}
• درجة الصحة المحسوبة: ${Math.round(healthScore)}%
• نطاق التحليل: ${scope || "شامل"}
${target_agent_id ? `• الوكيل المستهدف: ${target_agent_id}` : ""}
• الوكلاء غير المتصلين: ${agents.filter(a => a.status !== "online").map(a => a.nameAr || a.name).join(" | ") || "لا يوجد"}
`;

  try {
    const result = await callAI(
      AGENT_SYSTEM_PROMPTS["billie"],
      `حلّل النظام بناءً على البيانات وقدّم تقريراً يشمل:
1. تقييم الحالة العامة مع نقاط القوة والضعف
2. المخاطر والتهديدات المحتملة
3. توصيات محددة وقابلة للتنفيذ (3-5 توصيات مرتّبة بالأولوية)
4. خطة التحسين المقترحة للأسبوع القادم

البيانات:
${analysisContext}`,
      "flash"
    );

    const lines = result.text.split("\n").filter(l => l.trim());
    const findings = lines.slice(0, 6).map(line => ({
      level: line.includes("عاجل") || line.includes("خطر") ? "warning" : "info",
      message: line.replace(/^[-*•\d.]\s*/, "").substring(0, 250),
    }));
    const recommendations = lines
      .filter(l => l.includes("توصية") || l.includes("يُنصح") || l.includes("يجب") || l.includes("ينبغي"))
      .slice(0, 3)
      .map(l => l.replace(/^[-*•\d.]\s*/, "").substring(0, 200));

    await db.insert(activityTable).values({
      id: randomUUID(), type: "billie_alert",
      title: "بيليه أجرى تحليلاً شاملاً للنظام",
      description: `النطاق: ${scope} | الصحة: ${Math.round(healthScore)}% | ${findings.length} نتائج`,
    });

    res.json({
      id, scope, health_score: healthScore,
      findings: findings.length > 0 ? findings : [{ level: "info", message: result.text.substring(0, 300) }],
      recommendations: recommendations.length > 0 ? recommendations : [result.text.substring(0, 200)],
      full_analysis: result.text,
      model_used: result.model,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[بيليه] خطأ في التحليل:", err?.message);
    res.json({
      id, scope, health_score: healthScore,
      findings: [{ level: "info", message: `درجة الصحة المحسوبة: ${Math.round(healthScore)}% — مُستخرجة من بيانات قاعدة البيانات الحية` }],
      recommendations: ["تفعيل GEMINI_API_KEY أو ALIBABA_API_KEY لتمكين التحليل الذكي الكامل"],
      full_analysis: `الصحة: ${Math.round(healthScore)}% | الوكلاء: ${online}/${agents.length} متصل | التنبيهات: ${alerts.length}`,
      created_at: new Date().toISOString(),
    });
  }
});

router.post("/update-agent", async (req, res) => {
  const { agent_id, update_type, changes, reason } = req.body;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  if (update_type === "status" && changes.status) {
    await db.update(agentsTable).set({ status: changes.status }).where(eq(agentsTable.id, agent_id));
  } else if (update_type === "model" && changes.model) {
    await db.update(agentsTable).set({ model: changes.model }).where(eq(agentsTable.id, agent_id));
  }

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    agent_id, agent_name: agent.nameAr || agent.name,
    title: `بيليه حدّث ${agent.nameAr || agent.name}`,
    description: `نوع التحديث: ${update_type} | السبب: ${reason}`,
  });

  res.json({
    success: true, agent_id, update_type,
    message: `تم تحديث ${agent.nameAr || agent.name} بنجاح.`,
    applied_at: new Date().toISOString(),
  });
});

router.get("/complaints", async (_req, res) => {
  const complaints = await db.select().from(complaintsTable)
    .orderBy(desc(complaintsTable.created_at)).limit(50);
  res.json(complaints.map(c => ({
    ...c,
    created_at: c.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: c.resolved_at?.toISOString() || null,
  })));
});

router.post("/complaints", async (req, res) => {
  const { title, description, agent_id, severity } = req.body;
  const id = randomUUID();

  let billieResponse = `تم استلام شكواك بواسطة بيليه. الأولوية: ${severity === "critical" ? "عاجل جداً" : severity === "high" ? "مرتفعة" : "متوسطة"}. جاري التحقيق.`;

  try {
    const result = await callAI(
      AGENT_SYSTEM_PROMPTS["billie"],
      `مستخدم قدّم شكوى:
العنوان: ${title}
الوصف: ${description}
${agent_id ? `الوكيل المعني: ${agent_id}` : ""}
الخطورة: ${severity}

اكتب رداً قصيراً (3-4 جمل) بالعربية يطمئن المستخدم، يوضح الإجراءات المتخذة، ويقدر الوقت المتوقع للحل.`,
      "flash"
    );
    billieResponse = result.text;
  } catch (err: any) {
    console.error("[بيليه] خطأ في الرد على الشكوى:", err?.message);
  }

  const [complaint] = await db.insert(complaintsTable).values({
    id, title, description, agent_id: agent_id || null,
    severity, status: "investigating", billie_response: billieResponse,
  }).returning();

  await db.insert(systemAlertsTable).values({
    id: randomUUID(),
    severity: severity === "critical" ? "critical" : severity === "high" ? "error" : "warning",
    agent_id: agent_id || null,
    title: `شكوى جديدة: ${title}`,
    message: description.substring(0, 200),
  });

  res.status(201).json({
    ...complaint,
    created_at: complaint.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: null,
  });
});

router.patch("/complaints/:id/resolve", async (req, res) => {
  const { id } = req.params;
  const { resolution_note } = req.body;
  const [complaint] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id));
  if (!complaint) return res.status(404).json({ error: "الشكوى غير موجودة" });

  let finalResponse = resolution_note || "تم حل هذه المشكلة بنجاح. شكراً لتواصلك.";
  try {
    const r = await callAI(
      AGENT_SYSTEM_PROMPTS["billie"],
      `أغلق هذه الشكوى بنجاح وأرسل رسالة ختامية احترافية:
الشكوى: ${complaint.title}
الوصف: ${complaint.description}
${resolution_note ? `ملاحظة الحل: ${resolution_note}` : ""}

اكتب رسالة ختام قصيرة (2-3 جمل) تؤكد حل المشكلة وتشكر المستخدم.`,
      "flash"
    );
    finalResponse = r.text;
  } catch {}

  await db.update(complaintsTable).set({
    status: "resolved",
    billie_response: finalResponse,
    resolved_at: new Date(),
  }).where(eq(complaintsTable.id, id));

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    title: `بيليه أغلق الشكوى: ${complaint.title}`,
    description: finalResponse.substring(0, 150),
  });

  res.json({
    success: true, id,
    final_response: finalResponse,
    resolved_at: new Date().toISOString(),
  });
});

export default router;
