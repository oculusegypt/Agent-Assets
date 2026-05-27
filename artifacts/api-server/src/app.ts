import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { mediaDir } from "./lib/media";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Static media files (generated audio) ───────────────────────────────────
app.use("/api/media", express.static(mediaDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".wav")) res.setHeader("Content-Type", "audio/wav");
    if (filePath.endsWith(".mp3")) res.setHeader("Content-Type", "audio/mpeg");
    if (filePath.endsWith(".mp4")) res.setHeader("Content-Type", "video/mp4");
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

export default app;
