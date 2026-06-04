import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initWebSocket } from "./lib/ws.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
initWebSocket(server);

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // Auto-seed agents, recover stuck jobs, and load default settings on every startup
  setImmediate(async () => {
    try {
      await fetch(`http://localhost:${port}/api/system/seed-agents`, { method: "POST" });
      await fetch(`http://localhost:${port}/api/settings`, { method: "GET" });
      const recovered = await fetch(`http://localhost:${port}/api/production/recover-stuck-jobs`, { method: "POST" });
      const recData = await recovered.json() as { recovered: number };
      if (recData.recovered > 0) logger.warn({ recovered: recData.recovered }, "Recovered stuck production jobs");

      const nexusRec = await fetch(`http://localhost:${port}/api/nexus/recover-stuck`, { method: "POST" });
      const nexusData = await nexusRec.json() as { recovered: number };
      if (nexusData.recovered > 0) logger.warn({ recovered: nexusData.recovered }, "Recovered stuck NEXUS tasks");

      logger.info("Auto-seed completed: agents + settings + job recovery (production + nexus)");
    } catch (e: any) {
      logger.warn({ err: e?.message }, "Auto-seed warning (non-fatal)");
    }
  });
});
