---
name: ACIS V6 Performance Fixes
description: WS Singleton pattern, QueryClient tuning, and slow navigation root cause
---

## Root Cause of Slow Navigation
Before v6, every hook (`use-realtime.ts`, `use-ws-notifications.ts`, `notifications-panel.tsx`) opened its own WebSocket connection. On each page transition:
- 3 separate WS connections created/destroyed
- React Query's default `refetchOnMount: true` refetched all queries on every page visit

**Why:** React Query's `refetchOnMount` defaults to `true`, so every `useQuery()` call refetches data when its component remounts — including on navigation.

**How to apply:** Always set these in QueryClient:
```ts
refetchOnMount: false
refetchOnWindowFocus: false
refetchOnReconnect: false
staleTime: 30_000
```

## WS Singleton Pattern
**File:** `artifacts/acis-desktop/src/lib/ws-singleton.ts`
**Rule:** Never use `new WebSocket()` directly in hooks. Use `wsSingleton.addListener(fn)` — returns cleanup function.

**Why:** Multiple WS connections waste server resources and cause duplicate invalidations.

**How to apply:**
```ts
useEffect(() => {
  wsSingleton.connect();
  return wsSingleton.addListener((event) => { /* handle */ });
}, [deps]);
```

## text_fast Bug
`text_fast` is not a valid `TaskType` — it doesn't exist in `TASK_MODEL_CONFIG`.
Always use `text_simple` for quick AI calls instead.

## BillieFloat
`src/components/billie-float.tsx` — floating button (bottom-left) for quick Billie chat from any page.
- Hidden on `/billie` route (redundant there)
- Uses `/api/billie/chat` (non-streaming) for simplicity
- Has TTS play button on each AI response

## Splash Screen
`index.html` has dark inline CSS + splash div (`#acis-splash`).
`App.tsx` `SplashRemover` component calls `window.__ACIS_READY__()` after 300ms.
Prevents black flash before React loads.
