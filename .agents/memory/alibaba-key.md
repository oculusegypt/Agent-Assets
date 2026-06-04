---
name: Alibaba Key vs DashScope
description: مفتاح Alibaba هو sk- مع endpoint MaaS مخصص — يعمل مع compatible-mode/v1 على نفس الدومين.
---

## الموقف الصحيح (مُحدَّث)
- `api_key.alibaba` = `sk-5197fd58bb1e45158b739f3166169310` — مفتاح sk- صالح لبيئة MaaS.
- endpoint الصحيح: `https://ws-twcxat39x22mi7rg.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- هذا الـ endpoint يدعم OpenAI-compatible API بنفس تنسيق DashScope تماماً.
- DashScope العام (`https://dashscope.aliyuncs.com/compatible-mode/v1`) يُعيد 401 لأن المفتاح مرتبط بالـ workspace المخصص.

**Why:** بيئة MaaS تُعطي endpoint مخصصاً per-workspace يستخدم نفس صيغة `sk-` لكنه مقيَّد بالـ workspace.

**How to apply:**
- لا تُبدِّل endpoint إلى DashScope العام إذا كان المستخدم يملك مفتاح MaaS workspace.
- `seed-quotas` الآن آمن: لا يُعيد الكتابة إذا كان endpoint موجوداً في DB.
- للتحقق: `GET /api/settings/api-keys` يُعيد `{"alibaba":{"configured":true,"source":"db"}}`.
- اختبار الاتصال: `POST /api/settings/test-ai {"provider":"qwen"}` → يجب أن يُعيد `success: true`.
