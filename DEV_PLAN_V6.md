# DEV_PLAN_V6 — خطة تطوير ACIS الإصدار السادس

> **التاريخ:** 2026-06-04  
> **الحالة:** ✅ منجز  
> **الفرع:** feat/session-v6

---

## ✅ المنجز في V6

### T001 — WebSocket Singleton (إصلاح حرج)
- إنشاء `src/lib/ws-singleton.ts` — اتصال WS وحيد لكل التطبيق
- إعادة كتابة `use-realtime.ts` و `use-ws-notifications.ts` للاعتماد على Singleton
- تحديث `notifications-panel.tsx` للاعتماد على Singleton
- إصلاح `window.location.hash` → `wouter navigate` في toast actions
- إضافة `refetchOnWindowFocus: false` و `refetchOnMount: false` للـ QueryClient
- **النتيجة:** التنقل بين الصفحات فوري الآن بدلاً من إعادة الجلب في كل مرة

### T002 — إصلاح الشاشة السوداء
- تحديث `index.html`: إضافة `class="dark"` على `<html>`
- CSS inline للخلفية الداكنة مباشرة (قبل تحميل React)
- Splash screen أنيق مع loading animation
- `window.__ACIS_READY__()` لإزالة الـ splash عند جاهزية React

### T003 — بحث الويب لبيليه
- Backend: `POST /api/billie/web-search` — DuckDuckGo API + AI summary
- إصلاح bug: `text_fast` → `text_simple` في `billie.ts` و `nexus.ts`

### T004 — الأيقونة العائمة لبيليه
- إنشاء `src/components/billie-float.tsx`
- نافذة محادثة مضمّنة (460px) مع streaming-style أنيق
- TTS: زر استماع على كل رسالة من بيليه
- لا تظهر في صفحة `/billie` (تجنب التكرار)
- تُضاف في `App.tsx` خارج الـ Layout

### T005 — إصلاح بطء التنقل
- السبب الجذري: `refetchOnMount: true` كان القيمة الافتراضية → كل صفحة تُعيد جلب كل شيء
- الحل: `refetchOnMount: false` + `staleTime: 30_000` + WS singleton
- النتيجة: التنقل شبه فوري مع بيانات طازجة من WS

### T006 — ذاكرة المشروع
- إنشاء `PROJECT_MEMORY.md` في جذر المشروع
- تحديث `.agents/memory/MEMORY.md`
- فرع GitHub: `feat/session-v6`

---

## 🎯 خطة V7 (المقترح للجلسة القادمة)

### P1 — AI Director (أولوية عالية)
- زر "تشغيل جميع المراحل" في صفحة الإنتاج
- تشغيل المراحل تسلسلياً: script → storyboard → audio → images → music → assembly
- progress bar حي مع WS events
- Backend: `POST /api/production/projects/:id/auto-run`

### P2 — Export Center
- صفحة تصدير موحّدة للمشاريع
- تصدير ZIP يحتوي: السيناريو، اللوحة المصورة، الصور، الصوت
- تصدير PDF للتقارير
- Backend: `POST /api/production/projects/:id/export`

### P3 — Enhanced Analytics Dashboard
- رسوم بيانية أكثر (Recharts): استخدام الرموز عبر الزمن، توزيع المشاريع
- مقارنة الموديلات Qwen vs Gemini
- تقارير أسبوعية تلقائية

### P4 — Billie Web Search Tab (Frontend)
- تبويب "بحث" في صفحة بيليه
- يستدعي `/api/billie/web-search`
- عرض النتائج مع روابط + ملخص AI

### P5 — Enhanced Code Surgery
- CodeMirror editor مضمّن في تبويب Surgery
- diff view محسّن (قبل/بعد جنباً إلى جنب)
- زر حفظ مباشر بدون refresh

### P6 — Mission Control V2
- فلترة المهام الجارية حسب النوع والوكيل
- إلغاء مهمة بالنقر
- تاريخ المهام المنجزة خلال اليوم

---

## ملاحظات تقنية

- **TaskTypes المتاحة:** `text_simple`, `text_complex`, `text_creative`, `code`, `code_fast`, `vision`, `translate`, `reasoning`, `orchestration`, `audio_ar`
- **⚠️ لا يوجد `text_fast`** — استخدم `text_simple`
- **WS singleton:** أي hook جديد يحتاج WS يستخدم `wsSingleton.addListener()` فقط
- **Gemini:** `gemini-2.5-flash-lite` للنص، `gemini-2.5-flash-preview-tts` للصوت
