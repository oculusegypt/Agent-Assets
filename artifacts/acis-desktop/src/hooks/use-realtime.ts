import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsSingleton, WsEvent, WsEventType } from "../lib/ws-singleton";

const EVENT_TO_QUERY_KEYS: Record<WsEventType, string[]> = {
  agents_updated:       ["listAgents", "getAgent"],
  agent_executed:       ["listAgents", "getAgentExecutions", "getSystemMetrics", "getSystemActivity"],
  activity_updated:     ["getSystemActivity"],
  metrics_updated:      ["getSystemMetrics", "getSystemModelStats"],
  project_updated:      ["listProjects", "getProject", "getProjectJobs"],
  nexus_updated:        ["listNexusTasks", "getNexusTask"],
  conversation_updated: ["listConversations", "getConversationMessages"],
  alerts_updated:       ["getBillieAlerts", "getBillieStatus"],
  job_started:          ["getProjectJobs", "listProjects"],
  job_completed:        ["getProjectJobs", "listProjects", "getSystemActivity"],
  job_failed:           ["getProjectJobs", "listProjects"],
  news_updated:         ["getBillieNews"],
  ping:                 [],
};

export function useRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    wsSingleton.connect();
    const remove = wsSingleton.addListener((event: WsEvent) => {
      const keys = EVENT_TO_QUERY_KEYS[event.type as WsEventType] ?? [];
      for (const key of keys) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    });
    return remove;
  }, [qc]);
}
