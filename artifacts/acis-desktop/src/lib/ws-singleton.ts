/**
 * ws-singleton.ts — اتصال WebSocket واحد لكل التطبيق
 * يمنع إنشاء اتصالات متعددة عند التنقل بين الصفحات
 */

export type WsEventType =
  | "agents_updated" | "agent_executed" | "activity_updated" | "metrics_updated"
  | "project_updated" | "nexus_updated" | "conversation_updated" | "alerts_updated"
  | "job_started" | "job_completed" | "job_failed" | "news_updated" | "ping";

export interface WsEvent {
  type: WsEventType | string;
  data?: unknown;
  ts: number;
  [key: string]: unknown;
}

type WsListener = (event: WsEvent) => void;

function getWsUrl(): string {
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}/api/ws`;
}

class WsSingleton {
  private ws: WebSocket | null = null;
  private listeners: Set<WsListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private shouldConnect = false;

  connect() {
    this.shouldConnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.openSocket();
  }

  private openSocket() {
    if (!this.shouldConnect) return;
    try {
      const ws = new WebSocket(getWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectDelay = 3000;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
      };

      ws.onmessage = (ev) => {
        try {
          const event: WsEvent = JSON.parse(ev.data);
          this.listeners.forEach(l => {
            try { l(event); } catch {}
          });
        } catch {}
      };

      ws.onclose = () => {
        this.ws = null;
        if (!this.shouldConnect) return;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
          this.openSocket();
        }, this.reconnectDelay);
      };

      ws.onerror = () => { ws.close(); };
    } catch {}
  }

  addListener(listener: WsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsSingleton = new WsSingleton();
