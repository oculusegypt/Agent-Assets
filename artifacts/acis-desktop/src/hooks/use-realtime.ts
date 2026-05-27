import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

type WsEventType =
  | "agents_updated"
  | "agent_executed"
  | "activity_updated"
  | "metrics_updated"
  | "project_updated"
  | "nexus_updated"
  | "conversation_updated"
  | "alerts_updated"
  | "ping";

interface WsEvent {
  type: WsEventType;
  data?: unknown;
  ts: number;
}

const EVENT_TO_QUERY_KEYS: Record<WsEventType, string[]> = {
  agents_updated:       ["listAgents", "getAgent"],
  agent_executed:       ["listAgents", "getAgentExecutions", "getSystemMetrics", "getSystemActivity"],
  activity_updated:     ["getSystemActivity"],
  metrics_updated:      ["getSystemMetrics", "getSystemModelStats"],
  project_updated:      ["listProjects", "getProject", "getProjectJobs"],
  nexus_updated:        ["listNexusTasks", "getNexusTask"],
  conversation_updated: ["listConversations", "getConversationMessages"],
  alerts_updated:       ["getBillieAlerts", "getBillieStatus"],
  ping:                 [],
};

function getWsUrl(): string {
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}/api/ws`;
}

export function useRealtime() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const invalidate = useCallback((keys: string[]) => {
    for (const key of keys) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  }, [qc]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
      };

      ws.onmessage = (ev) => {
        try {
          const event: WsEvent = JSON.parse(ev.data);
          const keys = EVENT_TO_QUERY_KEYS[event.type] ?? [];
          if (keys.length > 0) invalidate(keys);
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        reconnectRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {}
  }, [invalidate]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
