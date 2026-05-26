import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, generationJobsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const AI_MODELS = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", type: "language", status: "online", arabic_support: true, free_tier: false, cost_per_request: 0.007, avg_latency_ms: 3200, quality_score: 0.96, cinematic_score: 0.94 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", type: "language", status: "online", arabic_support: true, free_tier: true, cost_per_request: 0.002, avg_latency_ms: 1100, quality_score: 0.88, cinematic_score: 0.80 },
  { id: "qwen-72b", name: "Qwen 3.0 72B", provider: "Alibaba", type: "language", status: "online", arabic_support: true, free_tier: true, cost_per_request: 0.002, avg_latency_ms: 1800, quality_score: 0.88, cinematic_score: 0.70 },
  { id: "wan-video-3", name: "Wan Video 3.0", provider: "Alibaba", type: "video", status: "online", arabic_support: false, free_tier: false, cost_per_request: 0.045, avg_latency_ms: 12500, quality_score: 0.92, cinematic_score: 0.90 },
  { id: "flux-pro-ultra", name: "FLUX.1 Pro Ultra", provider: "Black Forest Labs", type: "image", status: "online", arabic_support: false, free_tier: false, cost_per_request: 0.035, avg_latency_ms: 7200, quality_score: 0.93, cinematic_score: 0.90 },
  { id: "flux-schnell", name: "FLUX.1 Schnell", provider: "Black Forest Labs", type: "image", status: "online", arabic_support: false, free_tier: true, cost_per_request: 0.003, avg_latency_ms: 2000, quality_score: 0.82, cinematic_score: 0.78 },
  { id: "kokoro-tts-v2", name: "Kokoro TTS v2.0", provider: "HuggingFace", type: "tts", status: "online", arabic_support: true, free_tier: true, cost_per_request: 0.001, avg_latency_ms: 1500, quality_score: 0.91, cinematic_score: 0.85 },
  { id: "musicgen-3", name: "MusicGen 3.0", provider: "Meta AI", type: "music", status: "online", arabic_support: true, free_tier: true, cost_per_request: 0.002, avg_latency_ms: 8000, quality_score: 0.88, cinematic_score: 0.90 },
  { id: "ace-step", name: "ACE-Step Music", provider: "HuggingFace", type: "music", status: "online", arabic_support: true, free_tier: true, cost_per_request: 0.0, avg_latency_ms: 6000, quality_score: 0.85, cinematic_score: 0.88 },
  { id: "sora-v2", name: "Sora v2", provider: "OpenAI", type: "video", status: "degraded", arabic_support: false, free_tier: false, cost_per_request: 0.12, avg_latency_ms: 45000, quality_score: 0.96, cinematic_score: 0.95 },
  { id: "runway-gen4", name: "Runway Gen-4", provider: "Runway ML", type: "video", status: "online", arabic_support: false, free_tier: false, cost_per_request: 0.055, avg_latency_ms: 15200, quality_score: 0.90, cinematic_score: 0.92 },
  { id: "kling-v2", name: "Kling v2", provider: "Kuaishou", type: "video", status: "online", arabic_support: false, free_tier: false, cost_per_request: 0.048, avg_latency_ms: 14800, quality_score: 0.88, cinematic_score: 0.89 },
  { id: "eleven-multilingual-v3", name: "ElevenLabs Multilingual v3", provider: "ElevenLabs", type: "tts", status: "online", arabic_support: true, free_tier: false, cost_per_request: 0.018, avg_latency_ms: 1500, quality_score: 0.95, cinematic_score: 0.92 },
  { id: "stable-audio-2", name: "Stable Audio 2.0", provider: "Stability AI", type: "audio", status: "online", arabic_support: false, free_tier: true, cost_per_request: 0.004, avg_latency_ms: 5000, quality_score: 0.86, cinematic_score: 0.84 },
];

const PHASE_MODELS: Record<string, string> = {
  script: "gemini-2.5-pro",
  storyboard: "gemini-2.5-pro",
  images: "flux-pro-ultra",
  video: "wan-video-3",
  audio: "kokoro-tts-v2",
  music: "musicgen-3",
  assembly: "ffmpeg",
};

const PHASE_TIMES: Record<string, number> = {
  script: 45,
  storyboard: 60,
  images: 180,
  video: 600,
  audio: 120,
  music: 240,
  assembly: 90,
};

router.get("/projects", async (_req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.created_at));
  res.json(projects.map(p => ({
    ...p,
    created_at: p.created_at?.toISOString() || new Date().toISOString(),
    updated_at: p.updated_at?.toISOString() || new Date().toISOString(),
  })));
});

router.post("/projects", async (req, res) => {
  const { title, story_prompt, type, language, duration_seconds } = req.body;
  const id = randomUUID();

  const [project] = await db.insert(projectsTable).values({
    id,
    title,
    titleAr: language === "ar" || language === "both" ? title : null,
    type,
    status: "concept",
    phase: 1,
    total_phases: 7,
    story_prompt,
    language,
    duration_seconds: duration_seconds || 60,
    scenes_count: 0,
    assets_generated: 0,
  }).returning();

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "project_created",
    title: `New project: ${title}`,
    description: `Type: ${type} | Language: ${language} | Duration: ${duration_seconds}s`,
  });

  res.status(201).json({
    ...project,
    created_at: project.created_at?.toISOString() || new Date().toISOString(),
    updated_at: project.updated_at?.toISOString() || new Date().toISOString(),
  });
});

router.get("/projects/:projectId", async (req, res) => {
  const { projectId } = req.params;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json({
    ...project,
    created_at: project.created_at?.toISOString() || new Date().toISOString(),
    updated_at: project.updated_at?.toISOString() || new Date().toISOString(),
  });
});

router.post("/projects/:projectId/generate", async (req, res) => {
  const { projectId } = req.params;
  const { phase, quality } = req.body;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return res.status(404).json({ error: "Project not found" });

  const jobId = randomUUID();
  const modelId = PHASE_MODELS[phase] || "gemini-2.5-pro";
  const estimatedSeconds = PHASE_TIMES[phase] || 60;

  const phaseOrder = ["script", "storyboard", "images", "video", "audio", "music", "assembly"];
  const phaseIndex = phaseOrder.indexOf(phase) + 1;
  const statusMap: Record<string, string> = {
    script: "scripting",
    storyboard: "storyboard",
    images: "generating",
    video: "generating",
    audio: "generating",
    music: "generating",
    assembly: "post-production",
  };

  const [job] = await db.insert(generationJobsTable).values({
    id: jobId,
    project_id: projectId,
    phase,
    status: "running",
    model_used: modelId,
    estimated_seconds: estimatedSeconds,
  }).returning();

  await db.update(projectsTable).set({
    status: statusMap[phase] || "generating",
    phase: phaseIndex,
    assets_generated: project.assets_generated + Math.floor(Math.random() * 8) + 2,
    updated_at: new Date(),
  }).where(eq(projectsTable.id, projectId));

  await db.insert(activityTable).values({
    id: randomUUID(),
    type: "agent_started",
    title: `Generation started: ${phase}`,
    description: `Project: ${project.title} | Model: ${modelId} | Quality: ${quality}`,
  });

  res.json({
    job_id: jobId,
    phase,
    status: "running",
    model_used: modelId,
    estimated_seconds: estimatedSeconds,
    output_url: null,
    started_at: job.started_at?.toISOString() || new Date().toISOString(),
  });
});

router.get("/models", (_req, res) => {
  const models = AI_MODELS.map(m => ({
    ...m,
    // Add slight random variation to simulate live status
    avg_latency_ms: Math.floor(m.avg_latency_ms * (0.9 + Math.random() * 0.2)),
    status: Math.random() > 0.05 ? m.status : "degraded",
  }));
  res.json(models);
});

export default router;
