---
name: Qwen-First AI Routing
description: استراتيجية توجيه AI — Qwen أساسي لكل شيء، Gemini للصوت العربي فقط.
---

## القاعدة
كل استدعاء AI يمر عبر `callAIForAgent(agentId, system, user)` أو `callAIForTask(taskType, system, user)`.
يُجرَّب نموذج Qwen الأساسي → ثم Qwen الاحتياطي → ثم Gemini كآخر ملجأ.
استثناء وحيد: `callGeminiTTS()` يُستدعى مباشرة لـ TTS العربي.

**Why:** نماذج Qwen أرخص وأعلى حصة؛ Gemini TTS الأفضل للعربية حسب الاختبارات.

**How to apply:**
- لا تستدعِ Gemini مباشرة لأي وكيل — استخدم `callAIForAgent` دائماً.
- الملف الرئيسي: `artifacts/api-server/src/lib/ai.ts`.
- خريطة الوكلاء: `AGENT_TASK_MAP`، خريطة النماذج: `TASK_MODEL_CONFIG`.
