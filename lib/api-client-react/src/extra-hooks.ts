import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export function useAgentPipeline() {
  return useMutation({
    mutationFn: (body: { agent_ids: string[]; input: string; pipeline_name?: string }) =>
      customFetch<any>("/api/agents/pipeline", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useAgentBatch() {
  return useMutation({
    mutationFn: (body: { agent_ids: string[]; input: string }) =>
      customFetch<any>("/api/agents/batch", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useCreateSystemAlert() {
  return useMutation({
    mutationFn: (body: { severity: string; title: string; message: string; agent_id?: string }) =>
      customFetch<any>("/api/billie/alerts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useResolveAlert() {
  return useMutation({
    mutationFn: ({ alertId }: { alertId: string }) =>
      customFetch<any>(`/api/billie/alerts/${alertId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
  });
}

export function useResolveComplaint() {
  return useMutation({
    mutationFn: ({ id, resolution_note }: { id: string; resolution_note?: string }) =>
      customFetch<any>(`/api/billie/complaints/${id}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolution_note }),
      }),
  });
}

export function useAnalyzeBillieNews() {
  return useMutation({
    mutationFn: (body: { topic?: string }) =>
      customFetch<any>("/api/billie/news/analyze", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useGetNexusTemplates() {
  return useQuery({
    queryKey: ["nexus-templates"],
    queryFn: () => customFetch<any[]>("/api/nexus/templates"),
  });
}

export function useGetNexusTask(taskId: string | null) {
  return useQuery({
    queryKey: ["nexus-task", taskId],
    queryFn: () => customFetch<any>(`/api/nexus/tasks/${taskId}`),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.status === "running" ? 3000 : false;
    },
  });
}

export function useDeleteNexusTask() {
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string }) =>
      customFetch<any>(`/api/nexus/tasks/${taskId}`, { method: "DELETE" }),
  });
}

export function useGetGenerationJob(jobId: string | null) {
  return useQuery({
    queryKey: ["generation-job", jobId],
    queryFn: () => customFetch<any>(`/api/production/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.status === "running" ? 3000 : false;
    },
  });
}

export function useGetProjectJobs(projectId: string | null) {
  return useQuery({
    queryKey: ["project-jobs", projectId],
    queryFn: () => customFetch<any[]>(`/api/production/projects/${projectId}/jobs`),
    enabled: !!projectId,
  });
}

export function useSystemHealthCheck() {
  return useMutation({
    mutationFn: () =>
      customFetch<any>("/api/system/health-check", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}
