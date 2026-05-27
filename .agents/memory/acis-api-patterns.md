---
name: ACIS API patterns
description: Key architectural decisions and patterns in the ACIS API server and frontend
---

# ACIS API Patterns

## DELETE Endpoints Added
- `DELETE /api/conversations/:id` — deletes messages then conversation, broadcasts `conversation_deleted`
- `DELETE /api/production/projects/:id` — deletes jobs then project, broadcasts `project_updated`
- `POST /api/production/recover-stuck-jobs` — marks jobs stuck >10min as failed; called on startup

## Agent Task Routing in Conversations
Conversations route now uses `callAIForTask(getAgentTaskType(agentId), ...)` instead of legacy `callAI`.
**Why:** Each agent has an optimal task type mapped in `AGENT_TASK_MAP` in ai.ts. Using task-type routing picks the best model (e.g. QwQ for reasoning agents, Qwen3-VL for visual agents).

## Startup Sequence (index.ts)
On every server start, three auto-calls happen via `setImmediate`:
1. `POST /api/system/seed-agents` — idempotent upsert of all 19 agents
2. `GET /api/settings` — triggers ensureDefaults for 32 settings
3. `POST /api/production/recover-stuck-jobs` — fixes jobs left "running" if server crashed

## Production Pipeline: All 7 Phases
Frontend has "Run All Phases" button that executes phases sequentially with 4s polling between each. Phases: script → storyboard → audio → images → music → assembly (video phase requires external API keys not yet configured).

## Frontend Delete Pattern
Uses `useMutation` with direct `fetch()` call — avoids needing to update the generated API client for simple DELETE operations. Pattern:
```ts
const del = useMutation({ mutationFn: async (id) => fetch(`${API_BASE}/.../${id}`, {method:'DELETE'}) })
```

## Auto-polling Pattern for Running Jobs
Production jobs use `useEffect` + `setInterval(refetch, 4000)` while `job.status === "running"`.
JobResultViewer modal also auto-polls every 3s independently.
