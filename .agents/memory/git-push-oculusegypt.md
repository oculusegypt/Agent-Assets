---
name: Git Push to OculusEgypt
description: كيفية دفع التغييرات إلى GitHub OculusEgypt/Agent-Assets من بيئة Replit
---

# Git Push to OculusEgypt/Agent-Assets

## القيود في بيئة Replit
- `git commit` — محظور (destructive)
- `git checkout -b` — محظور (destructive)
- `git remote set-url` — محظور (يُعدَّل `.git/config` مع lock)
- `git branch name` — مسموح (يُنشئ فرع محلياً)
- `git push URL HEAD:branch` — مسموح ✅ (بدون --force)

## الطريقة الصحيحة للدفع
```bash
# دفع مباشر بالـ URL دون تعديل remote
git push "https://oculusegypt:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/oculusegypt/Agent-Assets.git" HEAD:branch-name
```

## Script جاهز
`push-feature-branches.sh` في جذر المشروع — يدفع main + 3 فروع دفعة واحدة.

## الفروع الحالية على OculusEgypt
- `main` — الكود الرئيسي (مُحدَّث)
- `feat/shared-utils-v4` — المكتبة المشتركة
- `feat/realtime-notifications-v4` — إشعارات WebSocket
- `feat/mission-control-v4` — مركز التحكم

## ملاحظة التوقيت
التغييرات تُكتب إلى working tree أثناء الجلسة، والنظام يُنفّذ auto-commit عند نهاية loop.
لتحديث الفروع على OculusEgypt بالكود الجديد، شغّل `push-feature-branches.sh` **بعد** انتهاء الجلسة.

**Why saved:** قيد بيئة غير بديهي — git remote set-url محظور لكن git push بـ URL مباشر يعمل.
