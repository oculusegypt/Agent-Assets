---
name: ACIS Session 4 Improvements
description: التحسينات المُنجزة في الجلسة الرابعة — مكتبة مشتركة، إشعارات WS، مركز التحكم، lazy loading
---

# ACIS Session 4 Improvements

## ما أُنجز

### المحور 1: feat/shared-utils-v4
- `artifacts/acis-desktop/src/lib/ai-utils.ts` — مكتبة الأدوات المشتركة:
  - `SYSTEM_COLORS`, `STATUS_DOT`, `STATUS_BADGE`, `PROVIDER_COLORS`, `PHASE_COLORS`
  - `isArabic()`, `formatDuration()`, `formatTokens()`, `formatNumber()`, `formatRelativeTime()`, `parseSections()`
  - `BASE`, `API_BASE` constants
  - `phaseTextColor()`, `phaseBgColor()`, `phaseBorderColor()`

### المحور 2: feat/realtime-notifications-v4
- `artifacts/acis-desktop/src/hooks/use-ws-notifications.ts`:
  - يستمع لـ `job_completed`, `job_failed`, `job_started`
  - يعرض Sonner toast عند اكتمال/فشل المهمة
  - `useRunningJobsCount()` hook للعداد العالمي
  - `useJobNotifications()` hook لسجل الإشعارات
- `artifacts/api-server/src/lib/ws.ts`: أُضيف `job_started`, `job_completed`, `job_failed` لـ WsEventType
- `artifacts/api-server/src/routes/production.ts`: broadcast عند بدء/اكتمال/فشل المهمة
- `artifacts/acis-desktop/src/hooks/use-realtime.ts`: mapping لـ events الجديدة
- `artifacts/acis-desktop/src/components/layout.tsx`:
  - استيراد `Crosshair` من lucide
  - استيراد `useRunningJobsCount`
  - badge عداد المهام على رابطَي مركز التحكم وخط الإنتاج
  - version bump: v3.0 → v4.0

### المحور 3: feat/mission-control-v4
- `artifacts/acis-desktop/src/pages/mission-control.tsx` — صفحة جديدة:
  - يجمع مهام production + nexus في عرض موحد
  - هيت ماب نشاط 24 ساعة
  - تصفية بالحالة وبالنظام
  - تحديث تلقائي كل 5 ثوانٍ (يمكن إيقافه)
  - Job rows قابلة للتوسيع (عرض النتيجة أو الخطأ)
- `artifacts/acis-desktop/src/App.tsx`:
  - `React.lazy()` لجميع الصفحات (code splitting)
  - `Suspense` مع `PageLoader` كـ fallback
  - `useWsNotifications()` في `RealtimeProvider`
  - Route جديد: `/mission-control`

## ملاحظات أساسية
- `use-ws-notifications.ts` يُضاف مرة واحدة فقط في `RealtimeProvider` بـ App.tsx
- الـ module-level stores (`notifStore`, `runningCount`) تُحدَّث عالمياً عبر listeners pattern
- `parseSections()` في ai-utils.ts تستخدم `## heading` syntax لتقطيع نص AI

**Why saved:** قرارات بنيوية دائمة لا يمكن استنتاجها من الكود وحده.
