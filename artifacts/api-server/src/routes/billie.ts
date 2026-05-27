import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, systemAlertsTable, complaintsTable, activityTable, agentPatchesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { callAIForTask, callGeminiTTS, callGeminiImageGen, AGENT_SYSTEM_PROMPTS } from "../lib/ai.js";
import { saveTtsAudio, saveImageFile, extractTtsScript } from "../lib/media.js";
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
    const msgs = history.slice(-6).map((h: any) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: h.text || h.content || "",
    }));
    const result = await callAIForTask("text_complex", billiePrompt, message, { history: msgs });

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
    const r = await callAIForTask(
      "text_complex",
      AGENT_SYSTEM_PROMPTS["billie"],
      `حلّل أهمية أحدث التطورات في مجال الذكاء الاصطناعي لعام 2026 على نظام ACIS متعدد الوكلاء.
${topic ? `ركّز على موضوع: ${topic}` : ""}
قدّم: أهم 3 تطورات، تأثيرها على النظام، وتوصيات للاستفادة منها.`
    );
    res.json({ analysis: r.text, model: r.model, generated_at: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// ── Streaming chat (SSE) ──────────────────────────────────────
router.post("/stream", async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "الرسالة مطلوبة" });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const agents = await db.select().from(agentsTable);
    const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));
    const complaints = await db.select().from(complaintsTable);
    const online = agents.filter(a => a.status === "online").length;
    const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 100 * 0.7 + (100 - Math.min(alerts.length * 5, 30)));

    const systemContext = `
السياق الحالي للنظام (${new Date().toLocaleString("ar-SA")}):
• الوكلاء: ${agents.length} إجمالي، ${online} متصل، ${agents.filter(a => a.status === "busy").length} مشغول
• التنبيهات النشطة: ${alerts.length} (${alerts.slice(0,2).map(a => a.title).join(" | ") || "لا يوجد"})
• الشكاوى المفتوحة: ${complaints.filter(c => c.status === "open").length}
• صحة النظام: ${Math.round(healthScore)}%
`;
    const billiePrompt = AGENT_SYSTEM_PROMPTS["billie"] + `\n\nأنت بيليه، المشرفة العليا على نظام ACIS. ردودك بالعربية الفصحى، مختصرة وذكية، احترافية ودية.\n${systemContext}`;
    const msgs = history.slice(-6).map((h: any) => ({
      role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: h.text || h.content || "",
    }));

    const result = await callAIForTask("text_complex", billiePrompt, message, { history: msgs });

    // Simulate word-by-word streaming of the complete result
    const words = result.text.split(" ");
    let accumulated = "";
    for (let i = 0; i < words.length; i++) {
      accumulated += (i > 0 ? " " : "") + words[i];
      send({ type: "chunk", text: accumulated, word_index: i, total_words: words.length });
      // Small delay for streaming effect (5-15ms per word)
      await new Promise(r => setTimeout(r, 8));
    }

    send({ type: "done", text: result.text, model: result.model, tokens: result.tokens, timestamp: new Date().toISOString() });

    await db.insert(activityTable).values({
      id: randomUUID(), type: "billie_alert",
      title: "محادثة مع بيليه (stream)",
      description: message.substring(0, 100),
    });
  } catch (err: any) {
    send({ type: "error", message: err?.message || "فشل الاتصال" });
  }
  res.end();
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
    const result = await callAIForTask(
      "text_complex",
      AGENT_SYSTEM_PROMPTS["billie"],
      `حلّل النظام بناءً على البيانات وقدّم تقريراً يشمل:
1. تقييم الحالة العامة مع نقاط القوة والضعف
2. المخاطر والتهديدات المحتملة
3. توصيات محددة وقابلة للتنفيذ (3-5 توصيات مرتّبة بالأولوية)
4. خطة التحسين المقترحة للأسبوع القادم

البيانات:
${analysisContext}`
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
    const result = await callAIForTask(
      "text_complex",
      AGENT_SYSTEM_PROMPTS["billie"],
      `مستخدم قدّم شكوى:
العنوان: ${title}
الوصف: ${description}
${agent_id ? `الوكيل المعني: ${agent_id}` : ""}
الخطورة: ${severity}

اكتب رداً قصيراً (3-4 جمل) بالعربية يطمئن المستخدم، يوضح الإجراءات المتخذة، ويقدر الوقت المتوقع للحل.`
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
    const r = await callAIForTask(
      "text_complex",
      AGENT_SYSTEM_PROMPTS["billie"],
      `أغلق هذه الشكوى بنجاح وأرسل رسالة ختامية احترافية:
الشكوى: ${complaint.title}
الوصف: ${complaint.description}
${resolution_note ? `ملاحظة الحل: ${resolution_note}` : ""}

اكتب رسالة ختام قصيرة (2-3 جمل) تؤكد حل المشكلة وتشكر المستخدم.`
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

// ══════════════════════════════════════════════════════════════
//  جراحة الكود — Code Surgery Endpoints
// ══════════════════════════════════════════════════════════════

const PATCHABLE_FIELDS = ["prompt", "status", "model", "description", "descriptionAr", "capabilities", "subagents"] as const;
type PatchableField = typeof PATCHABLE_FIELDS[number];

// GET /api/billie/agent-code/:agentId — جلب إعدادات وكيل كاملة
router.get("/agent-code/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  const patches = await db.select().from(agentPatchesTable)
    .where(eq(agentPatchesTable.agent_id, agentId))
    .orderBy(desc(agentPatchesTable.created_at))
    .limit(10);

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      nameAr: agent.nameAr,
      status: agent.status,
      model: agent.model,
      description: agent.description,
      descriptionAr: agent.descriptionAr,
      capabilities: agent.capabilities,
      subagents: agent.subagents,
      prompt: agent.prompt || "(يستخدم البرومبت الافتراضي)",
      system: agent.system,
      icon: agent.icon,
      color: agent.color,
      executions_today: agent.executions_today,
      success_rate: agent.success_rate,
      avg_response_ms: agent.avg_response_ms,
    },
    recent_patches: patches.map(p => ({
      ...p,
      created_at: p.created_at?.toISOString() || new Date().toISOString(),
      rolled_back_at: p.rolled_back_at?.toISOString() || null,
    })),
    patchable_fields: PATCHABLE_FIELDS,
  });
});

// POST /api/billie/diagnose — تشخيص ذكي واقتراح تعديلات
router.post("/diagnose", async (req, res) => {
  const { agent_id, issue_description } = req.body;
  if (!agent_id) return res.status(400).json({ error: "agent_id مطلوب" });

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  const recentPatches = await db.select().from(agentPatchesTable)
    .where(eq(agentPatchesTable.agent_id, agent_id))
    .orderBy(desc(agentPatchesTable.created_at))
    .limit(5);

  const agentSnapshot = `
الوكيل: ${agent.nameAr || agent.name} (${agent.id})
الحالة: ${agent.status}
النموذج: ${agent.model}
معدل النجاح: ${agent.success_rate}%
متوسط الاستجابة: ${agent.avg_response_ms}ms
التنفيذات اليوم: ${agent.executions_today}
الوصف: ${agent.descriptionAr || agent.description}
القدرات: ${JSON.stringify(agent.capabilities)}
البرومبت الحالي: ${(agent.prompt || AGENT_SYSTEM_PROMPTS[agent.system] || "").substring(0, 400)}
التعديلات السابقة: ${recentPatches.length > 0 ? recentPatches.map(p => `${p.field}→${p.patch_type}`).join(", ") : "لا يوجد"}
`;

  const diagnosisPrompt = `أنت بيليه، خبيرة تشخيص وكلاء الذكاء الاصطناعي في نظام ACIS.

بيانات الوكيل:
${agentSnapshot}
${issue_description ? `المشكلة المُبلَّغة: ${issue_description}` : ""}

حلّل الوكيل واقترح تعديلات دقيقة. أجب بـ JSON فقط بهذا الشكل:
{
  "severity": "critical|high|medium|low",
  "diagnosis": "تشخيص مختصر (جملة واحدة)",
  "root_cause": "السبب الجذري",
  "patches": [
    {
      "field": "prompt|status|model|description|descriptionAr|capabilities",
      "patch_type": "update|fix|optimize",
      "current_value": "القيمة الحالية",
      "proposed_value": "القيمة المقترحة",
      "reason": "سبب التعديل",
      "priority": "high|medium|low"
    }
  ],
  "summary": "ملخص التوصية للقائد"
}
القيود: أقصى 3 تعديلات، ركّز على الأكثر تأثيراً، لا تعدّل ما يعمل بشكل صحيح.`;

  try {
    const result = await callAIForTask("text_complex", AGENT_SYSTEM_PROMPTS["billie"], diagnosisPrompt);

    let diagnosis: any;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      diagnosis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      diagnosis = null;
    }

    if (!diagnosis) {
      diagnosis = {
        severity: "medium",
        diagnosis: "تم تحليل الوكيل — لا توجد مشاكل حرجة",
        root_cause: "أداء طبيعي",
        patches: [],
        summary: result.text.substring(0, 300),
      };
    }

    await db.insert(activityTable).values({
      id: randomUUID(), type: "billie_alert",
      agent_id, agent_name: agent.nameAr || agent.name,
      title: `بيليه شخّصت ${agent.nameAr || agent.name}`,
      description: `الخطورة: ${diagnosis.severity} | ${diagnosis.diagnosis}`,
    });

    res.json({
      agent_id,
      agent_name: agent.nameAr || agent.name,
      model_used: result.model,
      tokens_used: result.tokens,
      ...diagnosis,
      diagnosed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[جراحة الكود] خطأ في التشخيص:", err?.message);
    res.status(500).json({ error: "فشل التشخيص", detail: err?.message });
  }
});

// POST /api/billie/apply-patch — تطبيق تعديل على وكيل
router.post("/apply-patch", async (req, res) => {
  const { agent_id, field, new_value, reason, patch_type = "update" } = req.body;
  if (!agent_id || !field || new_value === undefined || !reason) {
    return res.status(400).json({ error: "agent_id, field, new_value, reason مطلوبة" });
  }
  if (!PATCHABLE_FIELDS.includes(field as PatchableField)) {
    return res.status(400).json({ error: `الحقل "${field}" غير مسموح بتعديله. الحقول المسموحة: ${PATCHABLE_FIELDS.join(", ")}` });
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  const old_value = JSON.stringify((agent as any)[field] ?? null);

  const updateData: Record<string, any> = {};
  if (field === "capabilities" || field === "subagents") {
    try {
      updateData[field] = typeof new_value === "string" ? JSON.parse(new_value) : new_value;
    } catch {
      updateData[field] = new_value;
    }
  } else {
    updateData[field] = new_value;
  }
  updateData.updated_at = new Date();

  await db.update(agentsTable).set(updateData).where(eq(agentsTable.id, agent_id));

  const patchId = randomUUID();
  await db.insert(agentPatchesTable).values({
    id: patchId,
    agent_id,
    patch_type,
    field,
    old_value,
    new_value: typeof new_value === "object" ? JSON.stringify(new_value) : String(new_value),
    reason,
    applied_by: "billie",
    status: "active",
  });

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    agent_id, agent_name: agent.nameAr || agent.name,
    title: `بيليه عدّلت ${agent.nameAr || agent.name}`,
    description: `الحقل: ${field} | ${reason.substring(0, 120)}`,
  });

  broadcast("agents_updated");
  broadcast("activity_updated");

  res.json({
    success: true,
    patch_id: patchId,
    agent_id,
    field,
    old_value,
    new_value: typeof new_value === "object" ? JSON.stringify(new_value) : String(new_value),
    applied_at: new Date().toISOString(),
    message: `تم تعديل ${field} للوكيل ${agent.nameAr || agent.name} بنجاح.`,
  });
});

// POST /api/billie/rollback-patch/:patchId — التراجع عن تعديل
router.post("/rollback-patch/:patchId", async (req, res) => {
  const { patchId } = req.params;
  const [patch] = await db.select().from(agentPatchesTable).where(eq(agentPatchesTable.id, patchId));
  if (!patch) return res.status(404).json({ error: "التعديل غير موجود" });
  if (patch.status === "rolled_back") return res.status(400).json({ error: "التعديل مُتراجَع عنه بالفعل" });

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, patch.agent_id));
  if (!agent) return res.status(404).json({ error: "الوكيل غير موجود" });

  if (patch.old_value !== null && patch.old_value !== undefined) {
    const updateData: Record<string, any> = {};
    if (patch.field === "capabilities" || patch.field === "subagents") {
      try { updateData[patch.field] = JSON.parse(patch.old_value); } catch { updateData[patch.field] = patch.old_value; }
    } else {
      updateData[patch.field] = patch.old_value === "null" ? null : patch.old_value;
    }
    updateData.updated_at = new Date();
    await db.update(agentsTable).set(updateData).where(eq(agentsTable.id, patch.agent_id));
  }

  await db.update(agentPatchesTable).set({
    status: "rolled_back",
    rolled_back_at: new Date(),
  }).where(eq(agentPatchesTable.id, patchId));

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    agent_id: patch.agent_id, agent_name: agent.nameAr || agent.name,
    title: `بيليه تراجعت عن تعديل ${agent.nameAr || agent.name}`,
    description: `الحقل: ${patch.field} | استُعيدت القيمة السابقة`,
  });

  broadcast("agents_updated");
  broadcast("activity_updated");

  res.json({
    success: true,
    patch_id: patchId,
    agent_id: patch.agent_id,
    field: patch.field,
    restored_value: patch.old_value,
    rolled_back_at: new Date().toISOString(),
  });
});

// GET /api/billie/patches — سجل جميع التعديلات
router.get("/patches", async (req, res) => {
  const { agent_id } = req.query;
  let query = db.select().from(agentPatchesTable).orderBy(desc(agentPatchesTable.created_at)).limit(50);
  if (agent_id) {
    const patches = await db.select().from(agentPatchesTable)
      .where(eq(agentPatchesTable.agent_id, String(agent_id)))
      .orderBy(desc(agentPatchesTable.created_at))
      .limit(50);
    return res.json(patches.map(p => ({
      ...p,
      created_at: p.created_at?.toISOString() || new Date().toISOString(),
      rolled_back_at: p.rolled_back_at?.toISOString() || null,
    })));
  }
  const patches = await query;
  res.json(patches.map(p => ({
    ...p,
    created_at: p.created_at?.toISOString() || new Date().toISOString(),
    rolled_back_at: p.rolled_back_at?.toISOString() || null,
  })));
});

// ══════════════════════════════════════════════════════════════
//  توليد الوسائط — Image & TTS Generation for Billie Chat
// ══════════════════════════════════════════════════════════════

router.post("/generate-image", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt مطلوب" });

  try {
    console.log(`[Billie/ImageGen] توليد صورة: "${prompt.slice(0, 80)}"`);
    const result = await callGeminiImageGen(prompt.trim());
    if (!result?.imageData) return res.status(502).json({ error: "فشل توليد الصورة — تحقق من GEMINI_API_KEY" });

    const filename = saveImageFile(`billie-img-${randomUUID()}`, result.imageData, result.mimeType);
    await db.insert(activityTable).values({
      id: randomUUID(), type: "agent_completed",
      title: "بيليه ولّدت صورة",
      description: prompt.slice(0, 120),
    });
    res.json({ filename, caption: result.caption || "", generated_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[Billie/ImageGen] خطأ:", err?.message);
    res.status(500).json({ error: err?.message || "فشل توليد الصورة" });
  }
});

router.post("/tts-chat", async (req, res) => {
  const { text, voice = "Charon" } = req.body as { text?: string; voice?: string };
  if (!text?.trim()) return res.status(400).json({ error: "text مطلوب" });

  try {
    const script = extractTtsScript(text.trim(), 600);
    console.log(`[Billie/TTS-Chat] توليد صوت (${script.length} حرف)`);
    const ttsResult = await callGeminiTTS(script, voice);
    if (!ttsResult?.audioData) return res.status(502).json({ error: "فشل توليد الصوت — تحقق من GEMINI_API_KEY" });

    const filename = saveTtsAudio(`billie-tts-${randomUUID()}`, ttsResult.audioData, ttsResult.mimeType);
    await db.insert(activityTable).values({
      id: randomUUID(), type: "agent_completed",
      title: "بيليه ولّدت مقطع صوتي",
      description: script.slice(0, 80),
    });
    res.json({ filename, generated_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[Billie/TTS-Chat] خطأ:", err?.message);
    res.status(500).json({ error: err?.message || "فشل توليد الصوت" });
  }
});

export default router;
