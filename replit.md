# ACIS — نظام التكامل السينمائي بالذكاء الاصطناعي

نظام متعدد الوكلاء لإدارة الإنتاج السينمائي من الفكرة حتى التسليم، مع لوحة تحكم مركزية عربية وقيادة ذكاء اصطناعي متكاملة.

## Run & Operate

- `pnpm --filter @workspace/acis-desktop run dev` — واجهة React (PORT مُعيَّن تلقائياً)
- `pnpm --filter @workspace/api-server run dev` — خادم API على المنفذ 5000
- `pnpm run typecheck` — فحص الأنواع لجميع الحزم
- `pnpm run build` — بناء جميع الحزم
- `pnpm --filter @workspace/api-spec run codegen` — توليد hooks و Zod schemas من OpenAPI
- `pnpm --filter @workspace/db run push` — رفع التغييرات للـ DB (dev فقط)

## Stack

- pnpm workspaces، Node.js 24، TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS v4، shadcn/ui، TanStack Query، Wouter
- Backend: Express 5، Node.js built-in `node:sqlite`، Drizzle ORM (sqlite-proxy)
- AI: Qwen (Alibaba MaaS) أساسي، Gemini احتياطي — كلاهما عبر OpenAI-compatible API
- Realtime: WebSocket (ws) للبث والإشعارات
- Codegen: Orval (من OpenAPI spec)

## Where things live

```
artifacts/
  acis-desktop/         ← واجهة المستخدم React
    src/
      contexts/ui-settings.tsx  ← UIContext: الثيم + الشريط المضغوط (localStorage + API)
      components/layout.tsx     ← الشريط الجانبي (يقرأ UIContext)
      pages/
        dashboard.tsx   ← لوحة التحكم الرئيسية
        billie.tsx      ← محادثة بيليه (المشرف الأعلى)
        acis.tsx        ← النظام السينمائي ACIS
        production.tsx  ← خط الإنتاج (قصة → رؤية)
        nexus.tsx       ← NEXUS Office OS
        caeos.tsx       ← CAEOS / SERVX الدستوري
        conversations.tsx ← تواصل الوكلاء
        settings.tsx    ← الإعدادات الشاملة

  api-server/           ← خادم Express 5
    src/
      lib/
        ai.ts           ← توجيه الذكاء الاصطناعي (Qwen أولاً → Gemini احتياط)
        db.ts           ← SQLite عبر node:sqlite
        ws.ts           ← WebSocket broadcast
      routes/
        agents.ts       ← /api/agents (19 وكيل)
        billie.ts       ← /api/billie (محادثة + TTS)
        production.ts   ← /api/production (مشاريع + وظائف توليد)
        settings.ts     ← /api/settings (GET/PUT + test-ai)
        system.ts       ← /api/system (metrics, activity, model-stats)
        nexus.ts        ← /api/nexus
        caeos.ts        ← /api/caeos (score, layers) ⚠ قيد التطوير

packages/
  db/                   ← Drizzle schema (SQLite)
  api-spec/             ← OpenAPI spec → Orval codegen
  api-client-react/     ← React hooks مُوَّلدة تلقائياً
data/
  acis.db               ← قاعدة بيانات SQLite
```

## Architecture decisions

- **SQLite بدلاً من PostgreSQL**: Node.js 24 يدعم `node:sqlite` مدمجاً، مناسب لبيئة Replit بدون إعداد خارجي. Drizzle يستخدم `sqlite-proxy` adapter.
- **Qwen-first routing**: كل مهام الذكاء الاصطناعي تحاول Qwen (Alibaba MaaS) أولاً ثم Gemini احتياطياً. TTS العربية حصرياً عبر Gemini `gemini-2.5-flash-lite`.
- **UIContext للثيم**: الوضع الداكن/الفاتح والشريط المضغوط يُطبَّقان فوراً عبر React Context + localStorage، مع حفظ غير متزامن في قاعدة البيانات.
- **OpenAI-compatible API**: مفتاح Alibaba MaaS يُخزَّن كـ `ALIBABA_API_KEY` (Replit Secret)، ويتصل بـ endpoint مخصص غير DashScope العام.
- **Gemini model**: يعمل فقط `gemini-2.5-flash-lite` على الخطة المجانية — لا تستخدم 2.5-flash أو 2.5-pro.

## Product

- **لوحة تحكم مركزية**: مراقبة 19 وكيلاً، مقاييس النظام، سجل النشاط الفوري
- **بيليه**: المشرف الأعلى — محادثة ذكية مع TTS عربية ودعم صوتي
- **ACIS السينمائي**: إدارة مشاريع الإنتاج الفني مرحلة بمرحلة (سيناريو → لوحة مصورة → صوت → موسيقى → تجميع)
- **NEXUS**: ذكاء مؤسسي لإدارة المكتب والمهام
- **CAEOS/SERVX**: الذكاء الدستوري والحوكمة
- **الإعدادات**: تحكم شامل في نماذج الذكاء الاصطناعي، الوكلاء، قاعدة البيانات، والواجهة

## User preferences

- الواجهة والكود يدعمان العربية RTL كلغة أساسية
- المظهر الداكن افتراضي
- الذكاء الاصطناعي: Qwen أولاً دائماً، Gemini احتياط

## Gotchas

- **ALIBABA_API_KEY**: مفتاح MaaS مخصص، Base URL: `https://ws-twcxat39x22mi7rg.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` — لا يعمل مع DashScope القياسي (401).
- **Gemini**: `gemini-2.5-flash-lite` فقط — غيره إما 404 أو حد RPD منخفض جداً.
- **UIContext**: يجب ربط أي مكوّن يقرأ الثيم أو الشريط بـ `useUI()` وليس CSS مباشر.
- **callAIForTask**: الدالة المعتمدة في production.ts — لا تستخدم `callAI` القديمة (غير مُصدَّرة).
- **CAEOS routes**: `/api/caeos/score` و `/api/caeos/layers` قيد التطوير (404 حالياً).

## Pointers

- انظر skill `pnpm-workspace` لتفاصيل هيكل المونوريبو
- انظر `.agents/memory/MEMORY.md` لقرارات الذكاء الاصطناعي والـ routing
