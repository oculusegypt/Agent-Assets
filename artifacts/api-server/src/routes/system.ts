import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, agentExecutionsTable, projectsTable, activityTable, systemAlertsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { broadcast } from "../lib/ws.js";
import { callAIForTask } from "../lib/ai.js";

const SERVER_START = Date.now();

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
    ? completed.filter(e => e.duration_ms).reduce((sum, e) => sum + (e.duration_ms || 0), 0) / Math.max(completed.filter(e => e.duration_ms).length, 1)
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
    uptime_hours: Math.round(((Date.now() - SERVER_START) / 3600000) * 10) / 10,
  });
});

router.get("/model-stats", async (_req, res) => {
  const execs = await db.select().from(agentExecutionsTable);

  const map: Record<string, { count: number; tokens: number; latency: number; latencyN: number; success: number; failed: number }> = {};
  for (const e of execs) {
    const m = e.model_used || "unknown";
    if (!map[m]) map[m] = { count: 0, tokens: 0, latency: 0, latencyN: 0, success: 0, failed: 0 };
    map[m].count++;
    map[m].tokens += e.tokens_used || 0;
    if (e.duration_ms) { map[m].latency += e.duration_ms; map[m].latencyN++; }
    if (e.status === "completed") map[m].success++;
    if (e.status === "failed") map[m].failed++;
  }

  const stats = Object.entries(map).map(([model, d]) => ({
    model,
    provider: model.startsWith("gemini") ? "Google" : model.startsWith("qwen") ? "Alibaba" : "أخرى",
    tier: model.includes("pro") || model.includes("max") ? "pro" : "flash",
    executions: d.count,
    tokens_used: d.tokens,
    avg_latency_ms: d.latencyN > 0 ? Math.round(d.latency / d.latencyN) : 0,
    success_rate: d.count > 0 ? Math.round((d.success / d.count) * 100) : 100,
    failed: d.failed,
  })).sort((a, b) => b.executions - a.executions);

  const total = execs.length;
  const geminiCount = execs.filter(e => e.model_used?.startsWith("gemini")).length;
  const qwenCount   = execs.filter(e => e.model_used?.startsWith("qwen")).length;
  const totalTokens = execs.reduce((s, e) => s + (e.tokens_used || 0), 0);

  res.json({ stats, total, gemini_count: geminiCount, qwen_count: qwenCount, total_tokens: totalTokens });
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

router.post("/health-check", async (_req, res) => {
  const agents = await db.select().from(agentsTable);
  const execs = await db.select().from(agentExecutionsTable);
  const alerts = await db.select().from(systemAlertsTable).where(eq(systemAlertsTable.resolved, false));

  const offline = agents.filter(a => a.status === "offline");
  const failed = execs.filter(e => e.status === "failed");
  const online = agents.filter(a => a.status === "online").length;
  const healthScore = Math.min(100, (online / Math.max(agents.length, 1)) * 100);
  const newAlerts: string[] = [];

  if (offline.length > 0) {
    for (const agent of offline.slice(0, 3)) {
      const alertId = randomUUID();
      await db.insert(systemAlertsTable).values({
        id: alertId, severity: "warning",
        agent_id: agent.id,
        title: `وكيل غير متصل: ${agent.nameAr || agent.name}`,
        message: `الوكيل ${agent.nameAr || agent.name} غير متصل ويحتاج إلى مراجعة. آخر نشاط: ${agent.last_active || "غير محدد"}`,
      });
      newAlerts.push(alertId);
    }
  }

  const recentFailed = failed.filter(e => {
    if (!e.created_at) return false;
    const diff = Date.now() - new Date(e.created_at).getTime();
    return diff < 3600000;
  });
  if (recentFailed.length > 3) {
    const alertId = randomUUID();
    await db.insert(systemAlertsTable).values({
      id: alertId, severity: "error",
      title: `معدل فشل مرتفع في التنفيذات`,
      message: `${recentFailed.length} تنفيذ فاشل في آخر ساعة — يرجى مراجعة مفاتيح API والاتصال.`,
    });
    newAlerts.push(alertId);
  }

  if (healthScore < 60) {
    try {
      const aiAlert = await callAIForTask(
        "text_complex",
        "أنتِ بيليه، المشرفة العليا على نظام ACIS. أنتِ خبيرة في رصد صحة الأنظمة وإصدار التحذيرات.",
        `النظام بصحة ${Math.round(healthScore)}% فقط. الوكلاء غير المتصلين: ${offline.map(a => a.nameAr || a.name).join("، ")}.
اكتبي تنبيهاً عاجلاً موجزاً (جملتان) يوضح الخطر ويوصي بإجراء فوري.`
      );
      const alertId = randomUUID();
      await db.insert(systemAlertsTable).values({
        id: alertId, severity: "critical",
        title: `تحذير صحة النظام: ${Math.round(healthScore)}%`,
        message: aiAlert.text,
      });
      newAlerts.push(alertId);
    } catch {}
  }

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    title: "فحص صحة النظام اكتمل",
    description: `الصحة: ${Math.round(healthScore)}% | تنبيهات جديدة: ${newAlerts.length} | الوكلاء: ${online}/${agents.length}`,
  });

  broadcast("alerts_updated");
  broadcast("activity_updated");
  broadcast("metrics_updated");

  res.json({
    health_score: Math.round(healthScore),
    agents_checked: agents.length,
    agents_online: online,
    agents_offline: offline.length,
    new_alerts_created: newAlerts.length,
    alert_ids: newAlerts,
    checked_at: new Date().toISOString(),
  });
});

/* ── Seed all 19 agents to DB ── */
const AGENT_CATALOG = [
  { id:"billie",           name_ar:"بيليه - المشرف الأعلى",         system:"nexus",  model:"gemini-2.5-pro",   color:"text-primary",    icon:"Brain",         capabilities:["مراقبة الوكلاء","تحليل الصحة","تقارير النظام","حل الشكاوى","اتخاذ قرارات استراتيجية"] },
  { id:"acis-master",      name_ar:"منسق ACIS الرئيسي",             system:"acis",   model:"gemini-2.5-pro",   color:"text-cyan-400",   icon:"Film",          capabilities:["تنسيق خط الإنتاج","توزيع المهام","إدارة الأولويات","ضمان الجودة"] },
  { id:"story-architect",  name_ar:"معمار القصة",                   system:"acis",   model:"gemini-2.5-pro",   color:"text-purple-400", icon:"BookOpen",      capabilities:["بناء هياكل سردية","تطوير شخصيات","كتابة حوار","تحليل سيناريو"] },
  { id:"director-agent",   name_ar:"وكيل المخرج",                   system:"acis",   model:"gemini-2.5-pro",   color:"text-orange-400", icon:"Camera",        capabilities:["الأسلوب البصري","تعليمات الكاميرا","حركات الكاميرا","الإيقاع الدرامي"] },
  { id:"cinematic-director",name_ar:"المخرج السينمائي التقني",      system:"acis",   model:"gemini-2.5-flash", color:"text-yellow-400", icon:"Clapperboard",  capabilities:["جداول الإنتاج","اختيار المعدات","خطط الإضاءة","توثيق الإنتاج"] },
  { id:"scene-breakdown",  name_ar:"محلل المشاهد",                  system:"acis",   model:"gemini-2.5-pro",   color:"text-green-400",  icon:"ListChecks",    capabilities:["تفكيك المشاهد","جداول التصوير","متطلبات المشهد","اكتشاف التناقضات"] },
  { id:"emotional-narrative",name_ar:"وكيل السرد العاطفي",          system:"acis",   model:"gemini-2.5-pro",   color:"text-rose-400",   icon:"Heart",         capabilities:["المسار العاطفي","مستوى التوتر","لحظات كاثارسيس","خرائط عاطفية"] },
  { id:"ai-prompt-director",name_ar:"مخرج البرومبت",                system:"acis",   model:"gemini-2.5-pro",   color:"text-violet-400", icon:"Wand2",         capabilities:["برومبت FLUX.1","برومبت Wan Video","برومبت Runway","تقنيات التحسين"] },
  { id:"model-orchestrator",name_ar:"منسق النماذج",                 system:"acis",   model:"gemini-2.5-pro",   color:"text-sky-400",    icon:"GitBranch",     capabilities:["اختيار النموذج الأمثل","مقارنة النتائج","تتبع التكاليف","تحسين الجودة/التكلفة"] },
  { id:"honesty-auditor",  name_ar:"مدقق الصدق",                   system:"acis",   model:"gemini-2.5-pro",   color:"text-emerald-400",icon:"ShieldCheck",   capabilities:["فحص الهلوسات","كشف التحيزات","التحقق من الحقائق","تقارير التدقيق"] },
  { id:"critic-agent",     name_ar:"الناقد الفني",                  system:"acis",   model:"gemini-2.5-pro",   color:"text-amber-400",  icon:"Star",          capabilities:["تقييم السيناريوهات","مقارنة بالمراجع","ملاحظات نقدية","مراجعات احترافية"] },
  { id:"visual-storyboard",name_ar:"مصمم اللوحة المصورة",           system:"acis",   model:"gemini-2.5-pro",   color:"text-pink-400",   icon:"Image",         capabilities:["وصف اللقطات","تسلسل اللقطات","التكوين البصري","mood boards"] },
  { id:"sound-music",      name_ar:"وكيل الصوت والموسيقى",          system:"acis",   model:"gemini-2.5-pro",   color:"text-indigo-400", icon:"Music",         capabilities:["الهوية الموسيقية","توجيهات MusicGen","soundscape","توجيهات TTS"] },
  { id:"gpu-render-workers",name_ar:"منسق وحدات التصيير",           system:"acis",   model:"gemini-2.5-flash", color:"text-slate-400",  icon:"Cpu",           capabilities:["إدارة قوائم الانتظار","تقدير أوقات التوليد","مراقبة الموارد","تقارير الأداء"] },
  { id:"timeline-assembly",name_ar:"منسق الجدول الزمني",            system:"acis",   model:"gemini-2.5-flash", color:"text-teal-400",   icon:"Layers",        capabilities:["تنظيم الأصول","إيقاع المونتاج","نقاط القطع","الجدول الزمني"] },
  { id:"post-production",  name_ar:"مدير ما بعد الإنتاج",           system:"acis",   model:"gemini-2.5-flash", color:"text-fuchsia-400",icon:"Sparkles",      capabilities:["تصحيح الألوان","VFX","المزج الصوتي","تصدير الملفات"] },
  { id:"stv-master",       name_ar:"منسق القصة إلى الرؤية",         system:"acis",   model:"gemini-2.5-pro",   color:"text-lime-400",   icon:"Layers",        capabilities:["تحويل النص إلى مرئي","تنسيق التسلسل","ضمان التماسك البصري","إدارة مشاريع متعددة"] },
  { id:"nexus-master",     name_ar:"منسق نظام NEXUS",               system:"nexus",  model:"gemini-2.5-pro",   color:"text-cyan-400",   icon:"Building2",     capabilities:["تنسيق 10 وكلاء مكتبية","تحليل الطلبات","إدارة الأولويات","تقارير إنتاجية"] },
  { id:"caeos-master",     name_ar:"المنسق الأعلى لنظام CAEOS",     system:"caeos",  model:"gemini-2.5-pro",   color:"text-orange-400", icon:"Scale",         capabilities:["الفحص الأخلاقي","تقارير الامتثال","نقاط الضعف","حوكمة الذكاء الاصطناعي"] },
];

router.post("/seed-agents", async (_req, res) => {
  let seeded = 0;
  let updated = 0;
  for (const a of AGENT_CATALOG) {
    try {
      const existing = await db.select({ id: agentsTable.id }).from(agentsTable).where(eq(agentsTable.id, a.id));
      if (existing.length === 0) {
        await db.insert(agentsTable).values({
          id: a.id, name: a.id, nameAr: a.name_ar, system: a.system,
          description: a.name_ar, descriptionAr: a.name_ar,
          status: "online", model: a.model, capabilities: a.capabilities,
          subagents: [], icon: a.icon, color: a.color, prompt: a.id,
          executions_today: 0, success_rate: 100, avg_response_ms: 1200,
        });
        seeded++;
      } else {
        await db.update(agentsTable).set({
          nameAr: a.name_ar, status: "online", model: a.model,
          capabilities: a.capabilities, updated_at: new Date(),
        }).where(eq(agentsTable.id, a.id));
        updated++;
      }
    } catch {}
  }

  await db.insert(activityTable).values({
    id: randomUUID(), type: "system_update",
    title: "تهيئة الوكلاء اكتملت",
    description: `زُرع ${seeded} وكيل جديد · حُدِّث ${updated} وكيل · الإجمالي ${AGENT_CATALOG.length} وكيل`,
  });

  broadcast("agents_updated");
  broadcast("activity_updated");
  broadcast("metrics_updated");

  res.json({ success: true, seeded, updated, total: AGENT_CATALOG.length });
});

export default router;
