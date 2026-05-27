import { useState, useEffect, useCallback } from "react";
import {
  useListProjects, useListModels, useCreateProject, useGenerateProduction,
} from "@workspace/api-client-react";
import { useGetProjectJobs, useGetGenerationJob } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Film, Clapperboard, Image, Music, Mic, Video,
  Play, Plus, CheckCircle2, Clock, Zap, ChevronLeft, ChevronDown, ChevronUp,
  Star, Cpu, X, FileText, RefreshCw, Trash2, ListVideo, Copy, Check,
  Users, BookOpen, Camera, Headphones, Wand2, AlignLeft, Layers, LayoutList,
  VolumeX, Volume2, Sparkles, Hash, GitMerge, Cog,
} from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const PHASE_LABELS    = ["السيناريو", "اللوحة المصورة", "التمثيل الصوتي", "توليد الصور", "توليد الفيديو", "الموسيقى", "التجميع"];
const PHASE_ICONS     = [Clapperboard, Film, Mic, Image, Video, Music, Zap];

const STATUS_STYLES: Record<string, string> = {
  storyboard:  "text-sky-400 bg-sky-400/10 border-sky-400/30",
  scripting:   "text-amber-400 bg-amber-400/10 border-amber-400/30",
  generating:  "text-primary bg-primary/10 border-primary/30",
  completed:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  failed:      "text-red-400 bg-red-400/10 border-red-400/30",
  concept:     "text-muted-foreground bg-secondary border-border/50",
};

const STATUS_AR: Record<string, string> = {
  storyboard: "لوحة مصورة", scripting: "كتابة سيناريو",
  generating: "جارٍ التوليد", completed: "مكتمل",
  failed: "فشل", concept: "فكرة أولية",
};

const PHASE_AR: Record<string, string> = {
  script: "السيناريو", storyboard: "اللوحة المصورة",
  audio: "الصوت", music: "الموسيقى", assembly: "التجميع",
  images: "الصور", video: "الفيديو",
};

const MODEL_TYPE_ICONS: Record<string, any> = {
  video: Video, image: Image, audio: Music, tts: Mic, music: Music, language: Zap,
};

const ALL_PHASES = [
  { type: "script",     label: "السيناريو",                  icon: FileText },
  { type: "storyboard", label: "اللوحة المصورة + برومبت",   icon: Clapperboard },
  { type: "audio",      label: "تصميم المشهد الصوتي",       icon: Mic },
  { type: "images",     label: "برومبت الصور (FLUX)",        icon: Image },
  { type: "video",      label: "برومبت الفيديو (Wan)",       icon: Video },
  { type: "music",      label: "الهوية الموسيقية",           icon: Music },
  { type: "assembly",   label: "جدول المونتاج النهائي",     icon: Zap },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  script:     "purple",
  storyboard: "sky",
  audio:      "emerald",
  images:     "orange",
  video:      "red",
  music:      "pink",
  assembly:   "amber",
};

const PHASE_ICONS_MAP: Record<string, any> = {
  script:     FileText,
  storyboard: Clapperboard,
  audio:      Headphones,
  images:     Image,
  video:      Video,
  music:      Music,
  assembly:   GitMerge,
};

function colorClass(phase: string, variant: "text" | "bg" | "border") {
  const c = PHASE_COLORS[phase] || "purple";
  const map: Record<string, Record<string, string>> = {
    purple: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
    sky:    { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30" },
    emerald:{ text: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/30" },
    orange: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
    red:    { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30" },
    pink:   { text: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/30" },
    amber:  { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  };
  return map[c]?.[variant] ?? map.purple[variant];
}

function parseSections(text: string) {
  const lines = text.split("\n");
  const sections: { heading: string; content: string[] }[] = [];
  let current: { heading: string; content: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading =
      /^═+.*═+$/.test(trimmed) ||
      /^#{1,3}\s/.test(trimmed) ||
      /^\*{2}[^*]+\*{2}$/.test(trimmed) ||
      /^[٠-٩0-9]+\.\s+[^\n]{3,}$/.test(trimmed) ||
      /^[─━═]{3,}/.test(trimmed);

    if (isHeading && trimmed.length > 2) {
      if (current) sections.push(current);
      current = { heading: trimmed.replace(/^[═#*─━]+\s*/, "").replace(/\s*[═#*─━]+$/, "").trim(), content: [] };
    } else if (trimmed) {
      if (!current) current = { heading: "", content: [] };
      current.content.push(trimmed);
    }
  }
  if (current) sections.push(current);
  return sections.filter(s => s.heading || s.content.length > 0);
}

function RichContent({ text, phase }: { text: string; phase: string }) {
  const sections = parseSections(text);
  const tc = colorClass(phase, "text");
  const bc = colorClass(phase, "bg");
  const bdc = colorClass(phase, "border");

  if (sections.length === 0) {
    return (
      <div className="p-4 text-sm leading-loose whitespace-pre-wrap text-foreground/80 text-right" dir="rtl">
        {text}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {sections.map((sec, i) => (
        <div key={i} className={`rounded-lg border ${bdc} overflow-hidden`}>
          {sec.heading && (
            <div className={`px-4 py-2 ${bc} border-b ${bdc} flex items-center gap-2`}>
              <Sparkles size={11} className={tc} />
              <span className={`text-xs font-bold font-mono uppercase tracking-wide ${tc}`}>{sec.heading}</span>
            </div>
          )}
          <div className="p-4 space-y-1.5">
            {sec.content.map((line, j) => {
              const isBullet = /^[-•·*]\s/.test(line);
              const isNum    = /^[٠-٩0-9]+[.)]\s/.test(line);
              const isScene  = /^(مشهد|scene|int\.|ext\.)/i.test(line);
              const isDialog = /^[\u0600-\u06FF\w]+:/i.test(line) && line.includes(":");

              if (isScene) {
                return (
                  <div key={j} className={`flex items-start gap-2 p-2 rounded ${bc}`}>
                    <Camera size={11} className={`${tc} shrink-0 mt-0.5`} />
                    <span className={`text-xs font-bold ${tc}`}>{line}</span>
                  </div>
                );
              }
              if (isDialog) {
                const [speaker, ...rest] = line.split(":");
                return (
                  <div key={j} className="flex items-start gap-2 pr-2 border-r-2 border-border/30">
                    <div className="flex-1">
                      <span className="text-xs font-bold text-foreground/90">{speaker}:</span>
                      <span className="text-xs text-muted-foreground mr-1">{rest.join(":")}</span>
                    </div>
                  </div>
                );
              }
              if (isBullet || isNum) {
                return (
                  <div key={j} className="flex items-start gap-2 text-sm text-right">
                    <div className={`w-1 h-1 rounded-full ${tc.replace("text-", "bg-")} mt-2 shrink-0`} />
                    <span className="text-foreground/85 leading-relaxed flex-1">{line.replace(/^[-•·*٠-٩0-9.)\s]+/, "")}</span>
                  </div>
                );
              }
              return (
                <p key={j} className="text-sm text-foreground/85 leading-relaxed text-right">{line}</p>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PhasePreviewBadges({ phase }: { phase: string }) {
  const badges: Record<string, { label: string; icon: any }[]> = {
    script:     [{ label: "السيناريو", icon: BookOpen }, { label: "الحوار", icon: AlignLeft }, { label: "التوجيهات", icon: Camera }],
    storyboard: [{ label: "اللوحة المصورة", icon: Layers }, { label: "برومبت FLUX", icon: Wand2 }, { label: "زوايا الكاميرا", icon: Camera }],
    audio:      [{ label: "الصوت", icon: Volume2 }, { label: "TTS", icon: Mic }, { label: "المؤثرات", icon: Headphones }],
    images:     [{ label: "FLUX Prompts", icon: Image }, { label: "المشاهد", icon: Layers }],
    video:      [{ label: "Wan Video", icon: Video }, { label: "المونتاج", icon: Film }],
    music:      [{ label: "MusicGen", icon: Music }, { label: "الهوية الموسيقية", icon: Sparkles }],
    assembly:   [{ label: "الجدول الزمني", icon: LayoutList }, { label: "التجميع", icon: GitMerge }, { label: "ما بعد الإنتاج", icon: Cog }],
  };
  const items = badges[phase] || [];
  const tc = colorClass(phase, "text");
  const bc = colorClass(phase, "bg");
  const bdc = colorClass(phase, "border");

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(b => (
        <span key={b.label} className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${bc} ${bdc} border ${tc}`}>
          <b.icon size={9} />{b.label}
        </span>
      ))}
    </div>
  );
}

// ── Job Result Modal ──────────────────────────────────────────────────────────

function JobResultPanel({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: job, isLoading, isFetching, refetch } = useGetGenerationJob(jobId);
  const [copied, setCopied] = useState(false);
  const [rawView, setRawView] = useState(false);

  useEffect(() => {
    if (job?.status !== "running") return;
    const t = setInterval(() => refetch(), 3500);
    return () => clearInterval(t);
  }, [job?.status, refetch]);

  useEffect(() => { refetch(); }, [jobId]);

  const handleCopy = () => {
    const text = job?.result || "";
    if (text) navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const phase = job?.phase || "script";
  const PhaseIcon = PHASE_ICONS_MAP[phase] || FileText;
  const tc = colorClass(phase, "text");
  const bc = colorClass(phase, "bg");
  const bdc = colorClass(phase, "border");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl" onClick={onClose}>
      <div className={`bg-card border ${bdc} rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/60`}
        onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={`flex items-center justify-between p-4 border-b border-border/40 shrink-0 ${bc}`}>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
              <X size={15} />
            </button>
            {job?.result && (
              <>
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border ${bdc} ${bc} ${tc} hover:opacity-80 transition-opacity`}>
                  {copied ? <><Check size={11} className="text-emerald-400" /> نُسخ</> : <><Copy size={11} /> نسخ</>}
                </button>
                <button onClick={() => setRawView(v => !v)}
                  className="text-xs font-mono px-2.5 py-1 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors">
                  {rawView ? "معاينة غنية" : "نص خام"}
                </button>
              </>
            )}
            {isFetching && <RefreshCw size={12} className={`${tc} animate-spin`} />}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h3 className="font-bold text-sm flex items-center gap-2 justify-end">
                {job && <span className={`text-[10px] font-mono ${job.status === "completed" ? "text-emerald-400" : job.status === "failed" ? "text-red-400" : "text-amber-400 animate-pulse"}`}>
                  {job.status === "completed" ? "مكتمل ✓" : job.status === "failed" ? "فشل ✗" : "جارٍ التوليد…"}
                </span>}
                نتيجة التوليد الذكي
              </h3>
              {job && (
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <PhasePreviewBadges phase={phase} />
                  {job.model_used && <span className="text-[10px] font-mono text-muted-foreground/60">{job.model_used}</span>}
                </div>
              )}
            </div>
            <div className={`w-10 h-10 rounded-xl ${bc} border ${bdc} flex items-center justify-center shrink-0`}>
              <PhaseIcon size={20} className={tc} />
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={28} className={`animate-spin ${tc}`} />
              <p className="text-sm text-muted-foreground">جارٍ تحميل النتيجة…</p>
            </div>
          ) : job?.status === "running" ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className={`w-16 h-16 rounded-2xl ${bc} border ${bdc} flex items-center justify-center`}>
                <PhaseIcon size={28} className={`${tc} animate-pulse`} />
              </div>
              <p className={`text-sm font-bold ${tc}`}>الذكاء الاصطناعي يولّد المحتوى…</p>
              <p className="text-xs text-muted-foreground">يتم التحديث تلقائياً كل 3.5 ثوانٍ</p>
              {job.estimated_seconds && (
                <div className={`flex items-center gap-2 text-xs font-mono ${bc} border ${bdc} px-3 py-1.5 rounded-full`}>
                  <Clock size={11} className={tc} />
                  <span className={tc}>الوقت المتوقع: ~{job.estimated_seconds}ث</span>
                </div>
              )}
              <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full ${tc.replace("text-", "bg-")} animate-pulse`} style={{ width: "60%" }} />
              </div>
            </div>
          ) : job?.result ? (
            rawView ? (
              <pre className="text-xs leading-loose whitespace-pre-wrap text-foreground/75 font-mono text-right" dir="rtl" lang="ar">
                {job.result}
              </pre>
            ) : (
              <RichContent text={job.result} phase={phase} />
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary border border-border/30 flex items-center justify-center">
                <FileText size={24} className="text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">لا يوجد محتوى محفوظ لهذه المرحلة</p>
                <p className="text-xs text-muted-foreground/60 mt-1">أعد تشغيل هذه المرحلة لتوليد المحتوى بالذكاء الاصطناعي</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer stats ── */}
        {job?.result && (
          <div className={`flex items-center justify-between px-5 py-2.5 border-t border-border/30 ${bc} text-[10px] font-mono shrink-0`}>
            <span className={tc}>{job.result.length.toLocaleString()} حرف</span>
            <span className="text-muted-foreground/60">{job.completed_at ? `اكتمل: ${new Date(job.completed_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
            <span className="text-muted-foreground/60">{PHASE_AR[phase] || phase} · {job.model_used}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline Preview (in job list) ─────────────────────────────────────────────

function InlineJobResult({ jobId, phase }: { jobId: string; phase?: string }) {
  const { data: job, isLoading } = useGetGenerationJob(jobId);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (job?.result) navigator.clipboard?.writeText(job.result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const p = phase || job?.phase || "script";
  const tc = colorClass(p, "text");
  const bc = colorClass(p, "bg");
  const bdc = colorClass(p, "border");

  if (isLoading) return (
    <div className="mt-2 p-3 bg-secondary/40 rounded-lg border border-border/30 flex items-center gap-2">
      <RefreshCw size={11} className="animate-spin text-muted-foreground" />
      <span className="text-xs font-mono text-muted-foreground">جارٍ التحميل…</span>
    </div>
  );

  if (job?.status === "running") return (
    <div className={`mt-2 p-3 ${bc} rounded-lg border ${bdc} flex items-center gap-2`}>
      <RefreshCw size={11} className={`animate-spin ${tc}`} />
      <span className={`text-xs font-mono ${tc}`}>الذكاء الاصطناعي يعمل… يتحدث تلقائياً</span>
    </div>
  );

  if (!job?.result) return (
    <div className="mt-2 p-3 bg-secondary/30 rounded-lg border border-border/20">
      <p className="text-xs text-muted-foreground/60 font-mono text-right">لا يوجد محتوى — شغّل المرحلة لتوليد المحتوى</p>
    </div>
  );

  const sections = parseSections(job.result);
  const firstSection = sections[0];
  const previewLines = firstSection?.content?.slice(0, 3) || [];

  return (
    <div className={`mt-2 rounded-lg border ${bdc} overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 py-1.5 ${bc} border-b ${bdc}`}>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy}
            className={`flex items-center gap-1 text-[10px] font-mono ${tc} hover:opacity-70 transition-opacity`}>
            {copied ? <><Check size={9} className="text-emerald-400" />نُسخ</> : <><Copy size={9} />نسخ</>}
          </button>
          <span className="text-[10px] font-mono text-muted-foreground/50">{(job.result.length / 1000).toFixed(1)}k حرف</span>
        </div>
        <div className="flex items-center gap-1.5">
          {firstSection?.heading && (
            <span className={`text-[10px] font-mono ${tc}`}>{firstSection.heading.substring(0, 30)}</span>
          )}
          <span className={`text-[10px] font-mono ${tc}`}>{sections.length} أقسام</span>
        </div>
      </div>
      <div className="p-3 space-y-1">
        {previewLines.map((line, i) => (
          <p key={i} className="text-xs text-foreground/75 leading-relaxed text-right line-clamp-1" dir="rtl">{line}</p>
        ))}
        {sections.length > 1 && (
          <p className={`text-[10px] font-mono ${tc}/60 text-right mt-1`}>+ {sections.length - 1} أقسام أخرى — انقر لعرض الكل</p>
        )}
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const { data: projects, isLoading: pLoad, refetch: refetchProjects } = useListProjects();
  const { data: models, isLoading: mLoad } = useListModels();
  const createProject    = useCreateProject();
  const generateProd     = useGenerateProduction();
  const qc               = useQueryClient();

  const [tab, setTab] = useState<"projects" | "models" | "new">("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [viewJobId, setViewJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", story_prompt: "", language: "ar", type: "short", duration_seconds: 90 });

  const { data: projectJobs, refetch: refetchJobs } = useGetProjectJobs(selectedProject);
  const projectData = projects?.find(p => p.id === selectedProject);

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/production/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      return res.json();
    },
    onSuccess: (_d, id) => {
      if (selectedProject === id) setSelectedProject(null);
      qc.invalidateQueries();
    },
  });

  const hasRunningJob = projectJobs?.some((j: any) => j.status === "running");
  useEffect(() => {
    if (!hasRunningJob) return;
    const interval = setInterval(() => {
      refetchJobs();
      refetchProjects();
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunningJob, refetchJobs, refetchProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await createProject.mutateAsync({ data: form as any });
    qc.invalidateQueries();
    setTab("projects");
    setSelectedProject(res?.id ?? null);
    setForm({ title: "", story_prompt: "", language: "ar", type: "short", duration_seconds: 90 });
  }

  async function handleGenerate(projectId: string, type: string) {
    setGenerating(true);
    setExpandedJobId(null);
    try {
      const res = await generateProd.mutateAsync({ projectId, data: { type } as any });
      if (res?.job_id) {
        setExpandedJobId(res.job_id);
        setTimeout(() => { refetchProjects(); refetchJobs(); qc.invalidateQueries(); }, 1500);
      }
    } catch (e: any) {
      console.error(e);
    }
    setGenerating(false);
  }

  const handleRunAll = useCallback(async () => {
    if (!selectedProject || runningAll) return;
    setRunningAll(true);
    const phases = ["script", "storyboard", "audio", "images", "music", "assembly"];
    for (const phase of phases) {
      try {
        const res = await generateProd.mutateAsync({ projectId: selectedProject, data: { type: phase } as any });
        if (res?.job_id) {
          let attempts = 0;
          while (attempts < 60) {
            await new Promise(r => setTimeout(r, 4000));
            const jobRes = await fetch(`${API_BASE}/production/jobs/${res.job_id}`);
            const job = await jobRes.json();
            if (job.status === "completed" || job.status === "failed") break;
            attempts++;
          }
        }
        refetchJobs();
        refetchProjects();
      } catch (e) {
        console.error(`فشل المرحلة: ${phase}`, e);
      }
    }
    setRunningAll(false);
    qc.invalidateQueries();
  }, [selectedProject, runningAll, generateProd, refetchJobs, refetchProjects, qc]);

  const TABS = [
    { key: "projects", label: "المشاريع", icon: Film },
    { key: "models",   label: "سجل النماذج", icon: Cpu },
    { key: "new",      label: "مشروع جديد", icon: Plus },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Modal viewer */}
      {viewJobId && <JobResultPanel jobId={viewJobId} onClose={() => setViewJobId(null)} />}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
            <Film size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">من القصة للرؤية</h1>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono text-xs">خط الإنتاج السينمائي</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              إنتاج أفلام ذكاء اصطناعي متكامل · قصة → فيديو · عربي وإنجليزي
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/50">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${tab === t.key ? "border-purple-400 text-purple-400 bg-purple-500/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List */}
          <div className="lg:col-span-2 space-y-4">
            {pLoad ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 bg-card border border-border/50" />)
            ) : !projects?.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <Film size={40} className="mx-auto mb-3 opacity-30" />
                <p>لا توجد مشاريع بعد — أنشئ أول فيلم</p>
                <Button onClick={() => setTab("new")} className="mt-4 gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20">
                  <Plus size={14} /> مشروع جديد
                </Button>
              </div>
            ) : projects.map(p => (
              <div key={p.id} className="relative group">
                <button onClick={() => {
                    setSelectedProject(p.id === selectedProject ? null : p.id);
                    setExpandedJobId(null);
                  }}
                  className={`w-full text-right p-5 rounded border transition-all ${selectedProject === p.id ? "border-purple-400/50 bg-purple-500/5" : "border-border/50 bg-card hover:border-purple-400/30"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-right text-xs font-mono text-muted-foreground">
                      <div>{p.assets_generated} أصول</div>
                      <div>{p.scenes_count} مشهد</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 justify-end">
                        {p.title_ar && <span className="font-bold" dir="rtl">{p.title_ar}</span>}
                        {p.title !== p.title_ar && <span className="font-bold opacity-60">{p.title}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 justify-end">
                        <span className="text-xs text-muted-foreground font-mono">{p.language}</span>
                        <span className="text-xs text-muted-foreground font-mono">{p.duration_seconds}ث</span>
                        <Badge className={`text-xs font-mono ${STATUS_STYLES[p.status] ?? "bg-secondary text-muted-foreground border-border/50"}`}>
                          {STATUS_AR[p.status] || p.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-row-reverse">
                    {PHASE_LABELS.map((label, i) => {
                      const done   = i < (p.phase ?? 0);
                      const active = i === (p.phase ?? 0);
                      const PhaseIcon = PHASE_ICONS[i];
                      return (
                        <div key={label} className="flex items-center gap-0.5">
                          {i < PHASE_LABELS.length - 1 && <ChevronLeft size={8} className="text-muted-foreground/20" />}
                          <div className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono ${done ? "text-emerald-400 bg-emerald-400/10" : active ? "text-purple-400 bg-purple-500/10 animate-pulse" : "text-muted-foreground/40 bg-secondary/40"}`}>
                            <PhaseIcon size={8} />
                            <span className="hidden sm:inline">{label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 text-right">{p.story_prompt}</p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`حذف مشروع "${p.title}" نهائياً؟`)) deleteProject.mutate(p.id);
                  }}
                  className="absolute left-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/40">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {projectData ? (
              <>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">إجراءات الإنتاج</div>
                <div className="p-4 bg-card border border-border/50 rounded space-y-3">
                  <div className="font-bold mb-1 text-right">{projectData.title_ar || projectData.title}</div>
                  <p className="text-xs text-muted-foreground text-right leading-relaxed border-r-2 border-purple-500/30 pr-2">
                    {projectData.story_prompt?.substring(0, 150)}{(projectData.story_prompt?.length ?? 0) > 150 ? "…" : ""}
                  </p>

                  <Button
                    onClick={handleRunAll}
                    disabled={runningAll || generating}
                    className="w-full gap-2 bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300 text-xs h-9 justify-center">
                    {runningAll
                      ? <><RefreshCw size={13} className="animate-spin" /> جارٍ تشغيل جميع المراحل…</>
                      : <><ListVideo size={13} /> تشغيل جميع المراحل تسلسلياً</>}
                  </Button>

                  <div className="text-[10px] font-mono text-muted-foreground text-center">— أو اختر مرحلة محددة —</div>

                  <div className="space-y-2">
                    {ALL_PHASES.map(action => (
                      <Button key={action.type} onClick={() => handleGenerate(projectData.id, action.type)}
                        disabled={generating || runningAll}
                        className="w-full gap-2 bg-secondary border border-border/50 hover:border-purple-400/30 hover:bg-purple-500/10 text-foreground justify-start text-xs h-9">
                        <action.icon size={13} className="text-purple-400 shrink-0" />
                        <span className="flex-1 text-right">{action.label}</span>
                        <span className="text-[10px] text-purple-400/60 font-mono shrink-0">ذكاء اصطناعي</span>
                      </Button>
                    ))}
                  </div>

                  {(generating || runningAll) && (
                    <div className="text-xs text-purple-400 font-mono text-center animate-pulse">
                      الذكاء الاصطناعي يعمل…
                    </div>
                  )}
                </div>

                {/* Jobs List */}
                {projectJobs && projectJobs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">نتائج التوليد</div>
                      {hasRunningJob && <div className="text-[10px] text-amber-400 font-mono animate-pulse flex items-center gap-1"><RefreshCw size={9} className="animate-spin" /> يتحدث…</div>}
                    </div>

                    {projectJobs.slice(0, 12).map((job: any) => {
                      const isExpanded = expandedJobId === job.id;
                      const hasResult = !!(job.result || (job.status !== "running" && job.status !== "failed"));
                      return (
                        <div key={job.id} className="rounded border border-border/40 bg-card overflow-hidden">
                          <div className="flex items-center gap-2 p-2.5">
                            {/* Status dot */}
                            <span className={`font-mono text-sm shrink-0 ${
                              job.status === "completed" ? "text-emerald-400" :
                              job.status === "failed" ? "text-red-400" :
                              "text-amber-400 animate-pulse"
                            }`}>
                              {job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "⋯"}
                            </span>
                            {/* Phase name */}
                            <span className="flex-1 text-xs text-foreground font-medium text-right">
                              {PHASE_AR[job.phase] || job.phase}
                            </span>
                            {/* Model */}
                            {job.model_used && (
                              <span className="text-[10px] text-purple-400/50 font-mono shrink-0 hidden sm:block">
                                {job.model_used.split("-").slice(0, 2).join("-")}
                              </span>
                            )}
                            {/* Expand / Full view buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                                className="text-[10px] text-muted-foreground hover:text-purple-400 px-1.5 py-0.5 rounded border border-border/30 hover:border-purple-500/30 transition-colors font-mono flex items-center gap-0.5"
                                title="عرض مضمّن">
                                {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                <span>عرض</span>
                              </button>
                              <button
                                onClick={() => setViewJobId(job.id)}
                                className="text-[10px] text-muted-foreground hover:text-purple-400 px-1.5 py-0.5 rounded border border-border/30 hover:border-purple-500/30 transition-colors font-mono"
                                title="عرض كامل في نافذة">
                                ⛶
                              </button>
                            </div>
                          </div>

                          {/* Inline result */}
                          {isExpanded && (
                            <div className="border-t border-border/30 px-2.5 pb-2.5">
                              <InlineJobResult jobId={job.id} phase={job.phase} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 bg-card border border-border/50 rounded text-center text-muted-foreground text-sm py-8">
                <Film size={32} className="mx-auto mb-3 opacity-30" />
                <p>اختر مشروعاً لعرض إجراءات الإنتاج</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "models" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">سجل نماذج الذكاء الاصطناعي — 2026</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mLoad ? (
              Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-40 bg-card border border-border/50" />)
            ) : models?.map((model: any) => {
              const Icon = MODEL_TYPE_ICONS[model.type] ?? Cpu;
              return (
                <div key={model.id} className="p-4 rounded border border-border/50 bg-card hover:border-purple-400/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {model.free_tier && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">مجاني</Badge>
                      )}
                      <Badge className={`text-[10px] font-mono border ${model.status === "online" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                        {model.status === "online" ? "نشط" : "تدهور"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-bold text-sm text-right">{model.name}</div>
                        <div className="text-xs text-muted-foreground font-mono text-right">{model.provider}</div>
                      </div>
                      <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Icon size={16} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2 justify-end">
                    {model.arabic_support && (
                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">عربي ✓</Badge>
                    )}
                    <Badge className="bg-secondary border-border/50 text-muted-foreground text-[10px] font-mono capitalize">{model.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span>{model.avg_latency_ms}ms</span>
                    {model.quality_score && (
                      <div className="flex items-center gap-1 text-amber-400">
                        <span>{Math.round(model.quality_score * 10)}/10</span>
                        <Star size={10} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "new" && (
        <div className="max-w-2xl mx-auto">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">إنشاء مشروع إنتاج جديد</div>
          <form onSubmit={handleCreate} className="p-6 bg-card border border-border/50 rounded space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">عنوان المشروع</label>
              <Input required placeholder="الخوارزمي / The Algorithm" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-secondary border-border/50 text-right" dir="rtl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">فكرة القصة</label>
              <Textarea required rows={5} placeholder="اكتب فكرة القصة بالتفصيل…" value={form.story_prompt}
                onChange={e => setForm(f => ({ ...f, story_prompt: e.target.value }))}
                className="bg-secondary border-border/50 text-right resize-none" dir="rtl" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground block text-right">اللغة</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1.5 text-sm text-foreground">
                  <option value="ar">عربي</option>
                  <option value="en">English</option>
                  <option value="bilingual">ثنائي</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground block text-right">النوع</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-secondary border border-border/50 rounded px-2 py-1.5 text-sm text-foreground">
                  <option value="short">قصير</option>
                  <option value="medium">متوسط</option>
                  <option value="feature">طويل</option>
                  <option value="documentary">وثائقي</option>
                  <option value="commercial">إعلان</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground block text-right">المدة (ث)</label>
                <Input type="number" min={10} max={7200} value={form.duration_seconds}
                  onChange={e => setForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))}
                  className="bg-secondary border-border/50 text-right" />
              </div>
            </div>
            <Button type="submit" disabled={createProject.isPending}
              className="w-full gap-2 bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 text-purple-300">
              {createProject.isPending ? <><RefreshCw size={14} className="animate-spin" /> جارٍ الإنشاء…</> : <><Plus size={14} /> إنشاء المشروع</>}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
