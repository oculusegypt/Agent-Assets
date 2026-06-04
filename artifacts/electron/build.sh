#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║           ACIS Electron — Build & Package Script                ║
# ║  يبني التطبيق الكامل وينتج ملف .exe أو AppImage                ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ELECTRON_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "═══════════════════════════════════════"
echo "  ACIS v3.0 — Electron Build"
echo "  Root: $ROOT"
echo "═══════════════════════════════════════"

# ── Step 1: Build the React frontend ────────────────────────────────
echo ""
echo "▶ [1/4] Building React frontend (Vite)…"
cd "$ROOT/artifacts/acis-desktop"
VITE_API_URL="" pnpm run build
echo "  ✓ Frontend built → dist/"

# ── Step 2: Build the Express backend (esbuild) ─────────────────────
echo ""
echo "▶ [2/4] Building Express backend (esbuild)…"
cd "$ROOT/artifacts/api-server"
pnpm run build
echo "  ✓ Backend built → dist/"

# ── Step 3: Build the Electron main process (tsc) ───────────────────
echo ""
echo "▶ [3/4] Building Electron main process (TypeScript)…"
cd "$ELECTRON_DIR"

# Install electron deps if needed
if [ ! -d "node_modules/electron" ]; then
  echo "  Installing Electron dependencies…"
  pnpm install
fi

pnpm run build:main
echo "  ✓ Main process built → dist-electron/"

# ── Step 4: Copy assets ─────────────────────────────────────────────
echo ""
echo "▶ [4/4] Assembling package assets…"

# Copy built frontend
mkdir -p "$ELECTRON_DIR/dist-frontend"
cp -r "$ROOT/artifacts/acis-desktop/dist/." "$ELECTRON_DIR/dist-frontend/"
echo "  ✓ Frontend copied → dist-frontend/"

# Copy built backend
mkdir -p "$ELECTRON_DIR/dist-backend"
cp -r "$ROOT/artifacts/api-server/dist/." "$ELECTRON_DIR/dist-backend/"
echo "  ✓ Backend copied → dist-backend/"

# Copy data (empty DB template)
mkdir -p "$ELECTRON_DIR/data"
if [ -f "$ROOT/data/acis.db" ]; then
  cp "$ROOT/data/acis.db" "$ELECTRON_DIR/data/acis.db.template"
  echo "  ✓ DB template copied"
fi

# ── Step 5: Package with electron-builder ───────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Packaging with electron-builder…"
echo "  Target: $1 (default: --linux)"
echo "══════════════════════════════════════════"

TARGET="${1:---linux}"
cd "$ELECTRON_DIR"
npx electron-builder $TARGET --config.extraResources[0].from="$ROOT/data" 2>&1

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Build complete!"
echo "  Output: $ELECTRON_DIR/dist-app/"
ls "$ELECTRON_DIR/dist-app/" 2>/dev/null || echo "  (check for errors above)"
echo "══════════════════════════════════════════"
