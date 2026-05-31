# ACIS — خطة التطوير الثوري الشاملة (الإصدار الرابع)

**تاريخ:** 31 مايو 2026 | **المرحلة:** الجلسة الرابعة — مراجعة + تنفيذ ثوري

---

## أولاً: تقرير المراجعة الشاملة

### إحصائيات الكود
| الملف | السطور | الحجم | الصحة |
|-------|---------|-------|-------|
| `billie.tsx` | 1649 | 97KB | 🔴 ضخم جداً |
| `settings.tsx` | 1156 | 68KB | ✅ (تم إصلاح JSON) |
| `production.tsx` | 927 | 49KB | ✅ |
| `acis.tsx` | 743 | 35KB | ✅ |
| `dashboard.tsx` | 451 | 25KB | ✅ |
| `nexus.tsx` | 391 | 21KB | 🟡 (قائمة بدون Kanban) |
| `conversations.tsx` | 362 | 17KB | ✅ |
| `caeos.tsx` | 330 | 22KB | 🟡 (جدول complaints مهمل) |

### إحصائيات قاعدة البيانات
| الجدول | السجلات | الحالة |
|--------|---------|-------|
| `agents` | 19 | ✅ |
| `agent_executions` | 12 | ✅ |
| `projects` | 2 | ✅ (ابو الهول + احمس) |
| `conversations` | 1 | ✅ |
| `messages` | 0 | ⚠️ فارغ |
| `nexus_tasks` | 0 | ⚠️ فارغ |
| `complaints` | ? | 🔴 **لا واجهة مستخدم** |
| `agent_patches` | ? | 🔴 **لا واجهة مستخدم** |
| `system_settings` | 35 | ✅ |

---

## ثانياً: الثغرات الحرجة المكتشفة

| # | الثغرة | الخطورة | التأثير |
|---|--------|---------|---------|
| **C1** | **لا Error Boundary** — خطأ JSX يقتل الصفحة كاملاً | 🔴 حرج | المستخدم يرى شاشة بيضاء |
| **C2** | **جدول `complaints` مهمل** — موجود في DB بدون UI | 🔴 حرج | ميزة كاملة مخفية |
| **C3** | **لا تفاصيل الوكيل** — لا يمكن النقر لرؤية الإحصائيات | 🟡 متوسط | معلومات مهدرة |
| **C4** | **NEXUS = قائمة عادية** — بدون Kanban أو تصنيف بصري | 🟡 متوسط | ضعف UX |
| **C5** | **billie.tsx ضخم** — 1649 سطر صعب الصيانة | 🟡 متوسط | مخاطر bugs |
| **C6** | **StatCard مكرر** في 3 صفحات | 🟢 منخفض | ديون تقنية |
| **C7** | **agent_patches بلا UI** — لا تاريخ تصحيح بيليه | 🟡 متوسط | معلومات مهدرة |
| **C8** | **API `/agents/:id`** مفقود | 🟡 متوسط | لا endpoint للوكيل الفردي |

---

## ثالثاً: الاقتراحات الثورية — الجلسة الرابعة

### 🚀 Tier 1 — مُنجزة في هذه الجلسة

| # | التحسين | الأثر | التقنية |
|---|---------|-------|---------|
| **T4.1** | **Error Boundary شاملة** | يمنع الشاشة البيضاء | React Error Boundary class |
| **T4.2** | **Agent Detail Sheet** | رؤية كاملة لكل وكيل | shadcn Sheet + backend route |
| **T4.3** | **NEXUS Kanban Board** | إدارة مهام بصرية ثورية | 4 أعمدة drag-free Kanban |
| **T4.4** | **Complaints Manager UI** | ميزة جديدة كاملة | تبويب جديد في CAEOS |
| **T4.5** | **Backend `/api/agents/:id`** | بيانات وكيل تفصيلية | Express route جديد |
| **T4.6** | **Backend `/api/complaints`** | CRUD كامل للشكاوى | Express route جديد |
| **T4.7** | **Agent Patches History** | تاريخ تصحيح بيليه | تبويب جديد في Billie |
| **T4.8** | **Dashboard Agent Leaderboard** | أفضل/أسوأ وكلاء | جدول قابل للفرز |

### 🚀 Tier 2 — الجلسة القادمة

| # | التحسين |
|---|---------|
| T4.9 | Production Phase Timeline — خط زمني بصري |
| T4.10 | Split billie.tsx — BillieChat + BillieControl |
| T4.11 | Shared StatCard component |
| T4.12 | WebSocket تلقائي في Dashboard (بدل polling) |

---

## رابعاً: التنفيذ الفعلي — الجلسة الرابعة ✅

### [T4.1] Error Boundary
- `artifacts/acis-desktop/src/components/error-boundary.tsx`
- يلتقط كل خطأ JSX · يعرض رسالة أنيقة + زر "إعادة المحاولة" + زر "الصفحة الرئيسية"
- يُغلّف كل route في `App.tsx`

### [T4.2] Agent Detail Sheet
- `artifacts/acis-desktop/src/components/agent-detail-sheet.tsx`
- يُفتح بالنقر على أي وكيل في Dashboard أو أي مكان
- يعرض: الإحصائيات · آخر 10 تنفيذات · قدرات الوكيل · صحة الوكيل

### [T4.3] NEXUS Kanban Board
- تحويل nexus.tsx من قائمة إلى Kanban بـ4 أعمدة
- أعمدة: معلّق (pending) · جارٍ (running) · مكتمل (completed) · فشل (failed)
- بطاقات ملونة بالأولوية · عداد في كل عمود

### [T4.4] Complaints Manager
- Backend: `/api/complaints` (GET, POST, PATCH /:id/resolve, DELETE /:id)
- Frontend: تبويب "الشكاوى" في صفحة CAEOS
- يعرض: نوع الشكوى · الحالة · الوكيل المُعيَّن · أزرار الحل

### [T4.5-6] Backend Routes
- `GET /api/agents/:id` — تفاصيل وكيل فردي مع آخر 10 تنفيذات
- `GET/POST /api/complaints` — CRUD كامل

### [T4.7] Agent Patches History (في Billie)
- تبويب جديد "سجل التصحيحات" في صفحة Billie
- يعرض كل patch بيليه قامت بها: الملف · التغيير · التاريخ

### [T4.8] Dashboard Leaderboard
- جدول مرتب: الوكيل · التنفيذات · معدل النجاح · متوسط الوقت · الرموز
- أيقونة 🏆 لأفضل وكيل

---

## خامساً: مقاييس النجاح

| المقياس | قبل J4 | بعد J4 |
|---------|--------|--------|
| حماية من الأعطال | 0% | 100% |
| الميزات المخفية | complaints + patches | مرئية كاملاً |
| إدارة NEXUS | قائمة | Kanban بصري |
| معلومات الوكيل | اسم فقط | صفحة تفصيل كاملة |
| Backend routes | لا /agents/:id | ✅ |

---

*الإصدار: 4.0 | الجلسة: الرابعة | 31 مايو 2026*
