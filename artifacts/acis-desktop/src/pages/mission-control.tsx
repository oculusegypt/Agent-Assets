/**
 * mission-control.tsx — مركز التحكم الموحد
 * يعرض جميع المهام الجارية عبر كل الأنظمة في مكان واحد
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, RefreshCw, Film, Building2, Cpu,
  CheckCircle2, Clock, AlertTriangle, Zap, X,
  TrendingUp, BarChart3, Filter, Play, Pause,
  ArrowRight, ChevronDown, ChevronUp, Timer,
} from "lucide-react";
import { BASE, API_BASE, SYSTEM_COLORS, PHASE_COLORS, formatDuration, formatRelativeTime, isArabic } from "@/lib/ai-utils";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ──────────────────────────────────────────────────────────────────────
type UnifiedJob = {
  id: string;
  source: "production" | "nexus" | "acis";
  phase?: string;
  type?: string;
  status: "pending" | "running" | "completed" | "failed";
  project_name?: string;
  agent_name?: string;
  result?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
  duration_ms?: number;
};

type HeatmapBucket = { hour: number; count: number; label: string };

// ── Constants ──────────────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, { label: string; color: string; icon: typeof Film }> = {
  production: { label: "الإنتاج",     color: "text-purple-400 border-purple-500/30 bg-purple-500/10", icon: Film },
  nexus:      { label: "نيكسوس",     color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", icon: Building2 },
  acis:       { label: "ACIS",       color: "text-primary border-primary/30 bg-primary/10", icon: Cpu },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: "معلق",    color: "text-muted-foreground border-border bg-muted/20",      dot: "bg-muted-foreground" },
  running:   { label: "جارٍ",    color: "text-primary border-primary/30 bg-primary/10",         dot: "bg-primary animate-pulse" },
  completed: { label: "مكتمل",  color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-500" },
  failed:    { label: "فشل",    color: "text-red-400 border-red-500/30 bg-red-500/10",          dot: "bg-red-500" },
};

const PHASE_AR: Record<string, string> = {
  script: "السيناريو", storyboard: "اللوحة المصورة", audio: "الصوت",
  images: "الصور", video: "الفيديو", music: "الموسيقى", assembly: "التجميع",
};

// ── Fetch unified jobs ─────────────────────────────────────────────────────────
async function fetchAllJobs(): Promise<UnifiedJob[]> {
  const [prodR, nexusR] = await Promise.all([
    fetch(`${API_BASE}/production/archive?limit=100`).then(r => r.ok ? r.json() : { jobs: [] }),
    fetch(`${API_BASE}/nexus/tasks`).then(r => r.ok ? r.json() : []),
  ]);

  const prodJobs: UnifiedJob[] = (prodR.jobs || []).map((j: any) => ({
    id: j.id,
    source: "production" as const,
    phase: j.phase,
    status: j.status as UnifiedJob["status"],
    project_name: j.project_name || j.project_id,
    result: j.result,
    error: j.error,
    created_at: j.created_at,
    updated_at: j.updated_at,
    duration_ms: j.duration_ms,
  }));

  const nexusJobs: UnifiedJob[] = (Array.isArray(nexusR) ? nexusR : []).map((t: any) => ({
    id: t.id,
    source: "nexus" as const,
    type: t.type,
    status: t.status as UnifiedJob["status"],
    agent_name: t.agent_id,
    result: t.result,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  return [...prodJobs, ...nexusJobs]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

// ── Stats card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Activity; color: string }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 bg-card ${color.replace("text-", "border-").replace(/\d+$/, "400/20")}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.replace("text-", "bg-").replace(/\d+$/, "400/10")}`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ── Heatmap ────────────────────────────────────────────────────────────────────
function ActivityHeatmap({ jobs }: { jobs: UnifiedJob[] }) {
  const buckets: HeatmapBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: 0,
    label: `${h}:00`,
  }));

  for (const job of jobs) {
    if (!job.created_at) continue;
    const h = new Date(job.created_at).getHours();
    buckets[h].count++;
  }

  const max = Math.max(1, ...buckets.map(b => b.count));

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={14} className="text-primary" />
        <span className="text-sm font-semibold">نشاط المهام — آخر 24 ساعة</span>
      </div>
      <div className="flex items-end gap-1 h-12">
        {buckets.map(b => (
          <div key={b.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${b.label}: ${b.count} مهمة`}>
            <div
              className="w-full rounded-sm bg-primary/20 hover:bg-primary/60 transition-colors cursor-default"
              style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }}
            />
            {b.hour % 6 === 0 && (
              <div className="absolute -bottom-5 text-[8px] text-muted-foreground/50 font-mono">{b.label}</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 text-[10px] text-muted-foreground/50 text-left">ساعة اليوم</div>
    </div>
  );
}

// ── Job row ────────────────────────────────────────────────────────────────────
function JobRow({ job }: { job: UnifiedJob }) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_LABELS[job.source];
  const sta = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
  const SrcIcon = src.icon;
  const phaseLabel = job.phase ? (PHASE_AR[job.phase] || job.phase) : (job.type || "مهمة");

  return (
    <div className="border border-border/40 rounded-xl bg-card/60 hover:bg-card transition-colors">
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => job.result && setExpanded(e => !e)}>
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${sta.dot}`} />

        {/* Source icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${src.color}`}>
          <SrcIcon size={13} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-foreground font-semibold">{phaseLabel}</span>
            {job.project_name && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {isArabic(job.project_name) ? job.project_name : job.project_name}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
            {job.created_at ? formatRelativeTime(job.created_at) : ""}
            {job.duration_ms ? ` · ${formatDuration(job.duration_ms)}` : ""}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[9px] py-0 h-4 ${src.color}`}>
            {src.label}
          </Badge>
          <Badge variant="outline" className={`text-[9px] py-0 h-4 ${sta.color}`}>
            {sta.label}
          </Badge>
          {job.result && (
            <button className="text-muted-foreground/40 hover:text-primary transition-colors">
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded result */}
      {expanded && job.result && (
        <div className="border-t border-border/30 p-3">
          <div className="text-[11px] text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
            {job.result.slice(0, 600)}{job.result.length > 600 ? "…" : ""}
          </div>
        </div>
      )}

      {/* Error */}
      {job.status === "failed" && job.error && !expanded && (
        <div className="border-t border-red-500/20 px-3 py-2 text-[10px] text-red-400/70 flex items-start gap-1.5">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          {job.error.slice(0, 120)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MissionControlPage() {
  const [jobs, setJobs] = useState<UnifiedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "running" | "completed" | "failed">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "production" | "nexus" | "acis">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const qc = useQueryClient();

  const load = useCallback(async () => {
    try {
      const data = await fetchAllJobs();
      setJobs(data);
    } catch {
      toast.error("فشل تحميل المهام");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const filtered = jobs.filter(j => {
    if (filter !== "all" && j.status !== filter) return false;
    if (sourceFilter !== "all" && j.source !== sourceFilter) return false;
    return true;
  });

  const counts = {
    running:   jobs.filter(j => j.status === "running").length,
    completed: jobs.filter(j => j.status === "completed").length,
    failed:    jobs.filter(j => j.status === "failed").length,
    pending:   jobs.filter(j => j.status === "pending").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Activity size={18} className="text-primary" />
            </div>
            مركز التحكم
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">رؤية موحدة لجميع مهام الأنظمة</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              autoRefresh
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground"
            }`}>
            {autoRefresh ? <Play size={11} /> : <Pause size={11} />}
            {autoRefresh ? "تحديث تلقائي" : "متوقف"}
          </button>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5 h-8">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="جارية الآن"  value={counts.running}   icon={Zap}          color="text-primary" />
        <StatCard label="مكتملة"      value={counts.completed} icon={CheckCircle2} color="text-emerald-400" />
        <StatCard label="فشلت"        value={counts.failed}    icon={AlertTriangle} color="text-red-400" />
        <StatCard label="معلقة"       value={counts.pending}   icon={Clock}        color="text-amber-400" />
      </div>

      {/* Heatmap */}
      <ActivityHeatmap jobs={jobs} />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-0.5 bg-muted/30 rounded-lg border border-border/50">
          {(["all", "running", "completed", "failed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {f === "all" ? "الكل" : STATUS_CONFIG[f].label}
              {f !== "all" && <span className="mr-1.5 font-mono">{counts[f]}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-muted/30 rounded-lg border border-border/50">
          {(["all", "production", "nexus"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${
                sourceFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? "كل الأنظمة" : SOURCE_LABELS[s]?.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground mr-auto">
          {filtered.length} من {jobs.length} مهمة
        </div>
      </div>

      {/* Jobs list */}
      <div className="flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/40 p-12 text-center">
            <Activity size={32} className="mx-auto mb-3 text-muted-foreground/30" />
            <div className="text-muted-foreground/60 text-sm">لا توجد مهام مطابقة للفلتر</div>
            <button onClick={() => { setFilter("all"); setSourceFilter("all"); }}
              className="text-primary text-xs mt-2 hover:underline">
              مسح الفلاتر
            </button>
          </div>
        ) : (
          filtered.map(job => <JobRow key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
