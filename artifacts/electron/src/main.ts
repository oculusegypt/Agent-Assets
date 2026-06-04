import { app, BrowserWindow, ipcMain, shell, Menu } from "electron";
import { join, resolve } from "path";
import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────
const BACKEND_PORT = 3001;
const IS_DEV = process.env["NODE_ENV"] === "development" || !app.isPackaged;
const ROOT_DIR = IS_DEV
  ? resolve(__dirname, "../../..")          // monorepo root in dev
  : resolve(process.resourcesPath, "..");   // packaged app resources

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

// ────────────────────────────────────────────────────────
// Backend Server
// ────────────────────────────────────────────────────────
function startBackend(): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    const backendEntry = IS_DEV
      ? resolve(ROOT_DIR, "artifacts/api-server/dist/index.mjs")
      : resolve(process.resourcesPath, "dist-backend/index.mjs");

    const dbPath = IS_DEV
      ? resolve(ROOT_DIR, "data/acis.db")
      : resolve(app.getPath("userData"), "acis.db");

    if (!existsSync(backendEntry)) {
      console.error("[ACIS] Backend bundle not found:", backendEntry);
      rejectP(new Error("Backend not built. Run: pnpm run build:backend"));
      return;
    }

    const staticDir = IS_DEV
      ? resolve(ROOT_DIR, "artifacts/acis-desktop/dist")
      : resolve(process.resourcesPath, "dist-frontend");

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(BACKEND_PORT),
      DB_PATH: dbPath,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      SERVE_STATIC: "1",
      STATIC_DIR: staticDir,
    };

    console.log("[ACIS] Starting backend on port", BACKEND_PORT, "DB:", dbPath);

    backendProcess = spawn(process.execPath, ["--enable-source-maps", backendEntry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let started = false;

    backendProcess.stdout?.on("data", (d: Buffer) => {
      const line = d.toString();
      console.log("[BACKEND]", line.trim());
      if (!started && line.includes("Server listening")) {
        started = true;
        resolveP();
      }
    });

    backendProcess.stderr?.on("data", (d: Buffer) => {
      console.error("[BACKEND ERR]", d.toString().trim());
    });

    backendProcess.on("error", (err) => {
      console.error("[ACIS] Backend process error:", err);
      if (!started) rejectP(err);
    });

    backendProcess.on("exit", (code) => {
      console.log("[ACIS] Backend exited with code", code);
      if (!started) rejectP(new Error(`Backend exited early (code ${code})`));
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!started) {
        console.warn("[ACIS] Backend start timeout — opening window anyway");
        started = true;
        resolveP();
      }
    }, 15000);
  });
}

// ────────────────────────────────────────────────────────
// Window
// ────────────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: "ACIS — مركز القيادة السينمائي",
    backgroundColor: "#09090b",
    titleBarStyle: "default",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    show: false,
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost:") || url.startsWith("file://")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    if (IS_DEV) mainWindow?.webContents.openDevTools({ mode: "detach" });
  });

  // Load the app
  if (IS_DEV) {
    // In dev: try to load from the Vite dev server (port 8080), fall back to backend
    const devUrl = `http://localhost:8080`;
    try {
      await mainWindow.loadURL(devUrl);
    } catch {
      await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    }
  } else {
    // In production: backend serves the built frontend at /
    await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
  }
}

// ────────────────────────────────────────────────────────
// IPC handlers
// ────────────────────────────────────────────────────────
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window-close", () => mainWindow?.close());

// ────────────────────────────────────────────────────────
// App lifecycle
// ────────────────────────────────────────────────────────
app.on("ready", async () => {
  // Remove default menu in production
  if (!IS_DEV) Menu.setApplicationMenu(null);

  console.log("[ACIS] Starting backend server…");
  try {
    await startBackend();
    console.log("[ACIS] Backend ready. Creating window…");
  } catch (err) {
    console.error("[ACIS] Backend failed to start:", err);
    // Show window anyway — display error page
  }
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    backendProcess?.kill("SIGTERM");
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("quit", () => {
  backendProcess?.kill("SIGTERM");
});

process.on("exit", () => {
  backendProcess?.kill("SIGTERM");
});
