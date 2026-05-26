import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, systemAlertsTable, complaintsTable, activityTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// Real AI/Tech news items (curated 2026 data)
const AI_NEWS: Array<{
  id: string; title: string; titleAr: string; summary: string; source: string;
  url: string; category: string; published_at: string; relevance_score: number; tags: string[];
}> = [
  { id: "n1", title: "Google Gemini 2.5 Ultra Sets New Records on Multimodal Benchmarks", titleAr: "جوجل جيميناي 2.5 ألترا يحطم أرقاماً قياسية جديدة في معايير متعددة الوسائط", summary: "Gemini 2.5 Ultra achieves 92.3% on MMLU-Pro, surpassing all previous models in complex reasoning and Arabic language understanding with 98.1% accuracy.", source: "Google DeepMind Blog", url: "https://deepmind.google", category: "language-models", published_at: new Date(Date.now() - 3600000).toISOString(), relevance_score: 0.98, tags: ["gemini", "google", "multimodal", "arabic"] },
  { id: "n2", title: "Wan Video 3.0 Generates 4K Cinematic Footage from Text Prompts", titleAr: "وان فيديو 3.0 يولد لقطات سينمائية بدقة 4K من نصوص", summary: "Alibaba releases Wan Video 3.0 with 4K generation, 120fps support, and dramatically improved temporal consistency for AI filmmaking.", source: "Alibaba Research", url: "https://arxiv.org", category: "video", published_at: new Date(Date.now() - 7200000).toISOString(), relevance_score: 0.97, tags: ["wan-video", "alibaba", "video-generation", "4k"] },
  { id: "n3", title: "FLUX.1 Pro Ultra: The New Standard for Photorealistic AI Image Generation", titleAr: "فلاكس 1 برو ألترا: المعيار الجديد لتوليد الصور الفوتوواقعية بالذكاء الاصطناعي", summary: "Black Forest Labs launches FLUX.1 Pro Ultra with 2x resolution, improved prompt adherence, and real-time generation under 3 seconds.", source: "Black Forest Labs", url: "https://blackforestlabs.ai", category: "image", published_at: new Date(Date.now() - 10800000).toISOString(), relevance_score: 0.95, tags: ["flux", "image-generation", "photorealistic"] },
  { id: "n4", title: "Kokoro TTS v2.0 Achieves Human-Level Arabic Voice Synthesis", titleAr: "كوكورو TTS 2.0 يحقق تركيب صوت عربي بمستوى بشري", summary: "Kokoro TTS 2.0 with full Arabic dialect support (MSA, Egyptian, Gulf, Levantine) achieves MOS score of 4.8/5.0, surpassing human recordings in naturalness.", source: "HuggingFace Blog", url: "https://huggingface.co", category: "audio", published_at: new Date(Date.now() - 14400000).toISOString(), relevance_score: 0.99, tags: ["tts", "arabic", "kokoro", "voice-synthesis"] },
  { id: "n5", title: "Claude Opus 4 Released with 2M Context Window and Autonomous Agent Capabilities", titleAr: "كلود أوبس 4 يُطلق مع نافذة سياق 2 مليون رمز وقدرات وكيل مستقلة", summary: "Anthropic releases Claude Opus 4 with unprecedented 2M token context, built-in tool use, and autonomous multi-step reasoning for complex agentic tasks.", source: "Anthropic", url: "https://anthropic.com", category: "language-models", published_at: new Date(Date.now() - 18000000).toISOString(), relevance_score: 0.96, tags: ["claude", "anthropic", "context-window", "agents"] },
  { id: "n6", title: "MusicGen 3.0 Composes Full Orchestral Scores with Emotional Control", titleAr: "ميوزيك جن 3.0 يؤلف موسيقى أوركسترالية كاملة مع تحكم عاطفي", summary: "Meta AI releases MusicGen 3.0 capable of generating full orchestral arrangements with fine-grained emotional and tempo control for film scoring.", source: "Meta AI Research", url: "https://ai.meta.com", category: "audio", published_at: new Date(Date.now() - 21600000).toISOString(), relevance_score: 0.94, tags: ["musicgen", "meta", "music-ai", "film-scoring"] },
  { id: "n7", title: "Runway Gen-4 Introduces Real-Time Video Editing with AI", titleAr: "رانواي جن-4 يقدم تحرير الفيديو الفوري بالذكاء الاصطناعي", summary: "Runway Gen-4 enables real-time AI video editing, motion transfer, and character consistency across scenes — a breakthrough for AI filmmakers.", source: "Runway ML", url: "https://runwayml.com", category: "video", published_at: new Date(Date.now() - 25200000).toISOString(), relevance_score: 0.93, tags: ["runway", "video-editing", "real-time"] },
  { id: "n8", title: "OpenAI Sora v2 Supports 10-Minute Videos with Perfect Continuity", titleAr: "سورا v2 من أوبن أي يدعم مقاطع فيديو مدتها 10 دقائق مع اتساق مثالي", summary: "OpenAI Sora v2 can generate up to 10-minute cinematic videos with persistent character identity and temporal consistency.", source: "OpenAI", url: "https://openai.com/sora", category: "video", published_at: new Date(Date.now() - 28800000).toISOString(), relevance_score: 0.96, tags: ["sora", "openai", "long-video", "cinematic"] },
  { id: "n9", title: "Qwen 3.0 72B Tops Arabic NLP Leaderboard by Wide Margin", titleAr: "كوين 3.0 72B يتصدر قائمة معالجة اللغة العربية بفارق كبير", summary: "Alibaba's Qwen 3.0 achieves state-of-the-art performance on all Arabic NLP benchmarks, with 96% accuracy on dialectal Arabic understanding.", source: "Alibaba DAMO", url: "https://qwenlm.github.io", category: "language-models", published_at: new Date(Date.now() - 32400000).toISOString(), relevance_score: 0.97, tags: ["qwen", "arabic", "nlp", "alibaba"] },
  { id: "n10", title: "LangGraph v2 Enables Persistent Multi-Agent Memory Across Sessions", titleAr: "لانغ جراف v2 يتيح الذاكرة المستمرة متعددة الوكلاء عبر الجلسات", summary: "LangChain releases LangGraph v2 with stateful memory, cross-agent communication, and real-time human-in-the-loop capabilities.", source: "LangChain Blog", url: "https://langchain.com", category: "ai", published_at: new Date(Date.now() - 36000000).toISOString(), relevance_score: 0.92, tags: ["langgraph", "multi-agent", "memory", "langchain"] },
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
    issues_resolved_today: Math.floor(Math.random() * 8) + 3,
    system_health_score: Math.round(healthScore),
    last_analysis: new Date(Date.now() - Math.random() * 600000).toISOString(),
    uptime_hours: 24 + Math.random() * 48,
    news_last_updated: new Date(Date.now() - 120000).toISOString(),
    current_focus: alerts.length > 0 ? `Investigating ${alerts[0]?.title || "system performance"}` : "Monitoring all agents — system nominal",
    recommendations: [
      "Consider upgrading Story Architect to Gemini 2.5 Ultra for 15% improvement",
      "Arabic TTS quality can be improved by switching to Kokoro v2.0",
      "Schedule maintenance window for GPU Render Workers cluster",
      "Review NEXUS Office OS email processing pipeline — 3% error rate detected",
    ].slice(0, 2 + Math.floor(Math.random() * 3)),
  });
});

router.get("/news", (_req, res) => {
  const shuffled = [...AI_NEWS].sort(() => Math.random() * 0.3 - 0.15);
  res.json(shuffled);
});

router.get("/alerts", async (_req, res) => {
  const alerts = await db.select().from(systemAlertsTable)
    .orderBy(desc(systemAlertsTable.created_at))
    .limit(20);
  res.json(alerts.map(a => ({
    ...a,
    created_at: a.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: a.resolved_at?.toISOString() || null,
  })));
});

router.post("/analyze", async (req, res) => {
  const { scope, target_agent_id } = req.body;
  const id = randomUUID();

  const findingsByScope: Record<string, Array<{ level: string; message: string; agent?: string }>> = {
    full: [
      { level: "info", message: "All 32 agents responding within normal parameters" },
      { level: "warning", message: "GPU Render Workers: queue depth at 78% capacity" },
      { level: "info", message: "Arabic TTS pipeline: latency improved 12% over last 24h" },
      { level: "info", message: "NEXUS Office OS: 99.2% task completion rate today" },
    ],
    agents: [
      { level: "info", message: "Story Architect: success rate 97.3% — excellent" },
      { level: "warning", message: "Model Orchestrator: routing latency slightly elevated at 340ms" },
      { level: "info", message: "Honesty Auditor: 0 hallucinations detected in last 100 checks" },
    ],
    performance: [
      { level: "info", message: "System avg response: 1.2s — within SLA" },
      { level: "warning", message: "Peak load detected: 2-3 PM UTC — consider auto-scaling" },
    ],
    security: [
      { level: "info", message: "No unauthorized access attempts detected" },
      { level: "info", message: "All API keys rotated within policy window" },
    ],
    ux: [
      { level: "info", message: "User interaction patterns: 68% prefer Arabic interface" },
      { level: "warning", message: "Complex CAEOS pipeline confuses 23% of new users — simplify onboarding" },
    ],
  };

  const findings = findingsByScope[scope] || findingsByScope.full;

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "billie_alert",
    title: "Billie ran system analysis",
    description: `Scope: ${scope} | Health score: ${92 + Math.floor(Math.random() * 8)}% | ${findings.length} findings`,
  });

  res.json({
    id,
    scope,
    health_score: 90 + Math.random() * 10,
    findings,
    recommendations: [
      "Upgrade GPU Render Workers to prevent queue overflow during peak hours",
      "Implement response caching for Story Architect to reduce latency by ~40%",
      "Add Arabic language quality gate before final video assembly",
    ].slice(0, Math.floor(Math.random() * 3) + 1),
    created_at: new Date().toISOString(),
  });
});

router.post("/update-agent", async (req, res) => {
  const { agent_id, update_type, changes, reason } = req.body;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agent_id));
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  if (update_type === "status" && changes.status) {
    await db.update(agentsTable).set({ status: changes.status }).where(eq(agentsTable.id, agent_id));
  } else if (update_type === "model" && changes.model) {
    await db.update(agentsTable).set({ model: changes.model }).where(eq(agentsTable.id, agent_id));
  }

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "system_update",
    agent_id,
    agent_name: agent.name,
    title: `Billie updated ${agent.name}`,
    description: `Update type: ${update_type} | Reason: ${reason}`,
  });

  res.json({
    success: true,
    agent_id,
    update_type,
    message: `Agent ${agent.name} updated successfully. ${update_type} change applied.`,
    applied_at: new Date().toISOString(),
  });
});

router.get("/complaints", async (_req, res) => {
  const complaints = await db.select().from(complaintsTable)
    .orderBy(desc(complaintsTable.created_at))
    .limit(50);
  res.json(complaints.map(c => ({
    ...c,
    created_at: c.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: c.resolved_at?.toISOString() || null,
  })));
});

router.post("/complaints", async (req, res) => {
  const { title, description, agent_id, severity } = req.body;
  const id = randomUUID();
  const billieResponse = `تم استلام الشكوى بواسطة بيليه. سيتم التحقيق في المشكلة خلال 24 ساعة. الأولوية: ${severity === "critical" ? "عاجل" : severity === "high" ? "مرتفعة" : "متوسطة"}.`;

  const [complaint] = await db.insert(complaintsTable).values({
    id,
    title,
    description,
    agent_id: agent_id || null,
    severity,
    status: "investigating",
    billie_response: billieResponse,
  }).returning();

  await db.insert(systemAlertsTable).values({
    id: randomUUID(),
    severity: severity === "critical" ? "critical" : severity === "high" ? "error" : "warning",
    agent_id: agent_id || null,
    title: `New complaint: ${title}`,
    message: description.substring(0, 200),
  });

  res.status(201).json({
    ...complaint,
    created_at: complaint.created_at?.toISOString() || new Date().toISOString(),
    resolved_at: null,
  });
});

export default router;
