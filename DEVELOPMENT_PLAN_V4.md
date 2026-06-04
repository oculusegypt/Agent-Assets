# خطة تطوير ACIS v4.0
**الإصدار:** 4.0.0 | **التاريخ:** يونيو 2026

---

## المحاور الثلاثة

```
feat/shared-utils-v4          → مكتبة مشتركة + إزالة التكرار
feat/realtime-notifications-v4 → إشعارات WebSocket فورية
feat/mission-control-v4        → مركز التحكم الموحد (صفحة جديدة)
```

---

## المحور 1: `feat/shared-utils-v4`
**الهدف:** إزالة التكرار وتحسين جودة الكود

### الملفات
- `src/lib/ai-utils.ts` — الثوابت والدوال المشتركة
- تحديث: `dashboard.tsx`, `conversations.tsx`, `acis.tsx`, `archive.tsx`

### ما يُنجز
1. ثوابت `SYSTEM_COLORS`, `STATUS_COLORS`, `STATUS_DOT` موحدة
2. دوال: `isArabic()`, `formatDuration()`, `formatTokens()`, `parseSections()`
3. Hook مشترك `useApiBase()` بديلاً عن `const BASE = ...` في كل ملف
4. Code splitting: `React.lazy()` لكل صفحة
5. `formatRelativeTime()` للتواريخ النسبية العربية

---

## المحور 2: `feat/realtime-notifications-v4`
**الهدف:** المستخدم يعرف لحظة اكتمال أي مهمة أينما كان في التطبيق

### الملفات
- `src/hooks/use-ws-notifications.ts` — hook الإشعارات
- `src/components/layout.tsx` — badge عداد المهام الجارية
- `src/components/job-notification-provider.tsx` — مزود الإشعارات العالمي

### ما يُنجز
1. اتصال WebSocket عالمي في مستوى التطبيق
2. toast إشعار عند اكتمال/فشل أي مهمة إنتاج
3. badge رقمي على رابط "من القصة للرؤية" يُظهر عدد المهام الجارية
4. إشعار صوتي اختياري (Web Audio API)
5. سجل إشعارات قابل للمشاهدة في NotificationsPanel

---

## المحور 3: `feat/mission-control-v4`
**الهدف:** لوحة تحكم موحدة تجمع كل المهام الجارية في الأنظمة المختلفة

### الملفات
- `src/pages/mission-control.tsx` — الصفحة الجديدة
- `src/components/layout.tsx` — إضافة الرابط للقائمة
- `artifacts/api-server/src/routes/system.ts` — endpoint جديد `/api/system/jobs`

### ما يُنجز
1. عرض موحد لكل المهام (production + ACIS + NEXUS)
2. Timeline فوري للمهام مرتبة بالوقت
3. إحصائيات: مهام ناجحة/فاشلة/جارية/معلقة
4. تصفية سريعة بالنظام (ACIS/NEXUS/Production)
5. إلغاء المهام العالقة بضغطة واحدة
6. هيت ماب نشاط المهام (24 ساعة)

---

## الجدول الزمني

| المحور | الجهد | الأولوية |
|--------|-------|---------|
| shared-utils-v4 | 2 ساعة | عالية — أساس للباقي |
| realtime-notifications-v4 | 3 ساعة | عالية — تأثير مباشر |
| mission-control-v4 | 4 ساعة | عالية — ميزة جديدة |

**الإجمالي:** ~9 ساعات تطوير فعلي

---

## معايير الاكتمال

- [ ] `shared-utils-v4`: صفر تكرار في SYSTEM_COLORS عبر الصفحات
- [ ] `shared-utils-v4`: Lazy loading لكل صفحة (chunk الأولي < 500KB)
- [ ] `realtime-notifications-v4`: toast يظهر في < 2 ثانية من اكتمال المهمة
- [ ] `realtime-notifications-v4`: badge يُحدَّث لحظياً
- [ ] `mission-control-v4`: يعرض مهام من 3 أنظمة مختلفة
- [ ] `mission-control-v4`: التحديث التلقائي كل 5 ثوانٍ
