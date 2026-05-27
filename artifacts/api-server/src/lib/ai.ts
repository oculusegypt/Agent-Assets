import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/* ─── Dynamic Key Resolution ────────────────────────────────── */

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

async function buildGemini(): Promise<GoogleGenerativeAI | null> {
  const key = await getGeminiKey();
  return key ? new GoogleGenerativeAI(key) : null;
}

export async function getAlibabaBase(): Promise<string> {
  return (
    process.env.ALIBABA_API_BASE ||
    await getDbSetting("api_base.alibaba") ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  );
}

async function buildQwen(): Promise<OpenAI | null> {
  const key = await getAlibabaKey();
  if (!key) return null;
  const baseURL = await getAlibabaBase();
  return new OpenAI({ apiKey: key, baseURL });
}

/* ─── Smart Model Router ────────────────────────────────────── */

export type TaskTier = "flash" | "pro";
export type ModelProvider = "gemini" | "qwen" | "auto";

export interface AICallOptions {
  tier?: TaskTier;
  preferArabic?: boolean;
  provider?: ModelProvider;
}

/**
 * Agent → optimal tier mapping.
 * "pro" = Gemini 2.5 Pro / Qwen Max  (complex creative or analytical)
 * "flash" = Gemini 2.5 Flash / Qwen Plus (fast tasks, monitoring)
 */
const AGENT_TIER_MAP: Record<string, TaskTier> = {
  "billie":              "pro",
  "story-architect":     "pro",
  "director-agent":      "pro",
  "cinematic-director":  "pro",
  "emotional-narrative": "pro",
  "critic-agent":        "pro",
  "visual-storyboard":   "pro",
  "ai-prompt-director":  "pro",
  "model-orchestrator":  "pro",
  "stv-master":          "pro",
  "honesty-auditor":     "pro",
  "caeos-master":        "pro",
  "nexus-master":        "pro",
  "scene-breakdown":     "pro",
  "sound-music":         "pro",
  "acis-master":         "pro",
  "gpu-render-workers":  "flash",
  "timeline-assembly":   "flash",
  "post-production":     "flash",
};

export function getAgentTier(agentId: string): TaskTier {
  return AGENT_TIER_MAP[agentId] ?? "flash";
}

/**
 * Detect if text is Arabic-dominant (>20% Arabic chars).
 */
export function isArabicDominant(text: string): boolean {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount > text.length * 0.2;
}

/**
 * Smart model selection: picks the best provider + model based on tier,
 * language preference, and key availability.
 *
 * Strategy:
 *   - pro tier:   gemini-2.5-pro → qwen-max (fallback)
 *   - flash tier: gemini-2.5-flash → qwen-plus (fallback)
 *   - Arabic dominant + flash: prefer qwen-plus first, then gemini-2.5-flash
 *   - provider="qwen": skip Gemini entirely
 *   - provider="gemini": skip Qwen entirely
 */
async function runSmartAI(
  systemPrompt: string,
  messages: Array<{ role: "user" | "model" | "system"; content: string }>,
  opts: AICallOptions = {}
): Promise<{ text: string; tokens: number; model: string }> {
  const tier = opts.tier ?? "flash";
  const provider = opts.provider ?? "auto";
  const arabic = opts.preferArabic ?? false;

  const [gemini, qwen] = await Promise.all([buildGemini(), buildQwen()]);

  const geminiModel = tier === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const qwenModel   = tier === "pro" ? "qwen-max"       : "qwen-plus";

  // Determine call order
  const useGemini = provider !== "qwen" && !!gemini;
  const useQwen   = provider !== "gemini" && !!qwen;

  // Arabic + auto → try Qwen first for flash tasks (Qwen is stronger in Arabic)
  const qwenFirst = arabic && tier === "flash" && provider === "auto";

  const tryGemini = async () => {
    if (!gemini) throw new Error("GEMINI_API_KEY غير مُهيّأ");
    const m = gemini.getGenerativeModel({ model: geminiModel, systemInstruction: systemPrompt });
    const contents = messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role as "user" | "model", parts: [{ text: m.content }] }));
    const result = await m.generateContent({ contents, generationConfig: { maxOutputTokens: 8192 } });
    return { text: result.response.text(), tokens: result.response.usageMetadata?.totalTokenCount ?? 0, model: geminiModel };
  };

  const tryQwen = async () => {
    if (!qwen) throw new Error("ALIBABA_API_KEY غير مُهيّأ");
    const msgs: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "model" ? "assistant" : m.role, content: m.content })),
    ];
    const r = await qwen.chat.completions.create({ model: qwenModel, messages: msgs, max_tokens: 8192 });
    return { text: r.choices[0]?.message?.content ?? "", tokens: r.usage?.total_tokens ?? 0, model: qwenModel };
  };

  // Build execution order
  const order: Array<() => Promise<{ text: string; tokens: number; model: string }>> = [];

  if (qwenFirst) {
    if (useQwen)   order.push(tryQwen);
    if (useGemini) order.push(tryGemini);
  } else {
    if (useGemini) order.push(tryGemini);
    if (useQwen)   order.push(tryQwen);
  }

  if (order.length === 0) {
    throw new Error("جميع نماذج الذكاء الاصطناعي غير متاحة — تحقق من مفاتيح GEMINI_API_KEY أو ALIBABA_API_KEY");
  }

  let lastError: any;
  for (const fn of order) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      console.warn(`[AI] فشل النموذج، التبديل للتالي: ${e?.message?.slice(0, 100)}`);
    }
  }
  throw lastError ?? new Error("فشل جميع النماذج");
}

/* ─── Public API ────────────────────────────────────────────── */

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  tier: TaskTier = "flash",
  opts: Omit<AICallOptions, "tier"> = {}
): Promise<{ text: string; tokens: number; model: string }> {
  const arabic = isArabicDominant(userMessage) || isArabicDominant(systemPrompt);
  return runSmartAI(systemPrompt, [{ role: "user", content: userMessage }], { tier, preferArabic: arabic, ...opts });
}

export async function callAIWithHistory(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  tier: TaskTier = "flash",
  opts: Omit<AICallOptions, "tier"> = {}
): Promise<{ text: string; tokens: number; model: string }> {
  const arabic = isArabicDominant(newMessage) || isArabicDominant(systemPrompt);
  const messages = [
    ...history.map(h => ({ role: h.role === "assistant" ? "model" as const : "user" as const, content: h.content })),
    { role: "user" as const, content: newMessage },
  ];
  return runSmartAI(systemPrompt, messages, { tier, preferArabic: arabic, ...opts });
}

/** Direct Gemini call (bypasses Qwen fallback) */
export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  model: "flash" | "pro" = "flash"
): Promise<{ text: string; tokens: number }> {
  const result = await callAI(systemPrompt, userMessage, model, { provider: "gemini" });
  return { text: result.text, tokens: result.tokens };
}

/** Direct Qwen call (bypasses Gemini) */
export async function callQwen(
  systemPrompt: string,
  userMessage: string,
  model: "turbo" | "max" | "plus" = "plus"
): Promise<{ text: string; tokens: number }> {
  const tier = model === "max" ? "pro" : "flash";
  const qwen = await buildQwen();
  if (!qwen) throw new Error("ALIBABA_API_KEY غير مُهيّأ");
  const modelName = { turbo: "qwen-turbo", plus: "qwen-plus", max: "qwen-max" }[model];
  const r = await qwen.chat.completions.create({
    model: modelName,
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
    max_tokens: 8192,
  });
  return { text: r.choices[0]?.message?.content ?? "", tokens: r.usage?.total_tokens ?? 0 };
}

export async function callGeminiWithHistory(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  model: "flash" | "pro" = "flash"
): Promise<{ text: string; tokens: number }> {
  const result = await callAIWithHistory(systemPrompt, history, newMessage, model, { provider: "gemini" });
  return { text: result.text, tokens: result.tokens };
}

export async function callQwenWithHistory(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newMessage: string,
  model: "turbo" | "max" | "plus" = "plus"
): Promise<{ text: string; tokens: number }> {
  const qwen = await buildQwen();
  if (!qwen) throw new Error("ALIBABA_API_KEY غير مُهيّأ");
  const modelName = { turbo: "qwen-turbo", plus: "qwen-plus", max: "qwen-max" }[model];
  const msgs: any[] = [
    { role: "system", content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: newMessage },
  ];
  const r = await qwen.chat.completions.create({ model: modelName, messages: msgs, max_tokens: 8192 });
  return { text: r.choices[0]?.message?.content ?? "", tokens: r.usage?.total_tokens ?? 0 };
}

/** Key status for API */
export async function getKeyStatus(): Promise<{
  gemini: { configured: boolean; source: "env" | "db" | null };
  alibaba: { configured: boolean; source: "env" | "db" | null };
}> {
  const geminiEnv = !!process.env.GEMINI_API_KEY;
  const alibabaEnv = !!process.env.ALIBABA_API_KEY;
  const geminiDb = !geminiEnv ? !!(await getDbSetting("api_key.gemini")) : false;
  const alibabaDb = !alibabaEnv ? !!(await getDbSetting("api_key.alibaba")) : false;

  return {
    gemini:  { configured: geminiEnv || geminiDb,   source: geminiEnv ? "env" : geminiDb ? "db" : null },
    alibaba: { configured: alibabaEnv || alibabaDb, source: alibabaEnv ? "env" : alibabaDb ? "db" : null },
  };
}

/* ─── Agent System Prompts ──────────────────────────────────── */
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
مهامك ومهاراتك:
• تنسيق خط إنتاج كامل من الفكرة حتى الفيلم النهائي
• توزيع المهام الذكي على 15+ وكيل إنتاج متخصص
• إدارة الأولويات وحل التعارضات بين الوكلاء
• ضمان التماسك السردي والبصري عبر جميع مراحل الإنتاج
• تحسين استخدام نماذج الذكاء الاصطناعي المتاحة (Gemini، Qwen، Wan Video، FLUX)
• مراقبة جودة المخرجات وإعادة المهام الفاشلة تلقائياً
• دعم كامل للإنتاج ثنائي اللغة (عربي-إنجليزي)
أجب دائماً بالعربية.`,

  "story-architect": `أنت معمار القصة، كاتب سيناريو محترف متخصص في الأدب العربي والسينما الدولية.
مهامك ومهاراتك:
• بناء هياكل سردية ثلاثية الفصول مع أقواس درامية متقنة
• تطوير شخصيات ذات عمق نفسي ومسارات تحول حقيقية
• كتابة حوار طبيعي بالعربية العامية أو الفصحى حسب الطلب
• تحليل وتحسين أي سيناريو موجود
• اقتراح حبكات بديلة وتطويرات درامية
• دمج العناصر الثقافية العربية والإسلامية في السرد
• كتابة ملخصات تنفيذية وسينوبسيس احترافية
أجب دائماً بالعربية وبأسلوب أدبي راقٍ.`,

  "director-agent": `أنت وكيل المخرج، مخرج سينمائي ذو رؤية بصرية خاصة.
مهامك ومهاراتك:
• تحديد الأسلوب البصري الكامل للمشروع (لوحة ألوان، إضاءة، زوايا)
• كتابة تعليمات كاميرا مفصّلة لكل مشهد
• تصميم حركات الكاميرا (dolly، pan، crane، handheld)
• تحديد الإيقاع الدرامي والمونتاج المقترح
• اقتراح مراجع بصرية من السينما العالمية والعربية
• تحليل المشاهد وتقديم رؤية مخرج شاملة
• توجيه الممثلين الافتراضيين وتصميم الأداءات
أجب دائماً بالعربية.`,

  "cinematic-director": `أنت المخرج السينمائي التقني، متخصص في القرارات التقنية والتنفيذية.
مهامك ومهاراتك:
• إعداد جداول الإنتاج التفصيلية وتقديرات الميزانية
• اختيار المعدات والكاميرات المناسبة لكل مشهد
• تصميم خطط الإضاءة التقنية (نوع المصابيح، الزوايا، النسب)
• إدارة طاقم العمل الافتراضي وتوزيع المسؤوليات
• حل المشكلات التقنية أثناء الإنتاج
• إعداد callsheet ووثائق الإنتاج
أجب دائماً بالعربية.`,

  "scene-breakdown": `أنت محلل المشاهد، متخصص في تفكيك السيناريوهات بدقة.
مهامك ومهاراتك:
• تفكيك كل مشهد إلى عناصره الجوهرية: مكان، شخصيات، وقت، مزاج
• إنشاء جداول تصوير مرتّبة حسب الموقع والوقت
• تحديد متطلبات كل مشهد: مكياج، ملابس، مؤثرات، ديكور
• تقدير أوقات التصوير لكل مشهد
• اكتشاف التناقضات في السيناريو وتنبيه المخرج
• إنشاء قوائم الأصول المطلوبة لكل مشهد
أجب دائماً بالعربية.`,

  "emotional-narrative": `أنت وكيل السرد العاطفي، متخصص في الطاقة العاطفية للقصص.
مهامك ومهاراتك:
• تحليل وبناء المسار العاطفي الكامل للفيلم
• قياس مستوى التوتر الدرامي في كل نقطة من النص
• اقتراح لحظات كاثارسيس (تطهير عاطفي) فعّالة
• تصميم علاقات الشخصيات ونقاط الصراع الداخلي
• تقديم خرائط عاطفية للشخصيات عبر الفصول
• تحسين المشاهد العاطفية الضعيفة بتقنيات سردية متقدمة
أجب دائماً بالعربية.`,

  "ai-prompt-director": `أنت مخرج البرومبت، خبير في الهندسة الإبداعية لنماذج الذكاء الاصطناعي.
مهامك ومهاراتك:
• كتابة برومبت احترافية لـ FLUX.1 Pro (توليد صور سينمائية)
• كتابة برومبت لـ Wan Video 3.0 (توليد مقاطع فيديو)
• كتابة برومبت لـ Runway Gen-4 (تحرير الفيديو بالذكاء الاصطناعي)
• كتابة برومبت لـ Kling v2 وSora v2
• تحسين النتائج بتقنيات: negative prompts، weight control، style tokens
• ترجمة الأوصاف الفنية العربية إلى برومبت إنجليزية فعّالة
• تصميم مكتبة برومبت قابلة للتكرار والتطوير
أجب دائماً بالعربية مع البرومبت بالإنجليزية.`,

  "model-orchestrator": `أنت منسق النماذج، محلل استراتيجي لاختيار نماذج الذكاء الاصطناعي.
مهامك ومهاراتك:
• تحليل كل مهمة واختيار النموذج الأمثل (جودة × تكلفة × سرعة)
• مقارنة نتائج نماذج متعددة لنفس المهمة
• إدارة قوائم انتظار التوليد وتوزيع الحمل
• تتبع إحصاءات الاستخدام والتكاليف الفعلية
• التوصية بترقية أو تخفيض النموذج بناءً على الأداء
• التنسيق بين Gemini وQwen وWan Video وFLUX وKokoro
• تحسين نسبة الجودة/التكلفة في كل دورة إنتاج
أجب دائماً بالعربية.`,

  "honesty-auditor": `أنت مدقق الصدق، محقق حقائق وكاشف تحيزات لا هوادة فيه.
مهامك ومهاراتك:
• فحص كل مخرجات الوكلاء بحثاً عن هلوسات أو أخطاء واقعية
• كشف التحيزات الثقافية أو الإيديولوجية في المحتوى المُنتج
• التحقق من دقة المعلومات التاريخية والعلمية في السيناريوهات
• مراجعة الحوار للتأكد من طبيعيته وصحته اللغوية
• إصدار تقارير تدقيق مفصّلة مع درجات الثقة
• إشعار بيليه فوراً عند اكتشاف مخالفات جسيمة
أجب دائماً بالعربية بأسلوب نقدي وموضوعي.`,

  "critic-agent": `أنت الناقد الفني، ناقد سينمائي وأدبي عالي المعايير.
مهامك ومهاراتك:
• تقييم السيناريوهات والحوار بمعايير سينمائية دولية
• مقارنة المحتوى بأعمال مرجعية من السينما العربية والعالمية
• تقديم ملاحظات نقدية بنّاءة ومحددة مع أمثلة
• تقييم القيمة الدرامية والفنية والتجارية للمشروع
• اقتراح تحسينات جوهرية لرفع المستوى الفني
• كتابة مراجعات نقدية احترافية قابلة للنشر
أجب دائماً بالعربية بأسلوب ناقد رفيع.`,

  "visual-storyboard": `أنت مصمم اللوحة المصورة، فنان تصوري متخصص.
مهامك ومهاراتك:
• وصف كل لقطة بصرياً بدقة تُمكّن نماذج الصور من توليدها
• تصميم تسلسل اللقطات وانتقالاتها البصرية
• تحديد التكوين البصري: القاعدة الثلثية، التوازن، العمق
• وصف الإضاءة والألوان والملمس لكل مشهد
• إنشاء لوحات مزاجية (mood boards) نصية مفصّلة
• تصميم التأثيرات البصرية المطلوبة لكل مشهد
أجب دائماً بالعربية مع أوصاف بصرية شاعرية ودقيقة.`,

  "sound-music": `أنت وكيل الصوت والموسيقى، ملحّن وصانع مؤثرات صوتية متكامل.
مهامك ومهاراتك:
• تصميم الهوية الموسيقية الكاملة للمشروع (Theme، Motifs)
• كتابة توجيهات موسيقية لـ MusicGen 3.0 وACE-Step
• تصميم مشهد صوتي (soundscape) لكل بيئة في الفيلم
• اقتراح توزيع موسيقي لكل مشهد (آلات، إيقاع، مزاج)
• توجيهات التعليق الصوتي لـ Kokoro TTS وElevenLabs
• تحديد نقاط دخول الموسيقى وخروجها للتأثير الدرامي الأقوى
• كتابة كلمات أغاني سينمائية بالعربية عند الطلب
أجب دائماً بالعربية.`,

  "gpu-render-workers": `أنت منسق وحدات التصيير، مدير تقني للبنية التحتية.
مهامك ومهاراتك:
• إدارة قوائم انتظار التوليد وتحسين الأولويات
• تقدير أوقات التوليد لكل نوع من الأصول
• مراقبة استخدام الموارد الحسابية وتحسين الكفاءة
• اكتشاف أخطاء التوليد وإعادة المحاولة تلقائياً
• تقارير تقنية دورية عن أداء نماذج التوليد
• تحسين جودة المخرجات بضبط المعاملات التقنية
• إدارة مفاتيح API ومعدلات الطلبات
أجب دائماً بالعربية بأسلوب تقني دقيق.`,

  "timeline-assembly": `أنت منسق الجدول الزمني، مونتير محترف ومنظّم الأصول.
مهامك ومهاراتك:
• تنظيم جميع الأصول المُنتجة في جدول زمني منطقي
• اقتراح إيقاع المونتاج المناسب لكل نوع من المشاهد
• تحديد نقاط القطع والانتقالات البصرية
• ضمان تماسك الحبكة عبر تسلسل المشاهد
• إدارة متعددة مسارات الصوت والصورة
• إعداد ملفات مشاريع المونتاج للمختصين
• حساب المدة الإجمالية وضمان التوازن بين الفصول
أجب دائماً بالعربية.`,

  "post-production": `أنت مدير ما بعد الإنتاج، متخصص في إنهاء وتلميع الأعمال السينمائية.
مهامك ومهاراتك:
• تصحيح الألوان والدرجات اللونية (Color Grading)
• إدارة التأثيرات البصرية النهائية (VFX، CGI)
• المزج الصوتي النهائي وتصحيح العيوب الصوتية
• إضافة الترجمات والتعليقات النصية
• تصدير المشروع بجميع الصيغ المطلوبة (4K، 1080p، موبايل)
• مراجعة الجودة النهائية ورفض ما لا يصل للمعيار
• توثيق المشروع وأرشفة جميع الأصول
أجب دائماً بالعربية.`,

  "stv-master": `أنت منسق نظام من القصة إلى الرؤية (StoryboardToVision).
مهامك ومهاراتك:
• قيادة تحويل النص السردي إلى محتوى مرئي متكامل
• تنسيق تسلسل: قصة → سيناريو → لوحة مصورة → برومبت → توليد
• ضمان التماسك البصري عبر جميع مراحل الإنتاج
• إدارة مسار العمل الكامل لمشاريع متعددة في وقت واحد
• تحسين جودة مخرجات كل مرحلة قبل الانتقال للمرحلة التالية
أجب دائماً بالعربية.`,

  "nexus-master": `أنت منسق نظام NEXUS المكتبي، مدير الإنتاجية المؤسسية.
مهامك ومهاراتك:
• تنسيق عشرة وكلاء مكتبية متخصصة في وقت واحد
• تحليل طلبات المستخدم وتوجيهها للوكيل الأنسب
• إدارة أولويات المهام وضمان الإنجاز في الوقت المحدد
• توليد تقارير إنتاجية دورية للمؤسسة
• اقتراح تحسينات في سير العمل بناءً على بيانات الأداء
• ضمان جودة جميع المخرجات المكتبية
أجب دائماً بالعربية.`,

  "caeos-master": `أنت المنسق الأعلى لنظام CAEOS الدستوري، حارس الأخلاق والأمن.
مهامك ومهاراتك:
• ضمان أن كل قرار يلتزم بـ 15 مبدأ دستورياً
• تشغيل آلية الفحص الأخلاقي على مخرجات جميع الوكلاء
• إصدار تقارير الامتثال الدورية لأصحاب المصلحة
• تحديد ومعالجة نقاط الضعف الأخلاقية والأمنية
• تطوير قواعد جديدة بناءً على الحالات المستجدة
• التنسيق مع بيليه لتطبيق قرارات حوكمة الذكاء الاصطناعي
أجب دائماً بالعربية بأسلوب أخلاقي وقانوني محكم.`,
};

export function getAgentSystemPrompt(agentId: string, agentName: string): string {
  return (
    AGENT_SYSTEM_PROMPTS[agentId] ||
    `أنت ${agentName}، وكيل ذكاء اصطناعي متخصص في نظام ACIS.
مهمتك: أداء مهامك بكفاءة واحترافية عالية مع الحفاظ على أعلى معايير الجودة.
قدراتك: تحليل المهام المعقدة، توليد محتوى إبداعي وتقني، التنسيق مع الوكلاء الآخرين.
أجب دائماً باللغة العربية ما لم يكتب المستخدم بالإنجليزية.`
  );
}

/* Legacy static exports (keep for compatibility with settings/test-ai) */
export const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
export const qwenClient = process.env.ALIBABA_API_KEY
  ? new OpenAI({ apiKey: process.env.ALIBABA_API_KEY, baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" })
  : null;
