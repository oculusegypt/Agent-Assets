# ذاكرة مشروع ACIS — Project Memory

> **آخر تحديث:** 2026-06-04 | **الإصدار الحالي:** v6.0
> هذا الملف يُحدَّث بعد كل جلسة تطوير. يُستخدم كمرجع أسرع من البحث في الكود.

---

## هيكل المشروع (الأدلة الجوهرية)

```
/home/runner/workspace/
├── artifacts/
│   ├── acis-desktop/          ← واجهة React + Vite (PORT تلقائي)
│   │   └── src/
│   │       ├── App.tsx        ← جذر التطبيق + QueryClient + BillieFloat
│   │       ├── lib/
│   │       │   ├── ws-singleton.ts  ← WS وحيد لكل التطبيق (v6)
│   │       │   ├── ai-utils.ts
│   │       │   └── base-url.ts
│   │       ├── hooks/
│   │       │   ├── use-realtime.ts         ← يستخدم ws-singleton
│   │       │   └── use-ws-notifications.ts ← يستخدم ws-singleton
│   │       ├── components/
│   │       │   ├── layout.tsx             ← الشريط الجانبي RTL
│   │       │   ├── billie-float.tsx       ← أيقونة بيليه العائمة (v6)
│   │       │   ├── notifications-panel.tsx
│   │       │   └── command-palette.tsx
│   │       ├── pages/
│   │       │   ├── dashboard.tsx, billie.tsx, acis.tsx, production.tsx
│   │       │   ├── nexus.tsx, caeos.tsx, conversations.tsx
│   │       │   ├── archive.tsx, settings.tsx, mission-control.tsx
│   │       │   └── not-found.tsx
│   │       └── contexts/ui-settings.tsx  ← الثيم + الشريط المضغوط
│   └── api-server/            ← Express 5 (PORT 8080)
│       └── src/
│           ├── lib/
│           │   ├── ai.ts      ← توجيه AI (Qwen أولاً → Gemini)
│           │   ├── db.ts      ← SQLite via node:sqlite
│           │   └── ws.ts      ← WebSocket broadcast
│           └── routes/
│               ├── billie.ts  ← /api/billie (+ web-search في v6)
│               ├── production.ts, agents.ts, settings.ts
│               ├── system.ts, nexus.ts, caeos.ts, conversations.ts
│               └── index.ts
├── packages/
│   ├── db/src/schema/index.ts ← Drizzle schema (SQLite)
│   ├── api-spec/              ← OpenAPI → Orval codegen
│   └── api-client-react/     ← React hooks مُوَّلدة
└── data/acis.db               ← قاعدة البيانات SQLite
```

---

## القرارات التقنية الجوهرية

### 1. WebSocket Singleton (v6)
- **الملف:** `artifacts/acis-desktop/src/lib/ws-singleton.ts`
- **السبب:** قبل v6 كان كل hook يفتح WS خاص به → بطء في التنقل + استهلاك عالٍ
- **الحل:** `wsSingleton` singleton واحد → كل hooks تشترك فيه عبر `addListener()`
- **لا تستخدم:** `new WebSocket()` مباشرة في أي hook جديد

### 2. QueryClient المحسَّن (v6)
- `staleTime: 30_000` — لا إعادة جلب لمدة 30ث
- `refetchOnWindowFocus: false` — منع الجلب عند العودة للنافذة
- `refetchOnMount: false` — منع الجلب عند remount (سبب بطء التنقل الرئيسي)
- `refetchOnReconnect: false`

### 3. نماذج الذكاء الاصطناعي
| TaskType | النموذج الأساسي | الاحتياطي |
|----------|----------------|-----------|
| text_simple | qwen3.5-flash | qwen-flash |
| text_complex | qwen3-max-2026-01-23 | qwen3.7-max |
| text_creative | qwen3-max-2026-01-23 | qwen3.5-397b |
| code | qwen3-coder-480b | qwen3-coder-plus |
| audio_ar | gemini-2.5-flash-preview-tts | — |

- **مهم:** `text_fast` لا يوجد! استخدم `text_simple`
- **Gemini المجاني:** `gemini-2.5-flash-lite` فقط للنص، TTS: `gemini-2.5-flash-preview-tts`

### 4. إضافة أعمدة للـ DB
```typescript
// في startup (src/lib/db.ts) — لا تستخدم migration runner
try { sqlite.exec("ALTER TABLE generation_jobs ADD COLUMN result TEXT") } catch {}
```

### 5. ALIBABA_API_KEY
- مفتاح MaaS مخصص (ليس DashScope العادي)
- Base URL: `https://ws-twcxat39x22mi7rg.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`

---

## الـ API Endpoints الحالية

### /api/billie
| Method | Path | الوصف |
|--------|------|-------|
| GET | /status | حالة بيليه |
| GET | /news | أخبار AI |
| POST | /refresh-news | تحديث الأخبار بالذكاء الاصطناعي |
| POST | /chat | محادثة (غير streaming) |
| POST | /stream | محادثة streaming (SSE) |
| POST | /web-search | بحث DuckDuckGo + ملخص AI (v6) |
| GET | /alerts | التنبيهات |
| POST | /alerts | إنشاء تنبيه |
| GET | /complaints | الشكاوى |
| GET | /agent-code/:id | كود الوكيل |
| POST | /diagnose | تشخيص وكيل |
| POST | /apply-patch | تطبيق تصحيح |
| POST | /tts-chat | توليد صوت TTS |
| POST | /generate-image | توليد صورة |

### /api/production
- GET /projects, POST /projects, DELETE /projects/:id
- POST /projects/:id/generate — بدء توليد مرحلة
- GET /archive — كل المهام المكتملة

---

## تغييرات V6 (2026-06-04)

1. **WS Singleton** — اتصال واحد بدلاً من اتصالات متعددة
2. **QueryClient محسَّن** — `refetchOnMount: false` يحل بطء التنقل
3. **BillieFloat** — أيقونة عائمة للمحادثة السريعة من أي صفحة
4. **Splash Screen** — شاشة تحميل أنيقة بدل الشاشة السوداء
5. **web-search endpoint** — /api/billie/web-search
6. **text_fast → text_simple** — إصلاح bug في billie.ts و nexus.ts

---

## كيف تبدأ العمل في جلسة جديدة

1. اقرأ هذا الملف أولاً (بدلاً من البحث في الكود كله)
2. ابدأ الـ workflows: Backend API + Start application
3. إذا فشل البناء: `pnpm install` ثم أعد تشغيل
4. للإضافة إلى AI routes: عدّل `artifacts/api-server/src/lib/ai.ts`
5. للإضافة لـ DB: أضف `ALTER TABLE` في `db.ts` startup block

---

## الفروع على GitHub (OculusEgypt)

| الفرع | المحتوى |
|-------|---------|
| feat/shared-utils-v4 | shared ai-utils.ts + mission-control |
| feat/realtime-notifications-v4 | WS notifications |
| feat/mission-control-v4 | mission control page |
| feat/session-v6 | جميع تغييرات v6 (الحالي) |
