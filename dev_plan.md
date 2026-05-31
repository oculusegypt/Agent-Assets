# ACIS — خطة التطوير الثوري الشاملة (الإصدار الثالث)

**تاريخ المراجعة:** 31 مايو 2026 | **المُقيِّم:** Replit Agent | **الحالة:** قيد التنفيذ ✅

---

## أولاً: تقرير المراجعة الشاملة — الجلسة الثالثة

### الحالة الراهنة للنظام
| المكوّن | السطور | الحجم | الصحة |
|---------|---------|-------|-------|
| `dashboard.tsx` | 451 | 25KB | ✅ ممتاز |
| `billie.tsx` | 1649 | 97KB | ⚠️ ضخم جداً |
| `acis.tsx` | 743 | 35KB | ✅ SSE streaming ✅ |
| `production.tsx` | 914 | 48KB | ✅ |
| `nexus.tsx` | 379 | 20KB | ✅ |
| `caeos.tsx` | 326 | 21KB | ✅ |
| `conversations.tsx` | 352 | 17KB | ✅ |
| `archive.tsx` | 539 | 28KB | ✅ |
| `settings.tsx` | 1146 | 67KB | 🔴 أعطال JSON |
| Backend routes | 9 ملفات | 9565 سطر | ✅ |

### إحصائيات قاعدة البيانات
- 19 وكيل ذكاء اصطناعي
- 12 تنفيذ (avg 53s — بطيء)
- 35 إعداد نظام
- 96 سجل نشاط

---

## ثانياً: الثغرات الحرجة المكتشفة

| # | الثغرة | الأثر | الخطورة |
|---|--------|-------|---------|
| C1 | **`settings.tsx` — 4 fetch بلا try/catch** | تعطّل الصفحة كاملاً عند استجابة فارغة | 🔴 حرج |
| C2 | **لا إشعارات (Toast)** — كل العمليات صامتة | مستخدم لا يعرف إذا نجح أو فشل | 🔴 حرج |
| C3 | **لا بحث عالمي** — لا Cmd+K | إنتاجية محدودة جداً | 🟡 متوسط |
| C4 | **لا اختصارات لوحة مفاتيح** — لا تنقّل سريع | وقت ضائع | 🟡 متوسط |
| C5 | **لا endpoint بحث في الـ backend** | لا يمكن البحث عبر API | 🟡 متوسط |
| C6 | **billie.tsx 1649 سطر** — صعب الصيانة | مخاطر bugs مستقبلية | 🟡 متوسط |
| C7 | **avg_response_ms = 53244** — 53 ثانية | تجربة مستخدم سيئة | 🟡 مراقبة |

---

## ثالثاً: الاقتراحات الثورية — الجلسة الثالثة

### 🚀 Tier 1 — تُنفَّذ فوراً (هذه الجلسة)

| # | التحسين | التقنية | التأثير |
|---|---------|---------|---------|
| T3.1 | **إصلاح settings.tsx** — safe JSON parsing | try/catch + r.text() | إيقاف الأعطال |
| T3.2 | **إشعارات Sonner Toast** — لكل العمليات | `sonner` (مثبّت بالفعل!) | تجربة مستخدم |
| T3.3 | **Command Palette Cmd+K** — بحث عالمي | `command.tsx` (موجود!) | إنتاجية × 2 |
| T3.4 | **اختصارات لوحة مفاتيح** — Cmd+1-9 | useEffect+keydown | تنقّل فوري |
| T3.5 | **Backend /api/search** — بحث موحّد | SQLite LIKE query | بنية تحتية |
| T3.6 | **Toast على كل الصفحات** — nexus, conv, prod, caeos | toast.success/error | ثقة المستخدم |

### 🚀 Tier 2 — الأسبوع القادم

| # | التحسين |
|---|---------|
| T3.7 | Error Boundary — لا أعطال JSX تُخفي الصفحة |
| T3.8 | Agent Detail Page — `/agents/:id` |
| T3.9 | Real-time Job Progress — SSE لمهام Production |
| T3.10 | Billie Code Surgeon SSE — streaming للتشخيص |

### 🚀 Tier 3 — مستقبلي

| # | التحسين |
|---|---------|
| T3.11 | Dark/Light Mode Toggle |
| T3.12 | Export PDF للتقارير |
| T3.13 | Drag & Drop في ACIS Pipeline |
| T3.14 | WebSocket بدل polling |

---

## رابعاً: سجل الجلسات السابقة

### الجلسة الأولى ✅ (مكتملة)
- [x] SSE Streaming في المحادثات
- [x] ReactMarkdown في المحادثات والأرشيف
- [x] رسوم بيانية Recharts في لوحة القيادة
- [x] token-quotas + analytics endpoints
- [x] إصلاح assets_generated المزيّف
- [x] 6 قوالب إنتاج

### الجلسة الثانية ✅ (مكتملة)
- [x] SSE حقيقي في Billie backend
- [x] ReactMarkdown في CAEOS + NEXUS
- [x] لوحة قادة الوكلاء في Dashboard
- [x] تصدير المحادثات كـ Markdown
- [x] endpoint استرداد NEXUS العالقة
- [x] استرداد تلقائي عند startup

### الجلسة الثالثة ✅ (قيد التنفيذ)
- [x] إصلاح settings.tsx — safe JSON parsing
- [x] Sonner Toast — إشعارات على جميع الصفحات
- [x] Global Command Palette — Cmd+K
- [x] اختصارات لوحة مفاتيح (Cmd+1-9)
- [x] Backend /api/system/search endpoint
- [x] Toast في nexus, conversations, production, caeos

---

## خامساً: مقاييس النجاح

| المقياس | قبل J3 | بعد J3 |
|---------|--------|--------|
| أعطال settings.tsx | يتعطّل | لا يتعطّل |
| إشعارات المستخدم | 0% | 100% العمليات |
| وقت التنقّل بين الصفحات | 5-10 نقرات | Cmd+K في ثانية |
| البحث العالمي | ❌ | ✅ |
| اختصارات لوحة المفاتيح | ❌ | Cmd+1-9 |

---

*الإصدار: 3.0 | آخر تحديث: 31 مايو 2026*
