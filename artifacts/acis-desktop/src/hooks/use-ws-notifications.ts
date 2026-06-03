/**
 * use-ws-notifications.ts
 * يستمع لأحداث WebSocket المتعلقة بالمهام ويعرض إشعارات Toast فورية
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type JobNotification = {
  id: string;
  type: "completed" | "failed" | "started";
  title: string;
  description: string;
  phase?: string;
  projectName?: string;
  ts: number;
};

let notifStore: JobNotification[] = [];
let notifListeners: Array<(n: JobNotification[]) => void> = [];

function emitNotif(n: JobNotification) {
  notifStore = [n, ...notifStore].slice(0, 50);
  notifListeners.forEach(l => l([...notifStore]));
}

/** Hook لقراءة سجل الإشعارات */
export function useJobNotifications() {
  const [notifs, setNotifs] = useState<JobNotification[]>([...notifStore]);
  useEffect(() => {
    notifListeners.push(setNotifs);
    return () => {
      notifListeners = notifListeners.filter(l => l !== setNotifs);
    };
  }, []);
  return notifs;
}

/** Hook: عداد المهام الجارية */
let runningCount = 0;
let runningListeners: Array<(n: number) => void> = [];

export function useRunningJobsCount() {
  const [count, setCount] = useState(runningCount);
  useEffect(() => {
    runningListeners.push(setCount);
    return () => {
      runningListeners = runningListeners.filter(l => l !== setCount);
    };
  }, []);
  return count;
}

function setRunning(n: number) {
  runningCount = n;
  runningListeners.forEach(l => l(n));
}

// ── الفاصل بين المراحل ──────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  script:     "السيناريو",
  storyboard: "اللوحة المصورة",
  audio:      "التمثيل الصوتي",
  images:     "توليد الصور",
  video:      "توليد الفيديو",
  music:      "الموسيقى",
  assembly:   "التجميع النهائي",
};

function getWsUrl(): string {
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${loc.host}/api/ws`;
}

/**
 * useWsNotifications — يُضاف مرة واحدة في مستوى التطبيق (App.tsx)
 * يستمع لأحداث job_completed / job_failed / job_started
 */
export function useWsNotifications() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  const handleEvent = useCallback((event: { type: string; data?: unknown; ts: number }) => {
    if (event.type === "job_completed") {
      const d = event.data as { jobId?: string; phase?: string; projectName?: string; error?: string };
      const phaseLabel = PHASE_LABELS[d.phase || ""] || d.phase || "مهمة";
      const notif: JobNotification = {
        id: d.jobId || String(event.ts),
        type: "completed",
        title: `✅ اكتمل: ${phaseLabel}`,
        description: d.projectName ? `مشروع: ${d.projectName}` : "مهمة الإنتاج",
        phase: d.phase,
        projectName: d.projectName,
        ts: event.ts,
      };
      emitNotif(notif);
      toast.success(notif.title, {
        description: notif.description,
        duration: 6000,
        action: {
          label: "عرض",
          onClick: () => { window.location.hash = "/production"; },
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/production"] });
      qc.invalidateQueries({ queryKey: ["listProjects"] });
      qc.invalidateQueries({ queryKey: ["getProjectJobs"] });
      setRunning(Math.max(0, runningCount - 1));
    }

    if (event.type === "job_failed") {
      const d = event.data as { jobId?: string; phase?: string; projectName?: string; error?: string };
      const phaseLabel = PHASE_LABELS[d.phase || ""] || d.phase || "مهمة";
      const notif: JobNotification = {
        id: d.jobId || String(event.ts),
        type: "failed",
        title: `❌ فشل: ${phaseLabel}`,
        description: d.error || (d.projectName ? `مشروع: ${d.projectName}` : "فشلت المهمة"),
        phase: d.phase,
        projectName: d.projectName,
        ts: event.ts,
      };
      emitNotif(notif);
      toast.error(notif.title, { description: notif.description, duration: 8000 });
      setRunning(Math.max(0, runningCount - 1));
    }

    if (event.type === "job_started") {
      const d = event.data as { phase?: string; projectName?: string };
      const phaseLabel = PHASE_LABELS[d.phase || ""] || d.phase || "مهمة";
      setRunning(runningCount + 1);
      const notif: JobNotification = {
        id: String(event.ts),
        type: "started",
        title: `⚡ بدأ: ${phaseLabel}`,
        description: d.projectName ? `مشروع: ${d.projectName}` : "بدأ التوليد",
        phase: d.phase,
        projectName: d.projectName,
        ts: event.ts,
      };
      emitNotif(notif);
    }
  }, [qc]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try { handleEvent(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => {
        if (!mountedRef.current) return;
        setTimeout(() => { if (mountedRef.current) connect(); }, 4000);
      };
      ws.onerror = () => ws.close();
    } catch {}
  }, [handleEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);
}
