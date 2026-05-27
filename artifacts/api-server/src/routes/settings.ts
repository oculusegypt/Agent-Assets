import { Router } from "express";
import { db } from "@workspace/db";
import {
  systemSettingsTable, agentsTable, agentExecutionsTable,
  conversationsTable, messagesTable, activityTable,
  systemAlertsTable, complaintsTable, nexusTasksTable,
  projectsTable,
} from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const router = Router();

const DEFAULT_SETTINGS: Array<{
  key: string; value: string; category: string; description: string;
}> = [
  { key: "ai.primary_model", value: "gemini-2.5-flash", category: "ai", description: "النموذج الأساسي للذكاء الاصطناعي" },
  { key: "ai.pro_model", value: "gemini-2.5-pro", category: "ai", description: "النموذج المتقدم للمهام المعقدة" },
  { key: "ai.max_tokens", value: "8192", category: "ai", description: "الحد الأقصى للرموز في كل استجابة" },
  { key: "ai.temperature", value: "0.7", category: "ai", description: "درجة الإبداع (0 = دقيق، 1 = إبداعي)" },
  { key: "ai.language_routing", value: "true", category: "ai", description: "توجيه العربية لـ Qwen والإنجليزية لـ Gemini" },
  { key: "ai.fallback_on_error", value: "true", category: "ai", description: "إرسال رسالة خطأ عربية عند فشل النموذج" },
  { key: "ai.qwen_model", value: "qwen-max", category: "ai", description: "نموذج Qwen الافتراضي — أعلى جودة" },
  { key: "ai.qwen_flash_model", value: "qwen-plus", category: "ai", description: "نموذج Qwen السريع للمهام الخفيفة" },
  { key: "billie.auto_analyze", value: "false", category: "billie", description: "تحليل تلقائي دوري للنظام" },
  { key: "billie.analysis_interval_minutes", value: "60", category: "billie", description: "الفترة بين التحليلات التلقائية بالدقائق" },
  { key: "billie.alert_threshold_critical", value: "3", category: "billie", description: "عدد التنبيهات الذي يُشغّل حالة الطوارئ" },
  { key: "billie.news_count", value: "10", category: "billie", description: "عدد أخبار الذكاء الاصطناعي المعروضة" },
  { key: "billie.auto_resolve_low", value: "false", category: "billie", description: "حل التنبيهات المنخفضة تلقائياً" },
  { key: "system.health_warning_threshold", value: "70", category: "system", description: "درجة الصحة التي تُظهر تحذيراً" },
  { key: "system.health_critical_threshold", value: "50", category: "system", description: "درجة الصحة الحرجة" },
  { key: "system.activity_retention_days", value: "30", category: "system", description: "أيام الاحتفاظ بسجلات النشاط" },
  { key: "system.max_concurrent_agents", value: "10", category: "system", description: "الحد الأقصى للوكلاء المتزامنين" },
  { key: "system.execution_timeout_seconds", value: "120", category: "system", description: "مهلة تنفيذ الوكيل بالثواني" },
  { key: "production.default_language", value: "ar", category: "production", description: "لغة الإنتاج الافتراضية" },
  { key: "production.default_duration_seconds", value: "60", category: "production", description: "مدة المشروع الافتراضية بالثواني" },
  { key: "production.auto_generate_prompts", value: "true", category: "production", description: "توليد برومبت تلقائياً بعد كتابة السيناريو" },
  { key: "production.quality_threshold", value: "85", category: "production", description: "حد الجودة المقبول للمخرجات (0-100)" },
  { key: "nexus.auto_assign", value: "true", category: "nexus", description: "تعيين الوكيل المناسب تلقائياً" },
  { key: "nexus.max_task_duration_minutes", value: "30", category: "nexus", description: "أقصى مدة للمهمة بالدقائق" },
  { key: "nexus.priority_escalation", value: "true", category: "nexus", description: "رفع الأولوية تلقائياً للمهام المتأخرة" },
  { key: "conversations.max_history", value: "20", category: "conversations", description: "أقصى عدد رسائل في السياق التاريخي" },
  { key: "conversations.auto_title", value: "true", category: "conversations", description: "توليد عنوان تلقائي للمحادثة" },
  { key: "ui.language", value: "ar", category: "ui", description: "لغة الواجهة الافتراضية" },
  { key: "ui.theme", value: "dark", category: "ui", description: "المظهر الافتراضي" },
  { key: "ui.animations", value: "true", category: "ui", description: "تفعيل الحركات والانتقالات" },
  { key: "ui.sidebar_compact", value: "false", category: "ui", description: "الشريط الجانبي المضغوط" },
  { key: "ui.refresh_interval_seconds", value: "30", category: "ui", description: "معدل تحديث البيانات تلقائياً" },
];

async function ensureDefaults() {
  for (const s of DEFAULT_SETTINGS) {
    await db.insert(systemSettingsTable).values(s).onConflictDoNothing();
  }
}

router.get("/", async (_req, res) => {
  await ensureDefaults();
  const settings = await db.select().from(systemSettingsTable).orderBy(systemSettingsTable.category, systemSettingsTable.key);
  const grouped: Record<string, any[]> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }
  res.json({ settings, grouped, total: settings.length });
});

router.put("/", async (req, res) => {
  const updates: Record<string, string> = req.body;
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value !== "string") continue;
    const [updated] = await db.update(systemSettingsTable)
      .set({ value, updated_at: new Date() })
      .where(eq(systemSettingsTable.key, key))
      .returning();
    if (updated) results.push(updated);
    else {
      const found = DEFAULT_SETTINGS.find(d => d.key === key);
      const [inserted] = await db.insert(systemSettingsTable)
        .values({ key, value, category: found?.category || "general", description: found?.description })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value, updated_at: new Date() } })
        .returning();
      results.push(inserted);
    }
  }
  res.json({ updated: results.length, settings: results });
});

router.post("/reset", async (_req, res) => {
  for (const s of DEFAULT_SETTINGS) {
    await db.update(systemSettingsTable)
      .set({ value: s.value, updated_at: new Date() })
      .where(eq(systemSettingsTable.key, s.key));
  }
  res.json({ success: true, message: "تمت إعادة ضبط جميع الإعدادات للقيم الافتراضية" });
});

router.get("/api-keys", async (_req, res) => {
  const { getKeyStatus } = await import("../lib/ai.js");
  const status = await getKeyStatus();
  res.json(status);
});

router.put("/api-keys", async (req, res) => {
  const { gemini, alibaba, alibaba_base } = req.body as { gemini?: string; alibaba?: string; alibaba_base?: string };
  const saved: string[] = [];

  if (gemini !== undefined) {
    if (gemini.trim()) {
      await db.insert(systemSettingsTable)
        .values({ key: "api_key.gemini", value: gemini.trim(), category: "api_keys", description: "Gemini API Key (stored in DB)" })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: gemini.trim(), updated_at: new Date() } });
      saved.push("gemini");
    } else {
      await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, "api_key.gemini"));
      saved.push("gemini (cleared)");
    }
  }

  if (alibaba !== undefined) {
    if (alibaba.trim()) {
      await db.insert(systemSettingsTable)
        .values({ key: "api_key.alibaba", value: alibaba.trim(), category: "api_keys", description: "Alibaba API Key (stored in DB)" })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: alibaba.trim(), updated_at: new Date() } });
      saved.push("alibaba");
    } else {
      await db.delete(systemSettingsTable).where(eq(systemSettingsTable.key, "api_key.alibaba"));
      saved.push("alibaba (cleared)");
    }
  }

  if (alibaba_base !== undefined) {
    const base = alibaba_base.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    await db.insert(systemSettingsTable)
      .values({ key: "api_base.alibaba", value: base, category: "api_keys", description: "Alibaba custom MaaS endpoint" })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: base, updated_at: new Date() } });
    saved.push("alibaba_base");
  }

  res.json({ success: true, saved });
});

router.post("/test-ai", async (req, res) => {
  const { provider } = req.body;
  const start = Date.now();
  const { getGeminiKey, getAlibabaKey } = await import("../lib/ai.js");

  if (provider === "gemini") {
    const key = await getGeminiKey();
    if (!key) return res.json({ success: false, error: "GEMINI_API_KEY غير مضبوط في البيئة أو قاعدة البيانات", latency_ms: 0 });
    try {
      const g = new GoogleGenerativeAI(key);
      const m = g.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const r = await m.generateContent({ contents: [{ role: "user", parts: [{ text: "قل: متصل" }] }] });
      const text = r.response.text();
      return res.json({ success: true, response: text.substring(0, 100), latency_ms: Date.now() - start, model: "gemini-2.5-flash-lite" });
    } catch (e: any) {
      return res.json({ success: false, error: e?.message || "خطأ غير معروف", latency_ms: Date.now() - start });
    }
  }

  if (provider === "qwen") {
    const { getAlibabaKey, getAlibabaBase } = await import("../lib/ai.js");
    const key = await getAlibabaKey();
    if (!key) return res.json({ success: false, error: "ALIBABA_API_KEY غير مضبوط في البيئة أو قاعدة البيانات", latency_ms: 0 });
    const baseURL = await getAlibabaBase();
    // Try qwen3-max-2026-01-23 first (primary model), fallback to qwen-turbo
    const modelsToTry = ["qwen3-max-2026-01-23", "qwen3.5-flash", "qwen-turbo"];
    for (const modelName of modelsToTry) {
      try {
        const q = new OpenAI({ apiKey: key, baseURL });
        const r = await q.chat.completions.create({ model: modelName, messages: [{ role: "user", content: "قل: متصل ✓" }], max_tokens: 20 });
        const text = r.choices[0]?.message?.content || "";
        return res.json({ success: true, response: text.substring(0, 100), latency_ms: Date.now() - start, model: modelName, endpoint: baseURL });
      } catch (e: any) {
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          return res.json({ success: false, error: e?.message || "خطأ غير معروف", latency_ms: Date.now() - start, tried_models: modelsToTry });
        }
      }
    }
  }

  res.status(400).json({ error: "مزود غير مدعوع. استخدم: gemini أو qwen" });
});

/* ─── Model Stats (Quota Tracking) ─────────────────────────── */

router.get("/ai-models", async (_req, res) => {
  const { TASK_MODEL_CONFIG, AGENT_TASK_MAP, MODEL_INITIAL_QUOTAS } = await import("../lib/ai.js");

  // Aggregate token usage per model from agent_executions
  const usageRows = await db.execute(
    sql`SELECT model_used, SUM(tokens_used)::int AS total_tokens, COUNT(*)::int AS calls
        FROM agent_executions
        WHERE model_used IS NOT NULL AND tokens_used IS NOT NULL AND tokens_used > 0
        GROUP BY model_used`
  );
  const usageByModel: Record<string, { tokens: number; calls: number }> = {};
  for (const row of usageRows.rows as any[]) {
    usageByModel[row.model_used] = { tokens: Number(row.total_tokens || 0), calls: Number(row.calls || 0) };
  }

  // Build model stats list
  const modelSet = new Set<string>();
  for (const cfg of Object.values(TASK_MODEL_CONFIG)) {
    modelSet.add(cfg.primary);
    modelSet.add(cfg.fallback);
  }
  // Also include models from quota map
  for (const m of Object.keys(MODEL_INITIAL_QUOTAS)) modelSet.add(m);

  const tasksByModel: Record<string, string[]> = {};
  for (const [taskType, cfg] of Object.entries(TASK_MODEL_CONFIG)) {
    if (!tasksByModel[cfg.primary]) tasksByModel[cfg.primary] = [];
    tasksByModel[cfg.primary].push(taskType);
  }
  const agentsByModel: Record<string, string[]> = {};
  for (const [agentId, taskType] of Object.entries(AGENT_TASK_MAP)) {
    const cfg = TASK_MODEL_CONFIG[taskType as keyof typeof TASK_MODEL_CONFIG];
    if (cfg) {
      if (!agentsByModel[cfg.primary]) agentsByModel[cfg.primary] = [];
      agentsByModel[cfg.primary].push(agentId);
    }
  }

  const models = Array.from(modelSet).map(modelId => {
    const quota = MODEL_INITIAL_QUOTAS[modelId] ?? 0;
    const used  = usageByModel[modelId]?.tokens ?? 0;
    const calls = usageByModel[modelId]?.calls  ?? 0;
    const remaining = Math.max(0, quota - used);
    const pctUsed = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
    const provider = modelId.startsWith("gemini") ? "gemini" : "qwen";
    const cfg = Object.values(TASK_MODEL_CONFIG).find(c => c.primary === modelId || c.fallback === modelId);
    return {
      id: modelId,
      provider,
      nameAr: cfg?.nameAr ?? modelId,
      category: cfg?.category ?? (modelId.includes("coder") ? "برمجة" : modelId.includes("vl") ? "رؤية" : modelId.includes("mt") ? "ترجمة" : modelId.includes("qwq") || modelId.includes("thinking") ? "استدلال" : "نص"),
      quota,
      used,
      remaining,
      pctUsed: Math.round(pctUsed * 10) / 10,
      calls,
      tasks: tasksByModel[modelId] ?? [],
      agents: agentsByModel[modelId] ?? [],
      isPrimary: Object.values(TASK_MODEL_CONFIG).some(c => c.primary === modelId),
    };
  });

  // Sort: primary models first, then by provider, then by quota size
  models.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.provider !== b.provider) return a.provider === "qwen" ? -1 : 1;
    return b.quota - a.quota;
  });

  res.json({ models, total_models: models.length });
});

router.post("/ai-models/seed-quotas", async (_req, res) => {
  // Update Alibaba base to DashScope (fix MaaS 404 issues)
  await db.insert(systemSettingsTable)
    .values({
      key: "api_base.alibaba",
      value: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      category: "api_keys",
      description: "Alibaba DashScope endpoint (standard — supports all Qwen models)",
    })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: "https://dashscope.aliyuncs.com/compatible-mode/v1", updated_at: new Date() },
    });

  res.json({ success: true, message: "تم تحديث endpoint إلى DashScope القياسي" });
});

router.get("/db-stats", async (_req, res) => {
  const [agents, execs, convs, msgs, alerts, complaints, tasks, projects, activity, settings] = await Promise.all([
    db.select({ count: count() }).from(agentsTable),
    db.select({ count: count() }).from(agentExecutionsTable),
    db.select({ count: count() }).from(conversationsTable),
    db.select({ count: count() }).from(messagesTable),
    db.select({ count: count() }).from(systemAlertsTable),
    db.select({ count: count() }).from(complaintsTable),
    db.select({ count: count() }).from(nexusTasksTable),
    db.select({ count: count() }).from(projectsTable),
    db.select({ count: count() }).from(activityTable),
    db.select({ count: count() }).from(systemSettingsTable),
  ]);

  const tables = [
    { name: "agents", nameAr: "الوكلاء", count: agents[0]?.count ?? 0, icon: "🤖" },
    { name: "agent_executions", nameAr: "تنفيذات الوكلاء", count: execs[0]?.count ?? 0, icon: "⚡" },
    { name: "conversations", nameAr: "المحادثات", count: convs[0]?.count ?? 0, icon: "💬" },
    { name: "messages", nameAr: "الرسائل", count: msgs[0]?.count ?? 0, icon: "📨" },
    { name: "system_alerts", nameAr: "التنبيهات", count: alerts[0]?.count ?? 0, icon: "🔔" },
    { name: "complaints", nameAr: "الشكاوى", count: complaints[0]?.count ?? 0, icon: "📋" },
    { name: "nexus_tasks", nameAr: "مهام NEXUS", count: tasks[0]?.count ?? 0, icon: "📁" },
    { name: "projects", nameAr: "المشاريع", count: projects[0]?.count ?? 0, icon: "🎬" },
    { name: "activity", nameAr: "سجل النشاط", count: activity[0]?.count ?? 0, icon: "📊" },
    { name: "system_settings", nameAr: "الإعدادات", count: settings[0]?.count ?? 0, icon: "⚙️" },
  ];

  const total = tables.reduce((s, t) => s + Number(t.count), 0);
  res.json({ tables, total_records: total });
});

router.delete("/db-clear/:table", async (req, res) => {
  const { table } = req.params;
  const allowed: Record<string, any> = {
    activity: activityTable,
    agent_executions: agentExecutionsTable,
    system_alerts: systemAlertsTable,
    complaints: complaintsTable,
    nexus_tasks: nexusTasksTable,
  };
  if (!allowed[table]) {
    return res.status(400).json({ error: `الجدول "${table}" غير مسموح بحذفه` });
  }
  await db.delete(allowed[table]);
  res.json({ success: true, message: `تم مسح جدول "${table}" بنجاح` });
});

router.put("/agent/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const { status, model, prompt, nameAr, descriptionAr, capabilities } = req.body;

  const updates: any = { updated_at: new Date() };
  if (status !== undefined) updates.status = status;
  if (model !== undefined) updates.model = model;
  if (prompt !== undefined) updates.prompt = prompt;
  if (nameAr !== undefined) updates.nameAr = nameAr;
  if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;
  if (capabilities !== undefined) updates.capabilities = capabilities;

  const [updated] = await db.update(agentsTable).set(updates).where(eq(agentsTable.id, agentId)).returning();
  if (!updated) return res.status(404).json({ error: "الوكيل غير موجود" });
  res.json(updated);
});

export default router;
