---
name: ACIS Electron Build
description: Electron packaging setup for ACIS — architecture, quirks, and rebuild steps.
---

## Architecture

- `artifacts/electron/` — standalone workspace package (not in pnpm catalog)
- Electron main process (`src/main.ts`) spawns the Express backend via `child_process.spawn`
- Backend receives `SERVE_STATIC=1` + `STATIC_DIR=<path>` → serves built React SPA at `/`
- Electron BrowserWindow loads `http://localhost:3001` (backend + frontend unified port)
- User data (SQLite DB) stored in `app.getPath("userData")` in packaged mode

## Quirks fixed

- `vite.config.ts` had hard `throw` for missing PORT/BASE_PATH — added `isBuild` guard so `pnpm run build` works without those env vars
- `pnpm approve-builds` is interactive — add `electron` to root `pnpm-workspace.yaml` `onlyBuiltDependencies` to allow postinstall
- `electron-builder` deb target requires `author.email` + `homepage` in package.json — use AppImage-only target on Linux to avoid fpm metadata errors
- ICO/PNG icons generated from SVG via `magick` (ImageMagick 7) — `convert` is deprecated alias, use `magick` directly

## Build steps (from scratch)

```bash
cd artifacts/acis-desktop && NODE_ENV=production pnpm run build   # → dist/public/
cd artifacts/api-server && pnpm run build                          # → dist/
cd artifacts/electron && pnpm run build:main                       # → dist-electron/
cp -r artifacts/acis-desktop/dist/public/. artifacts/electron/dist-frontend/
cp -r artifacts/api-server/dist/. artifacts/electron/dist-backend/
cd artifacts/electron && npx electron-builder --linux
```

## Output

`artifacts/electron/dist-app/ACIS — مركز القيادة السينمائي-3.0.0.AppImage` (107 MB Linux)

**Why:** The backend serves both API and static frontend when `SERVE_STATIC=1`, so Electron only needs one port and one process to manage.
