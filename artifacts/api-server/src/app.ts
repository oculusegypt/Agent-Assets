import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { mediaDir } from "./lib/media";
import router from "./routes";
import { logger } from "./lib/logger";
import { resolve, join } from "path";
import { existsSync } from "fs";

const app: Express = express();

// ── Static media files (generated audio) ───────────────────────────────────
app.use("/api/media", express.static(mediaDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".wav")) res.setHeader("Content-Type", "audio/wav");
    if (filePath.endsWith(".mp3")) res.setHeader("Content-Type", "audio/mpeg");
    if (filePath.endsWith(".mp4")) res.setHeader("Content-Type", "video/mp4");
    if (filePath.endsWith(".png")) res.setHeader("Content-Type", "image/png");
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) res.setHeader("Content-Type", "image/jpeg");
    if (filePath.endsWith(".webp")) res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Accept-Ranges", "bytes");
  },
}));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Electron / packaged mode: serve the built React frontend ─────────────────
// Set SERVE_STATIC=1 and STATIC_DIR=/path/to/dist to enable
if (process.env["SERVE_STATIC"] === "1") {
  const staticDir = process.env["STATIC_DIR"]
    || resolve(__dirname, "../../acis-desktop/dist");
  if (existsSync(staticDir)) {
    logger.info({ staticDir }, "Serving static frontend from disk");
    app.use(express.static(staticDir, {
      setHeaders(res) {
        res.setHeader("Cache-Control", "no-cache");
      },
    }));
    // SPA fallback: return index.html for all non-API routes
    app.get("*", (_req, res) => {
      const indexHtml = join(staticDir, "index.html");
      if (existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("ACIS frontend not built. Run: pnpm run build:frontend");
      }
    });
  } else {
    logger.warn({ staticDir }, "Static dir not found — skipping static serving");
  }
}

export default app;
