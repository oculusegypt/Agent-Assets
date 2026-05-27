# خطة التطوير الشاملة — مركز قيادة ACIS
## من النموذج الأولي إلى النظام الحقيقي الكامل

> **الأولوية:** تطبيق عملي متدرج — كل مرحلة تُنتج قيمة حقيقية قابلة للاختبار  
> **المبدأ:** لا بيانات مزيفة، لا ردود محفوظة، لا عمليات وهمية

---

## المرحلة الأولى: الأساس الحقيقي (فوري — أسبوع واحد)
**الهدف:** جعل الوكلاء يفكرون فعلاً باستخدام Gemini

### 1.1 — تكامل Gemini AI في كل وكيل

**الإجراء الفوري:**
```typescript
// في مسار agent execute:
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { role: "user", parts: [{ text: buildAgentPrompt(agent, userInput) }] }
  ],
  config: { maxOutputTokens: 8192 }
});
```

**برومبت نظام مخصص لكل وكيل:**
- مؤلف القصة → خبير في كتابة السيناريو العربي، يعرف بنية 3 فصول
- عين الصدق → محقق حقائق، يطرح أسئلة للتحقق من كل ادعاء
- المخرج → متخصص في الإخراج السينمائي، يفكر بالصورة

**المخرج:** كل محادثة مع أي وكيل تستخدم Gemini حقيقياً.

---

### 1.2 — محادثات مع ذاكرة سياق حقيقية

**حالياً:** كل رسالة معزولة  
**المطلوب:** يرسل النظام كل تاريخ المحادثة إلى Gemini كـ context

```typescript
const history = await db.select().from(messagesTable)
  .where(eq(messagesTable.conversation_id, conversationId));

const contents = history.map(m => ({
  role: m.role === "assistant" ? "model" : "user",
  parts: [{ text: m.content }]
}));
```

---

### 1.3 — الواجهة عربية بالكامل (RTL)

**التغييرات المطلوبة:**
- إضافة `dir="rtl"` على `<html>` والعناصر العربية
- ترجمة كل نصوص التنقل والعناوين
- الحفاظ على LTR للكود والمعرّفات التقنية
- خط عربي احترافي: Cairo أو Tajawal

---

## المرحلة الثانية: الإنتاج الحقيقي (أسبوعان)
**الهدف:** توليد أصول حقيقية — نص، صورة، صوت

### 2.1 — توليد السيناريو الحقيقي

**التسلسل:**
1. المستخدم يدخل فكرة المشروع
2. مؤلف القصة (Gemini) يولد سيناريو كامل بتنسيق JSON منظم
3. يُحفظ السيناريو في جدول `scripts` الجديد في قاعدة البيانات
4. تقسيم المشاهد يقرأ السيناريو ويولد JSON لكل مشهد

**هيكل JSON للمشهد:**
```json
{
  "scene_number": 1,
  "location": "بغداد العباسية — بيت الحكمة",
  "time": "فجر",
  "characters": ["الخوارزمي", "تلميذه"],
  "action": "يشرح الخوارزمي معادلة رياضية...",
  "dialogue": [...],
  "visual_mood": "دافئ، ذهبي، ضباب الصباح",
  "camera": "لقطة قريبة تتسع تدريجياً"
}
```

### 2.2 — توليد الصور عبر Fal.ai (مجاني جزئياً)

```typescript
// باستخدام FLUX.1 Schnell عبر Fal.ai
const result = await fal.subscribe("fal-ai/flux/schnell", {
  input: { prompt: imagePrompt, image_size: "landscape_16_9" }
});
// حفظ الرابط في جدول generation_jobs
```

**البديل المجاني:** Gemini Flash Image (متوفر عبر Replit AI Integrations)

### 2.3 — توليد الصوت العربي عبر HuggingFace

```typescript
// Kokoro TTS مجاني عبر HuggingFace Inference
const audio = await fetch(
  "https://api-inference.huggingface.co/models/hexgrad/Kokoro-82M",
  { method: "POST", body: JSON.stringify({ inputs: arabicText }) }
);
```

### 2.4 — تخزين الأصول المولّدة

إضافة جدول `generated_assets`:
```sql
CREATE TABLE generated_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_id TEXT,
  type TEXT NOT NULL, -- image, video, audio, script
  url TEXT,
  b64_data TEXT,
  prompt TEXT,
  model_used TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## المرحلة الثالثة: ذكاء بيليه الحقيقي (أسبوع ثالث)

### 3.1 — تحليل بيليه الحقيقي

بدلاً من توصيات ثابتة:
```typescript
const analysisPrompt = `
أنت بيليه، المشرف الأعلى لنظام ACIS. 
بيانات النظام الحالية:
- عدد الوكلاء: ${agents.length} | المتصلون: ${onlineCount}
- التنبيهات النشطة: ${alerts.map(a => a.title).join(', ')}
- المشاريع الجارية: ${projects.filter(p => p.status !== 'completed').length}
- نقاط الصحة: ${healthScore}%

قم بتحليل شامل وأعط توصيات محددة وقابلة للتنفيذ.
`;

const analysis = await ai.models.generateContent({
  model: "gemini-2.5-pro",
  contents: [{ role: "user", parts: [{ text: analysisPrompt }] }]
});
```

### 3.2 — أخبار الذكاء الاصطناعي الحقيقية

```typescript
// جلب أخبار من RSS feeds مجانية
const feeds = [
  "https://feeds.feedburner.com/oreilly/radar",
  "https://blog.google/technology/ai/rss/",
  "https://www.anthropic.com/rss.xml"
];
// ثم Gemini يلخص ويترجم للعربية
```

---

## المرحلة الرابعة: NEXUS الحقيقي (أسبوع رابع)

### 4.1 — معالجة الوثائق الحقيقية

```typescript
// رفع ملف → قراءة نص → Gemini يحلل
app.post('/nexus/tasks/process-document', upload.single('file'), async (req) => {
  const text = await extractText(req.file); // pdf-parse أو mammoth
  const analysis = await gemini.generateContent({
    contents: [{ role: "user", parts: [{
      text: `حلل هذا المستند وأعط: ملخصاً، نقاط العمل، القرارات المهمة:\n${text}`
    }]}]
  });
});
```

### 4.2 — البحث الحقيقي

```typescript
// استخدام Tavily API (مجاني بحد معين)
const searchResults = await tavily.search(query, { searchDepth: "advanced" });
const synthesis = await gemini.generateContent({
  contents: [{ role: "user", parts: [{
    text: `بناءً على هذه النتائج، أعد تقرير بحثي منظم:\n${JSON.stringify(searchResults)}`
  }]}]
});
```

---

## المرحلة الخامسة: CAEOS الحقيقي (مستمر)

### 5.1 — تطبيق 3 طبقات أساسية حقيقية

**الطبقة 1: الأخلاق (Ethics Gate)**
```typescript
// قبل أي تنفيذ لوكيل
const ethicsCheck = await gemini.generateContent({
  contents: [{ role: "user", parts: [{
    text: `هل هذا الطلب آمن وأخلاقي؟ "${userInput}" - أجب بـ YES أو NO ثم السبب.`
  }]}]
});
if (ethicsCheck.includes("NO")) throw new Error("طلب غير مقبول");
```

**الطبقة 2: الأمان (Security Gate)**
```typescript
// التحقق من المدخلات: SQL injection, prompt injection, XSS
function sanitizeInput(input: string): string {
  // تنظيف المدخلات من أي هجمات محتملة
}
```

**الطبقة 3: الشفافية (Transparency Log)**
```typescript
// تسجيل كل قرار وكيل مع السياق والسبب
await db.insert(transparencyLogTable).values({
  agent_id, decision, reasoning, user_input, output, timestamp
});
```

---

## المرحلة السادسة: التحسينات المتقدمة (مستمر)

### 6.1 — الذاكرة الدلالية (pgvector)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE agents ADD COLUMN embedding vector(1536);
-- البحث بالمعنى وليس بالكلمات المحددة
```

### 6.2 — WebSocket للتحديثات الفورية
```typescript
// تحديث حالة الإنتاج في الوقت الفعلي
io.emit('production_progress', { projectId, phase, progress });
```

### 6.3 — نظام الإشعارات الذكي
- بيليه يرسل إشعاراً عند اكتمال كل مشهد
- تنبيه عند اكتشاف مشكلة في أي وكيل
- تقرير يومي تلقائي

### 6.4 — واجهة عرض الأصول
- معرض الصور المولّدة لكل مشروع
- مشغل الصوت للتعليق الصوتي المولّد
- مشاهد فيديو مع معلومات الإنتاج

---

## جدول الأولويات

| الأولوية | المهمة | الجهد | الأثر |
|----------|--------|-------|-------|
| 🔴 1 | Gemini في جميع المحادثات | 1 يوم | تحويل كامل |
| 🔴 2 | الواجهة بالعربية RTL | 1 يوم | تجربة مستخدم جذرية |
| 🔴 3 | توليد السيناريو الحقيقي | 2 أيام | القيمة الأساسية |
| 🟠 4 | توليد الصور (Gemini Flash) | 1 يوم | قيمة مرئية |
| 🟠 5 | تحليل بيليه الحقيقي | 1 يوم | ذكاء إشرافي |
| 🟠 6 | معالجة المستندات | 2 أيام | قيمة NEXUS |
| 🟡 7 | التوليد الصوتي | 1 يوم | اكتمال الإنتاج |
| 🟡 8 | CAEOS 3 طبقات | 2 أيام | الحوكمة |
| 🟡 9 | WebSocket | 1 يوم | تجربة حية |
| 🟢 10 | pgvector ذاكرة دلالية | 3 أيام | ذكاء متقدم |

---

## المتطلبات التقنية

### APIs المجانية المتاحة:
- ✅ **Gemini Flash** — عبر Replit AI Integrations (مجاني)
- ✅ **Gemini Flash Image** — توليد صور (مجاني)
- ✅ **HuggingFace Inference API** — Kokoro TTS، MusicGen (مجاني بحد)
- ✅ **FFmpeg** — تجميع الفيديو (مجاني ومفتوح المصدر)

### APIs تتطلب مفتاح:
- 💰 **Replicate API** — FLUX Pro، Wan Video (مدفوع)
- 💰 **Fal.ai** — توليد فيديو (مدفوع لكن رخيص)
- 💰 **ElevenLabs** — TTS عالي الجودة (نسخة مجانية محدودة)
- 💰 **Tavily** — بحث ويب (نسخة مجانية متاحة)

---

## مقياس النجاح

النظام يُعتبر "حقيقياً" عندما:

1. ✅ يمكن إدخال فكرة فيلم بالعربية → الحصول على سيناريو كامل خلال دقيقتين
2. ✅ يمكن توليد صورة لأي مشهد بضغطة زر وعرضها في الواجهة
3. ✅ يمكن محادثة أي وكيل وإدراك أنه يفهم ويفكر حقاً
4. ✅ بيليه يقدم تحليلاً مختلفاً في كل مرة بناءً على بيانات حقيقية
5. ✅ الواجهة كلها بالعربية مع RTL صحيح

---

*— خطة التطوير الرسمية، بيليه المشرف الأعلى، مايو 2026*
