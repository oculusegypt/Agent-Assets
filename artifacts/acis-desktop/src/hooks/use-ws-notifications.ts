/**
 * use-ws-notifications.ts
 * يستمع لأحداث WebSocket المتعلقة بالمهام ويعرض إشعارات Toast فورية
 * يستخدم WsSingleton — لا يُنشئ اتصالاً جديداً
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { wsSingleton, WsEvent } from "../lib/ws-singleton";

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

export function useJobNotifications() {
  const [notifs, setNotifs] = useState<JobNotification[]>([...notifStore]);
  useEffect(() => {
    notifListeners.push(setNotifs);
    return () => { notifListeners = notifListeners.filter(l => l !== setNotifs); };
  }, []);
  return notifs;
}

let runningCount = 0;
let runningListeners: Array<(n: number) => void> = [];

export function useRunningJobsCount() {
  const [count, setCount] = useState(runningCount);
  useEffect(() => {
    runningListeners.push(setCount);
    return () => { runningListeners = runningListeners.filter(l => l !== setCount); };
  }, []);
  return count;
}

function setRunning(n: number) {
  runningCount = n;
  runningListeners.forEach(l => l(n));
}

const PHASE_LABELS: Record<string, string> = {
  script: "السيناريو", storyboard: "اللوحة المصورة",
  audio: "التمثيل الصوتي", images: "توليد الصور",
  video: "توليد الفيديو", music: "الموسيقى", assembly: "التجميع النهائي",
};

export function useWsNotifications() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  useEffect(() => {
    wsSingleton.connect();
    const remove = wsSingleton.addListener((event: WsEvent) => {
      if (event.type === "job_completed") {
        const d = event.data as { jobId?: string; phase?: string; projectName?: string };
        const phaseLabel = PHASE_LABELS[d.phase || ""] || d.phase || "مهمة";
        const notif: JobNotification = {
          id: d.jobId || String(event.ts), type: "completed",
          title: `✅ اكتمل: ${phaseLabel}`,
          description: d.projectName ? `مشروع: ${d.projectName}` : "مهمة الإنتاج",
          phase: d.phase, projectName: d.projectName, ts: event.ts,
        };
        emitNotif(notif);
        toast.success(notif.title, {
          description: notif.description, duration: 6000,
          action: { label: "عرض", onClick: () => navigate("/production") },
        });
        qc.invalidateQueries({ queryKey: ["getProjectJobs"] });
        qc.invalidateQueries({ queryKey: ["listProjects"] });
        setRunning(Math.max(0, runningCount - 1));
      }

      if (event.type === "job_failed") {
        const d = event.data as { jobId?: string; phase?: string; projectName?: string; error?: string };
        const phaseLabel = PHASE_LABELS[d.phase || ""] || d.phase || "مهمة";
        const notif: JobNotification = {
          id: d.jobId || String(event.ts), type: "failed",
          title: `❌ فشل: ${phaseLabel}`,
          description: d.error || (d.projectName ? `مشروع: ${d.projectName}` : "فشلت المهمة"),
          phase: d.phase, projectName: d.projectName, ts: event.ts,
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
          id: String(event.ts), type: "started",
          title: `⚡ بدأ: ${phaseLabel}`,
          description: d.projectName ? `مشروع: ${d.projectName}` : "بدأ التوليد",
          phase: d.phase, projectName: d.projectName, ts: event.ts,
        };
        emitNotif(notif);
      }
    });
    return remove;
  }, [qc, navigate]);
}
