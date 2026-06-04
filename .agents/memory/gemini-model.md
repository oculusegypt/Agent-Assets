---
name: Gemini model selection for ACIS API key
description: Which Gemini model to use given the free-tier API key stored in DB
---

The API key (stored in DB under `api_key.gemini`) is a free-tier key with these constraints:
- `gemini-2.5-pro`: returns HTTP 404 — not available on this key
- `gemini-2.5-flash`: only 20 RPD free tier — exhausted quickly during testing
- `gemini-2.0-flash`: also hits 429 quota easily
- `gemini-1.5-flash`: returns 404 (not in v1beta supported list)
- `gemini-2.5-flash-lite`: **WORKS** — confirmed responding, free tier with generous quota

**Why:** The free-tier key has per-model quotas that vary. 2.5-flash-lite is the sweet spot: modern, capable, and available.

**How to apply:** In `artifacts/api-server/src/lib/ai.ts`, `runSmartAI` hardcodes `geminiModel = "gemini-2.5-flash-lite"` regardless of tier (since pro is unavailable). In `artifacts/api-server/src/routes/settings.ts`, the test-ai endpoint also uses this model. If the user upgrades their API key, revert to tier-based selection.
