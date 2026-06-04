# ACIS Electron Build Guide

## Prerequisites

- Node.js 20+
- pnpm
- For Windows `.exe` on Linux: Wine (optional, for NSIS installer)

## Quick Build

```bash
# Linux AppImage
cd artifacts/electron
bash build.sh --linux

# Windows .exe (requires Wine on Linux, or run on Windows)
bash build.sh --win

# Both
bash build.sh
```

## Manual Steps

### 1. Build everything
```bash
# From monorepo root:
pnpm --filter @workspace/acis-desktop run build     # React frontend → dist/
pnpm --filter @workspace/api-server run build       # Express backend → dist/
cd artifacts/electron && pnpm run build:main        # Electron main → dist-electron/
```

### 2. Package
```bash
cd artifacts/electron
npx electron-builder --linux   # AppImage + deb
npx electron-builder --win     # .exe (NSIS installer + portable)
```

### Output
```
artifacts/electron/dist-app/
  ├── ACIS-3.0.0.AppImage          ← Linux portable
  ├── acis_3.0.0_amd64.deb         ← Debian/Ubuntu
  ├── ACIS Setup 3.0.0.exe         ← Windows installer
  └── ACIS 3.0.0.exe               ← Windows portable
```

## How It Works

1. **Electron main** (`src/main.ts`) starts the Express backend on port 3001
2. Backend serves both the API (`/api/*`) and the built React SPA (`/`)
3. Electron opens a `BrowserWindow` loading `http://localhost:3001`
4. User data (SQLite DB) is stored in the OS user data directory

## Environment in Packaged App

| Variable | Value |
|----------|-------|
| `PORT` | 3001 |
| `DB_PATH` | `{userData}/acis.db` |
| `SERVE_STATIC` | `1` |
| `STATIC_DIR` | `{resources}/dist-frontend` |
| `NODE_ENV` | `production` |
