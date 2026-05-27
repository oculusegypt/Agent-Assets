---
name: Alibaba Key vs DashScope
description: المفتاح المخزَّن مفتاح MaaS لا يعمل مع DashScope — سبب fallback إلى Gemini.
---

## الموقف
- `api_key.alibaba` في قاعدة البيانات = مفتاح بيئة MaaS خاص بـ endpoint مخصص.
- endpoint المخصص: `ws-twcxat39x22mi7rg.ap-southeast-1.maas.aliyuncs.com` (يُعيد 404 للنماذج الجديدة).
- DashScope القياسي: `https://dashscope.aliyuncs.com/compatible-mode/v1` (يُعيد 401 مع مفتاح MaaS).
- كلا الحالتين → النظام يتراجع لـ Gemini → يعمل بشكل صحيح.

**Why:** الفرق بين نوعَي المفاتيح غير واضح في الواجهة؛ يجب التوثيق لتجنب التشخيص المتكرر.

**How to apply:**
- إذا رأيت `401 Incorrect API key` من Alibaba → المفتاح MaaS لا يعمل مع DashScope.
- الحل: المستخدم يحتاج مفتاح `sk-xxxx` من [DashScope console](https://dashscope.console.aliyun.com).
- `POST /api/settings/ai-models/seed-quotas` يُحدِّث الـ endpoint إلى DashScope القياسي.
