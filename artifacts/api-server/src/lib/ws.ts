import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

export type WsEventType =
  | "agents_updated"
  | "agent_executed"
  | "activity_updated"
  | "metrics_updated"
  | "project_updated"
  | "nexus_updated"
  | "conversation_updated"
  | "alerts_updated"
  | "ping";

export interface WsEvent {
  type: WsEventType;
  data?: unknown;
  ts: number;
}

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws) => {
    const welcome: WsEvent = { type: "ping", data: { message: "connected" }, ts: Date.now() };
    ws.send(JSON.stringify(welcome));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      } catch {}
    });

    ws.on("error", () => {});
  });
}

export function broadcast(event: WsEventType, data?: unknown) {
  if (!wss) return;
  const payload = JSON.stringify({ type: event, data, ts: Date.now() } satisfies WsEvent);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch {}
    }
  }
}
