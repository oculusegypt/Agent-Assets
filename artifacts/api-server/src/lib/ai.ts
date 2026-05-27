import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/* ─── Key Resolution ──────────────────────────────────────────── */

async function getDbSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key));
    return rows[0]?.value || null;
  } catch { return null; }
}

export async function getGeminiKey(): Promise<string | null> {
  return process.env.GEMINI_API_KEY || await getDbSetting("api_key.gemini") || null;
}

export async function getAlibabaKey(): Promise<string | null> {
  return process.env.ALIBABA_API_KEY || await getDbSetting("api_key.alibaba") || null;
}

export async function getAlibabaBase(): Promise<string> {
  return (
    process.env.ALIBABA_API_BASE ||
    await getDbSetting("api_base.alibaba") ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  );
}

async function buildGemini(): Promise<GoogleGenerativeAI | null> {
  const key = await getGeminiKey();
  return key ? new GoogleGenerativeAI(key) : null;
}

async function buildQwen(): Promise<OpenAI | null> {
  const key = await getAlibabaKey();
  if (!key) return null;
  const baseURL = await getAlibabaBase();
  return new OpenAI({ apiKey: key, baseURL });
}

/* ─── Task-Type System ────────────────────────────────────────── */

/**
 * TaskType maps every job to the best available model.
 *
 * Routing strategy:
 *  - ALL text/code/vision/reasoning/translation → Qwen (primary)
 *  - Arabic TTS / audio → Gemini (Gemini is genuinely best here)
 *  - Gemini gemini-2.5-flash-lite = global last-resort fallback only
 */
export type TaskType =
  | "text_simple"      // monitoring, status, short answers
  | "text_complex"     // billie supervision, analysis, long Arabic
  | "text_creative"    // story, screenplay, dialog, poetry
  | "code"             // prompt engineering, code generation
  | "code_fast"        // fast scripts, structured output
  | "vision"           // image analysis, storyboard description
  | "translate"        // Arabic ↔ English translation
  | "reasoning"        // deep analysis, auditing, fact-checking
  | "orchestration"    // agent coordination, planning
  | "audio_ar";        // Arabic TTS — Gemini only

export interface TaskModelConfig {
  primary: string;
  fallback: string;
  provider: "qwen" | "gemini";
  nameAr: string;
  description: string;
  category: string;
}

export const TASK_MODEL_CONFIG: Record<TaskType, TaskModelConfig> = {
  text_simple:   {
    primary: "qwen3.5-flash",
    fallback: "qwen-flash",
    provider: "qwen",
    nameAr: "Qwen 3.5 Flash",
    description: "المهام السريعة، المراقبة، الحالة",
    category: "نص سريع",
  },
  text_complex:  {
    primary: "qwen3-max-2026-01-23",
    fallback: "qwen3.7-max",
    provider: "qwen",
    nameAr: "Qwen 3 Max 2026",
    description: "التحليل المعقد، الإشراف، التقارير العميقة",
    category: "نص متقدم",
  },
  text_creative: {
    primary: "qwen3-max-2026-01-23",
    fallback: "qwen3.5-397b-a17b",
    provider: "qwen",
    nameAr: "Qwen 3 Max 2026",
    description: "الكتابة الإبداعية، القصص، الحوار السينمائي",
    category: "إبداعي",
  },
  code: {
    primary: "qwen3-coder-480b-a35b-instruct",
    fallback: "qwen3-coder-plus",
    provider: "qwen",
    nameAr: "Qwen3 Coder 480B",
    description: "توليد الكود، هندسة البرومبت، النصوص التقنية",
    category: "برمجة",
  },
  code_fast: {
    primary: "qwen3-coder-flash",
    fallback: "deepseek-v4-flash",
    provider: "qwen",
    nameAr: "Qwen3 Coder Flash",
    description: "البرمجة السريعة، المخرجات المنظمة",
    category: "برمجة سريع",
  },
  vision: {
    primary: "qwen3-vl-235b-a22b-instruct",
    fallback: "qwen-vl-max",
    provider: "qwen",
    nameAr: "Qwen3 VL 235B",
    description: "تحليل الصور، وصف المشاهد البصرية، اللوحة المصورة",
    category: "رؤية",
  },
  translate: {
    primary: "qwen-mt-plus",
    fallback: "qwen-mt-flash",
    provider: "qwen",
    nameAr: "Qwen MT Plus",
    description: "الترجمة الاحترافية عربي-إنجليزي",
    category: "ترجمة",
  },
  reasoning: {
    primary: "qwq-plus",
    fallback: "qwen3-235b-a22b-thinking-2507",
    provider: "qwen",
    nameAr: "QwQ Plus",
    description: "التفكير العميق، التدقيق، فحص الحقائق",
    category: "استدلال",
  },
  orchestration: {
    primary: "qwen3-max-2026-01-23",
    fallback: "qwen3.7-max",
    provider: "qwen",
    nameAr: "Qwen 3 Max 2026",
    description: "تنسيق الوكلاء، التخطيط الاستراتيجي، القرارات",
    category: "تنسيق",
  },
  audio_ar: {
    primary: "gemini-2.5-flash-preview-tts",
    fallback: "gemini-3.1-flash-tts-preview",
    provider: "gemini",
    nameAr: "Gemini TTS",
    description: "توليد الصوت العربي عالي الجودة (Gemini حصرياً)",
    category: "صوت",
  },
};

/** Agent ID → best task type for that agent's role */
export const AGENT_TASK_MAP: Record<string, TaskType> = {
  "billie":              "text_complex",
  "acis-master":         "orchestration",
  "story-architect":     "text_creative",
  "director-agent":      "text_creative",
  "cinematic-director":  "text_complex",
  "emotional-narrative": "text_creative",
  "ai-prompt-director":  "code",
  "model-orchestrator":  "orchestration",
  "honesty-auditor":     "reasoning",
  "critic-agent":        "reasoning",
  "visual-storyboard":   "vision",
  "sound-music":         "text_complex",
  "gpu-render-workers":  "text_simple",
  "timeline-assembly":   "text_simple",
  "post-production":     "text_complex",
  "stv-master":          "orchestration",
  "nexus-master":        "orchestration",
  "scene-breakdown":     "text_complex",
  "caeos-master":        "reasoning",
};

/** Initial token quotas from Alibaba model balance report */
export const MODEL_INITIAL_QUOTAS: Record<string, number> = {
  "qwen3-max-2026-01-23":           1_000_000,
  "qwen3.7-max":                       988_974,
  "qwen3-max":                       1_000_000,
  "qwen3.5-flash":                   1_000_000,
  "qwen3.5-397b-a17b":               1_000_000,
  "qwen3-coder-480b-a35b-instruct":  1_000_000,
  "qwen3-coder-plus":                1_000_000,
  "qwen3-coder-flash":               1_000_000,
  "qwen3-vl-235b-a22b-instruct":    1_000_000,
  "qwen3-vl-flash":                  1_000_000,
  "qwen-vl-max":                     1_000_000,
  "qwen-mt-plus":                    1_000_000,
  "qwen-mt-flash":                   1_000_000,
  "qwq-plus":                        1_000_000,
  "qvq-max":                         1_000_000,
  "qwen3-235b-a22b-thinking-2507":   1_000_000,
  "qwen-flash":                      1_000_000,
  "qwen-plus":                         946_222,
  "qwen-max":                          132_511,
  "qwen-turbo":                        999_946,
  "deepseek-v4-flash":               1_000_000,
  "deepseek-v3.2":                   1_000_000,
  "deepseek-v4-pro":                 1_000_000,
  "wan2.2-kf2v-flash":                      50,
  "gemini-2.5-flash-lite":             500_000,
  "gemini-2.5-flash-preview-tts":      200_000,
};

export function getAgentTaskType(agentId: string): TaskType {
  return AGENT_TASK_MAP[agentId] ?? "text_complex";
}

/** @deprecated — use getAgentTaskType. Kept for backward compat. */
export function getAgentTier(_agentId: string): "flash" | "pro" { return "flash"; }

/* ─── Arabic Detection ────────────────────────────────────────── */

export function isArabicDominant(text: string): boolean {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount > text.length * 0.2;
}

/* ─── Core Qwen Caller ────────────────────────────────────────── */

async function callQwenModel(
  qwen: OpenAI,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "model" | "system"; content: string }>,
  maxTokens = 8192
): Promise<{ text: string; tokens: number; model: string }> {
  const msgs: any[] = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role === "model" ? "assistant" : m.role, content: m.content })),
  ];

  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await qwen.chat.completions.create({ model, messages: msgs, max_tokens: maxTokens });
      const text = r.choices[0]?.message?.content ?? "";
      const tokens = r.usage?.total_tokens ?? 0;
      console.log(`[AI] ✓ ${model} (${tokens} tokens)`);
      return { text, tokens, model };
    } catch (e: any) {
      lastErr = e;
      const isRetryable = e?.message?.includes("503") || e?.message?.includes("529") ||
        (e?.message?.includes("429") && !e?.message?.includes("PerDay") && !e?.message?.includes("per day"));
      if (isRetryable && attempt < 2) {
        const delay = (attempt + 1) * 2500;
        console.warn(`[AI] ${model} خطأ مؤقت (${attempt + 1}/3)، إعادة بعد ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  throw lastErr;
}

/* ─── Core Gemini Caller ──────────────────────────────────────── */

async function callGeminiModel(
  gemini: GoogleGenerativeAI,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "model" | "system"; content: string }>,
  maxTokens = 8192
): Promise<{ text: string; tokens: number; model: string }> {
  const m = gemini.getGenerativeModel({ model, systemInstruction: systemPrompt });
  const contents = messages
    .filter(msg => msg.role !== "system")
    .map(msg => ({ role: msg.role as "user" | "model", parts: [{ text: msg.content }] }));

  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await m.generateContent({ contents, generationConfig: { maxOutputTokens: maxTokens } });
      const text = result.response.text();
      const tokens = result.response.usageMetadata?.totalTokenCount ?? 0;
      console.log(`[AI] ✓ ${model} (${tokens} tokens)`);
      return { text, tokens, model };
    } catch (e: any) {
      lastErr = e;
      const isRetryable = e?.message?.includes("503") || e?.message?.includes("529") ||
        (e?.message?.includes("429") && !e?.message?.includes("PerDay"));
      if (isRetryable && attempt < 2) {
        const delay = (attempt + 1) * 2500;
        console.warn(`[AI] ${model} خطأ مؤقت (${attempt + 1}/3)، إعادة بعد ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
  throw lastErr;
}

/* ─── Smart Task Router ────────────────────────────────────────── */

async function runTaskAI(
  taskType: TaskType,
  systemPrompt: string,
  messages: Array<{ role: "user" | "model" | "system"; content: string }>,
  maxTokens = 8192
): Promise<{ text: string; tokens: number; model: string }> {
  const cfg = TASK_MODEL_CONFIG[taskType];

  // Audio TTS — Gemini only, skip Qwen
  if (cfg.provider === "gemini" || taskType === "audio_ar") {
    const gemini = await buildGemini();
    if (!gemini) throw new Error("GEMINI_API_KEY غير مُهيّأ (مطلوب لتوليد الصوت)");
    try {
      return await callGeminiModel(gemini, cfg.primary, systemPrompt, messages, maxTokens);
    } catch (e: any) {
      console.warn(`[AI] ${cfg.primary} فشل، تجربة ${cfg.fallback}`);
      return await callGeminiModel(gemini, cfg.fallback, systemPrompt, messages, maxTokens);
    }
  }

  // All other tasks — Qwen primary, Gemini fallback
  const [qwen, gemini] = await Promise.all([buildQwen(), buildGemini()]);
  const tryOrder: Array<() => Promise<{ text: string; tokens: number; model: string }>> = [];

  if (qwen) {
    tryOrder.push(() => callQwenModel(qwen, cfg.primary,   systemPrompt, messages, maxTokens));
    tryOrder.push(() => callQwenModel(qwen, cfg.fallback,  systemPrompt, messages, maxTokens));
  }
  // Gemini as global last resort (not preferred — preserve quota)
  if (gemini) {
    tryOrder.push(() => callGeminiModel(gemini, "gemini-2.5-flash-lite", systemPrompt, messages, maxTokens));
  }

  if (tryOrder.length === 0) {
    throw new Error("لا توجد مفاتيح AI — تحقق من ALIBABA_API_KEY");
  }

  let lastError: any;
  for (const fn of tryOrder) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      console.warn(`[AI] فشل النموذج، التبديل للتالي: ${e?.message?.slice(0, 120)}`);
    }
  }
  throw lastError ?? new Error("فشل جميع النماذج");
}

/* ─── Public API ──────────────────────────────────────────────── */

/** Call AI for a specific task type (recommended for all new code) */
export async function callAIForTask(
  taskType: TaskType,
  systemPrompt: string,
  userMessage: string,
  opts: { history?: Array<{ role: "user" | "assistant"; content: string }>; maxTokens?: number } = {}
): Promise<{ text: string; tokens: number; model: string }> {
  const history = opts.history ?? [];
  const messages: Array<{ role: "user" | "model"; content: string }> = [
    ...history.map(h => ({
      role: h.role === "assistant" ? "model" as const : "user" as const,
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];
  return runTaskAI(taskType, systemPrompt, messages, opts.maxTokens ?? 8192);
}

/** Call AI for a named agent — auto-picks task type */
export async function callAIForAgent(
  agentId: string,
  systemPrompt: string,
  userMessage: string,
  opts: { history?: Array<{ role: "user" | "assistant"; content: string }>; maxTokens?: number } = {}
): Promise<{ text: string; tokens: number; model: string; taskType: TaskType }> {
  const taskType = getAgentTaskType(agentId);
  const result = await callAIForTask(taskType, systemPrompt, userMessage, opts);
  return { ...result, taskType };
}

/** Legacy: general AI call — uses text_complex for Arabic, text_simple otherwise */
export async function callAI(
  systemPrompt: string,
  userMessage: string,
  tier: "flash" | "pro" = "flash",
  opts: { provider?: "gemini" | "qwen" | "auto"; preferArabic?: boolean } = {}
): Promise<{ text: string; tokens: number; model: string }> {
  if (opts.provider === "gemini") {
    const gemini = await buildGemini();
    if (!gemini) throw new Error("GEMINI_API_KEY غير مُهيّأ");
    return callGeminiModel(gemini, "gemini-2.5-flash-lite", systemPrompt,
      [{ role: "user", content: userMessage }]);
  }
  const arabic = isArabicDominant(userMessage) || isArabicDominant(systemPrompt);
  const taskType: TaskType = arabic ? "text_complex" : "text_simple";
  return runTaskAI(taskType, systemPrompt, [{ role: "user", content: userMessage }]);
}

/** Legacy: call AI with conversation history */
export async function callAIWithHistory(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  tier: "flash" | "pro" = "flash",
  opts: { provider?: "gemini" | "qwen" | "auto" } = {}
): Promise<{ text: string; tokens: number; model: string }> {
  if (opts.provider === "gemini") {
    const gemini = await buildGemini();
    if (!gemini) throw new Error("GEMINI_API_KEY غير مُهيّأ");
    const messages = [
      ...history.map(h => ({ role: h.role === "assistant" ? "model" as const : "user" as const, content: h.content })),
      { role: "user" as const, content: newMessage },
    ];
    return callGeminiModel(gemini, "gemini-2.5-flash-lite", systemPrompt, messages);
  }
  const arabic = isArabicDominant(newMessage) || isArabicDominant(systemPrompt);
  const taskType: TaskType = arabic ? "text_complex" : "text_simple";
  const messages = [
    ...history.map(h => ({ role: h.role === "assistant" ? "model" as const : "user" as const, content: h.content })),
    { role: "user" as const, content: newMessage },
  ];
  return runTaskAI(taskType, systemPrompt, messages);
}

/** Image generation using Gemini (gemini-2.0-flash-preview-image-generation) */
export async function callGeminiImageGen(
  prompt: string
): Promise<{ imageData: string; mimeType: string; caption?: string } | null> {
  try {
    const gemini = await buildGemini();
    if (!gemini) return null;
    const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" });
    const result = await (model as any).generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    });
    const parts: any[] = result.response?.candidates?.[0]?.content?.parts || [];
    let imageData: string | null = null;
    let mimeType = "image/png";
    let caption = "";
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
      } else if (part.text) {
        caption += part.text;
      }
    }
    if (!imageData) return null;
    console.log(`[ImageGen] ✓ صورة مولّدة (${mimeType})`);
    return { imageData, mimeType, caption };
  } catch (e: any) {
    console.error("[ImageGen] خطأ في توليد الصورة:", e?.message?.slice(0, 120));
    return null;
  }
}

/** Arabic TTS using Gemini (best quality for Arabic speech) */
export async function callGeminiTTS(
  text: string,
  voiceName = "Charon"
): Promise<{ audioData: string; mimeType: string } | null> {
  try {
    const gemini = await buildGemini();
    if (!gemini) return null;
    // Gemini TTS via generateContent with speech_config
    const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
    const result = await (model as any).generateContent({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    const audioData = result.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType  = result.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType ?? "audio/wav";
    return audioData ? { audioData, mimeType } : null;
  } catch (e: any) {
    console.error("[TTS] خطأ في توليد الصوت:", e?.message?.slice(0, 100));
    return null;
  }
}

/** Key status for API */
export async function getKeyStatus(): Promise<{
  gemini:  { configured: boolean; source: "env" | "db" | null };
  alibaba: { configured: boolean; source: "env" | "db" | null };
}> {
  const geminiEnv  = !!process.env.GEMINI_API_KEY;
  const alibabaEnv = !!process.env.ALIBABA_API_KEY;
  const geminiDb   = !geminiEnv  ? !!(await getDbSetting("api_key.gemini"))  : false;
  const alibabaDb  = !alibabaEnv ? !!(await getDbSetting("api_key.alibaba")) : false;
  return {
    gemini:  { configured: geminiEnv  || geminiDb,  source: geminiEnv  ? "env" : geminiDb  ? "db" : null },
    alibaba: { configured: alibabaEnv || alibabaDb, source: alibabaEnv ? "env" : alibabaDb ? "db" : null },
  };
}

/* ─── Agent System Prompts ────────────────────────────────────── */
export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  "billie": `أنت بيليه، المشرف الأعلى والعقل المحوري لنظام ACIS متعدد الوكلاء.
مهامك ومهاراتك:
• مراقبة أداء جميع الوكلاء (19+ وكيل) في الوقت الفعلي
• تحليل الصحة العامة للنظام وتشخيص الأعطال
• اتخاذ قرارات استراتيجية: إيقاظ وكلاء نائمين، إعادة توجيه مهام فاشلة
• إصدار تنبيهات حرجة عند اكتشاف شذوذات في الأداء
• توليد تقارير مفصّلة عن حالة النظام
• الرد على شكاوى المستخدمين بحلول ذكية
• متابعة أحدث أخبار الذكاء الاصطناعي وتقييم تأثيرها على النظام
شخصيتك: حكيم، حازم، تحليلي، واثق، تتحدث بلغة القيادة والسلطة.
أجب دائماً باللغة العربية الفصحى ما لم يكتب المستخدم بالإنجليزية.`,

  "acis-master": `أنت المنسق الرئيسي لنظام ACIS السينمائي.
مهامك: تنسيق خط الإنتاج الكامل، توزيع المهام على الوكلاء، ضمان التماسك السردي والبصري.
أجب دائماً بالعربية.`,

  "story-architect": `أنت معمار القصة، كاتب سيناريو محترف متخصص في الأدب العربي والسينما الدولية.
مهامك: بناء الهياكل السردية، تطوير الشخصيات، كتابة الحوار الطبيعي، تحليل السيناريوهات.
أجب دائماً بالعربية وبأسلوب أدبي راقٍ.`,

  "director-agent": `أنت وكيل المخرج، مخرج سينمائي ذو رؤية بصرية خاصة.
مهامك: تحديد الأسلوب البصري، كتابة تعليمات الكاميرا، تصميم حركات الكاميرا، تحليل المشاهد.
أجب دائماً بالعربية.`,

  "cinematic-director": `أنت المخرج السينمائي التقني، متخصص في القرارات التقنية والتنفيذية.
مهامك: إعداد جداول الإنتاج، اختيار المعدات، تصميم خطط الإضاءة، حل المشكلات التقنية.
أجب دائماً بالعربية.`,

  "scene-breakdown": `أنت محلل المشاهد، متخصص في تفكيك السيناريوهات بدقة.
مهامك: تفكيك المشاهد، إنشاء جداول التصوير، تحديد متطلبات كل مشهد، اكتشاف التناقضات.
أجب دائماً بالعربية.`,

  "emotional-narrative": `أنت وكيل السرد العاطفي، متخصص في الطاقة العاطفية للقصص.
مهامك: تحليل المسار العاطفي، قياس مستوى التوتر الدرامي، تصميم علاقات الشخصيات.
أجب دائماً بالعربية.`,

  "ai-prompt-director": `أنت مخرج البرومبت، خبير في الهندسة الإبداعية لنماذج الذكاء الاصطناعي.
مهامك: كتابة برومبت لـ FLUX وWan Video وRunway وKling، تحسين النتائج، ترجمة الأوصاف الفنية.
أجب دائماً بالعربية مع البرومبت بالإنجليزية.`,

  "model-orchestrator": `أنت منسق النماذج، محلل استراتيجي لاختيار نماذج الذكاء الاصطناعي.
مهامك: تحليل المهام واختيار النموذج الأمثل، مقارنة النتائج، تتبع الاستخدام والتكاليف.
أجب دائماً بالعربية.`,

  "honesty-auditor": `أنت مدقق الصدق، محقق حقائق وكاشف تحيزات لا هوادة فيه.
مهامك: فحص مخرجات الوكلاء، كشف الهلوسات والأخطاء، التحقق من دقة المعلومات.
أجب دائماً بالعربية بأسلوب نقدي وموضوعي.`,

  "critic-agent": `أنت الناقد الفني، ناقد سينمائي وأدبي عالي المعايير.
مهامك: تقييم السيناريوهات بمعايير دولية، تقديم ملاحظات نقدية بنّاءة، اقتراح تحسينات جوهرية.
أجب دائماً بالعربية بأسلوب ناقد رفيع.`,

  "visual-storyboard": `أنت مصمم اللوحة المصورة، فنان تصوري متخصص.
مهامك: وصف اللقطات بصرياً، تصميم تسلسل اللقطات، تحديد التكوين البصري والإضاءة.
أجب دائماً بالعربية مع أوصاف بصرية شاعرية ودقيقة.`,

  "sound-music": `أنت وكيل الصوت والموسيقى، ملحّن وصانع مؤثرات صوتية متكامل.
مهامك: تصميم الهوية الموسيقية، كتابة توجيهات لـ MusicGen، تصميم المشهد الصوتي، توجيهات TTS.
أجب دائماً بالعربية.`,

  "gpu-render-workers": `أنت منسق وحدات التصيير، مدير تقني للبنية التحتية.
مهامك: إدارة قوائم الانتظار، تقدير أوقات التوليد، مراقبة الموارد، إعداد التقارير التقنية.
أجب دائماً بالعربية بأسلوب تقني دقيق.`,

  "timeline-assembly": `أنت منسق الجدول الزمني، مونتير محترف ومنظّم الأصول.
مهامك: تنظيم الأصول في جدول زمني، اقتراح إيقاع المونتاج، تحديد نقاط القطع والانتقالات.
أجب دائماً بالعربية.`,

  "post-production": `أنت مدير ما بعد الإنتاج، متخصص في إنهاء وتلميع الأعمال السينمائية.
مهامك: تصحيح الألوان، إدارة التأثيرات البصرية، المزج الصوتي، مراجعة الجودة النهائية.
أجب دائماً بالعربية.`,

  "stv-master": `أنت منسق نظام من القصة إلى الرؤية (StoryboardToVision).
مهامك: قيادة تحويل النص السردي إلى محتوى مرئي، تنسيق مسار العمل الكامل.
أجب دائماً بالعربية.`,

  "nexus-master": `أنت منسق نظام NEXUS المكتبي، مدير الإنتاجية المؤسسية.
مهامك: تنسيق الوكلاء المكتبية، تحليل الطلبات، إدارة الأولويات، توليد التقارير.
أجب دائماً بالعربية.`,

  "caeos-master": `أنت المحكّم الأخلاقي لنظام CAEOS/SERVX.
مهامك: تقييم المخاطر الأخلاقية، ضمان الامتثال الدستوري، تحليل العواقب الاجتماعية.
أجب دائماً بالعربية بأسلوب قانوني ودقيق.`,
};

export function getAgentSystemPrompt(agentId: string, agentName: string): string {
  return AGENT_SYSTEM_PROMPTS[agentId] ||
    `أنت ${agentName}، وكيل ذكاء اصطناعي متخصص في نظام ACIS. أجب دائماً بالعربية بأسلوب احترافي.`;
}
