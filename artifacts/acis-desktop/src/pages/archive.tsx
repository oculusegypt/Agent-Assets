import { useState, useEffect, useMemo } from "react";
import { useListProjects } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Archive, Search, Download, FileText, Clapperboard, Headphones,
  Image, Video, Music, Zap, GitMerge, RefreshCw, X, Copy, Check,
  Filter, SortDesc, Sparkles, Clock, ChevronDown, ChevronUp, BookOpen,
  LayoutList, Camera, Layers, Wand2, AlignLeft, Volume2, Mic, Cog,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

// ── Phase metadata ─────────────────────────────────────────────────────────

const PHASE_META: Record<string, { label: string; icon: any; color: string; textCls: string; bgCls: string; borderCls: string }> = {
  script:     { label: "السيناريو",          icon: FileText,    color: "purple",  textCls: "text-purple-400",  bgCls: "bg-purple-500/10",  borderCls: "border-purple-500/30"  },
  storyboard: { label: "اللوحة المصورة",     icon: Clapperboard, color: "sky",   textCls: "text-sky-400",     bgCls: "bg-sky-500/10",     borderCls: "border-sky-500/30"     },
  audio:      { label: "المشهد الصوتي",      icon: Headphones,  color: "emerald", textCls: "text-emerald-400", bgCls: "bg-emerald-500/10", borderCls: "border-emerald-500/30" },
  images:     { label: "برومبت الصور",       icon: Image,       color: "orange",  textCls: "text-orange-400",  bgCls: "bg-orange-500/10",  borderCls: "border-orange-500/30"  },
  video:      { label: "برومبت الفيديو",     icon: Video,       color: "red",     textCls: "text-red-400",     bgCls: "bg-red-500/10",     borderCls: "border-red-500/30"     },
  music:      { label: "الهوية الموسيقية",   icon: Music,       color: "pink",    textCls: "text-pink-400",    bgCls: "bg-pink-500/10",    borderCls: "border-pink-500/30"    },
  assembly:   { label: "جدول المونتاج",      icon: GitMerge,    color: "amber",   textCls: "text-amber-400",   bgCls: "bg-amber-500/10",   borderCls: "border-amber-500/30"   },
};

const ALL_PHASES = Object.keys(PHASE_META);

// ── Section parser (shared with production.tsx logic) ──────────────────────

function parseSections(text: string) {
  const lines = text.split("\n");
  const sections: { heading: string; content: string[] }[] = [];
  let current: { heading: string; content: string[] } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading =
      /^═+.*═+$/.test(trimmed) || /^#{1,3}\s/.test(trimmed) ||
      /^\*{2}[^*]+\*{2}$/.test(trimmed) || /^[─━═]{3,}/.test(trimmed);
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

// ── Rich inline renderer ───────────────────────────────────────────────────

function RichContent({ text, phase }: { text: string; phase: string }) {
  const meta = PHASE_META[phase] || PHASE_META.script;
  const sections = parseSections(text);

  if (sections.length === 0) {
    return <p className="text-sm text-foreground/80 leading-relaxed text-right" dir="rtl">{text}</p>;
  }

  return (
    <div className="space-y-3" dir="rtl">
      {sections.map((sec, i) => (
        <div key={i} className={`rounded-lg border ${meta.borderCls} overflow-hidden`}>
          {sec.heading && (
            <div className={`px-3 py-1.5 ${meta.bgCls} border-b ${meta.borderCls} flex items-center gap-2`}>
              <Sparkles size={10} className={meta.textCls} />
              <span className={`text-[10px] font-bold font-mono uppercase tracking-wide ${meta.textCls}`}>{sec.heading}</span>
            </div>
          )}
          <div className="p-3 space-y-1.5">
            {sec.content.slice(0, 6).map((line, j) => {
              const isBullet = /^[-•·*]\s/.test(line);
              if (isBullet) return (
                <div key={j} className="flex items-start gap-2 text-sm">
                  <div className={`w-1 h-1 rounded-full mt-2 shrink-0 ${meta.bgCls.replace("bg-", "bg-").replace("/10", "/60")}`}
                    style={{ background: `var(--${meta.color}-400, currentColor)`, opacity: 0.6 }} />
                  <span className="text-foreground/80 leading-relaxed flex-1 text-right">{line.replace(/^[-•·*]\s/, "")}</span>
                </div>
              );
              return <p key={j} className="text-sm text-foreground/80 leading-relaxed text-right">{line}</p>;
            })}
            {sec.content.length > 6 && (
              <p className={`text-[10px] font-mono ${meta.textCls}/60 text-right`}>+ {sec.content.length - 6} سطر آخر…</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Export to Markdown ─────────────────────────────────────────────────────

function exportMarkdown(jobs: any[]) {
  const lines: string[] = [
    "# أرشيف نتائج الإنتاج السينمائي — ACIS",
    `> تم التصدير: ${new Date().toLocaleDateString("ar-SA")}  |  ${jobs.length} نتيجة`,
    "",
  ];
  for (const job of jobs) {
    const meta = PHASE_META[job.phase];
    lines.push(`---`);
    lines.push(`## ${meta?.label || job.phase} — ${job.project_title}`);
    lines.push(`- **النموذج:** ${job.model_used}`);
    lines.push(`- **التاريخ:** ${job.completed_at ? new Date(job.completed_at).toLocaleString("ar-SA") : "—"}`);
    lines.push(`- **الحجم:** ${job.result?.length?.toLocaleString() || 0} حرف`);
    lines.push("");
    lines.push(job.result || "_لا يوجد محتوى_");
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acis-archive-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Result Card ────────────────────────────────────────────────────────────

function ResultCard({ job, onView }: { job: any; onView: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = PHASE_META[job.phase] || PHASE_META.script;
  const PhaseIcon = meta.icon;
  const sections = useMemo(() => parseSections(job.result || ""), [job.result]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(job.result || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`rounded-xl border ${meta.borderCls} bg-card overflow-hidden hover:shadow-lg hover:shadow-black/30 transition-all`}>
      {/* Card Header */}
      <div className={`flex items-center justify-between p-4 ${meta.bgCls} border-b ${meta.borderCls}`}>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy}
            className={`flex items-center gap-1 text-[10px] font-mono ${meta.textCls} hover:opacity-70 transition-opacity`}>
            {copied ? <><Check size={9} className="text-emerald-400" />نُسخ</> : <><Copy size={9} />نسخ</>}
          </button>
          <button onClick={onView}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${meta.borderCls} ${meta.textCls} hover:opacity-80 transition-opacity`}>
            عرض كامل ↗
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-bold text-foreground">{job.project_title}</span>
              <span className={`text-xs font-medium ${meta.textCls}`}>{meta.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 justify-end text-[10px] font-mono text-muted-foreground">
              <span>{job.model_used}</span>
              <span>·</span>
              <span>{(job.result?.length / 1000 || 0).toFixed(1)}k حرف</span>
              {job.completed_at && (
                <><span>·</span><span>{new Date(job.completed_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></>
              )}
            </div>
          </div>
          <div className={`w-9 h-9 rounded-xl ${meta.bgCls} border ${meta.borderCls} flex items-center justify-center shrink-0`}>
            <PhaseIcon size={17} className={meta.textCls} />
          </div>
        </div>
      </div>

      {/* Preview content */}
      <div className="p-4">
        {!expanded ? (
          <div className="space-y-2">
            {sections.slice(0, 2).map((sec, i) => (
              <div key={i}>
                {sec.heading && (
                  <span className={`text-[10px] font-mono font-bold ${meta.textCls} uppercase tracking-wide`}>{sec.heading} · </span>
                )}
                <span className="text-xs text-foreground/75 leading-relaxed" dir="rtl">
                  {sec.content.slice(0, 2).join(" · ")}
                  {(sec.content.length > 2 || sections.length > 2) && <span className="text-muted-foreground/50">…</span>}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <RichContent text={job.result || ""} phase={job.phase} />
        )}
      </div>

      {/* Expand toggle */}
      {job.result && sections.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className={`w-full flex items-center justify-center gap-1.5 py-2 border-t ${meta.borderCls} text-[10px] font-mono ${meta.textCls} hover:${meta.bgCls} transition-colors`}>
          {expanded ? <><ChevronUp size={10} />طيّ المحتوى</> : <><ChevronDown size={10} />{sections.length} أقسام — توسيع</>}
        </button>
      )}
    </div>
  );
}

// ── Full Result Modal ──────────────────────────────────────────────────────

function FullResultModal({ job, onClose }: { job: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [rawView, setRawView] = useState(false);
  const meta = PHASE_META[job.phase] || PHASE_META.script;
  const PhaseIcon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl" onClick={onClose}>
      <div className={`bg-card border ${meta.borderCls} rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl`}
        onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-4 border-b border-border/40 ${meta.bgCls} shrink-0`}>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors"><X size={15} /></button>
            <button onClick={() => navigator.clipboard?.writeText(job.result || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
              className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg border ${meta.borderCls} ${meta.bgCls} ${meta.textCls} hover:opacity-80`}>
              {copied ? <><Check size={11} className="text-emerald-400" />نُسخ</> : <><Copy size={11} />نسخ</>}
            </button>
            <button onClick={() => setRawView(v => !v)}
              className="text-xs font-mono px-2.5 py-1 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors">
              {rawView ? "معاينة غنية" : "نص خام"}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <h3 className="font-bold text-sm flex items-center gap-2 justify-end">
                <span className={`text-[10px] font-mono ${meta.textCls}`}>{meta.label}</span>
                {job.project_title}
              </h3>
              <div className="flex items-center gap-2 mt-1 justify-end text-[10px] font-mono text-muted-foreground">
                <span>{(job.result?.length / 1000 || 0).toFixed(1)}k حرف</span>
                <span>·</span><span>{job.model_used}</span>
                {job.completed_at && <><span>·</span><span>{new Date(job.completed_at).toLocaleString("ar-SA")}</span></>}
              </div>
            </div>
            <div className={`w-10 h-10 rounded-xl ${meta.bgCls} border ${meta.borderCls} flex items-center justify-center shrink-0`}>
              <PhaseIcon size={20} className={meta.textCls} />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {rawView
            ? <pre className="text-xs leading-loose whitespace-pre-wrap text-foreground/75 font-mono text-right" dir="rtl">{job.result}</pre>
            : <RichContent text={job.result || ""} phase={job.phase} />}
        </div>
      </div>
    </div>
  );
}

// ── Archive Stats Bar ──────────────────────────────────────────────────────

function StatsBar({ jobs }: { jobs: any[] }) {
  const byphase = ALL_PHASES.map(p => ({ phase: p, count: jobs.filter(j => j.phase === p).length })).filter(x => x.count > 0);
  const totalChars = jobs.reduce((s, j) => s + (j.result?.length || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="text-2xl font-bold text-primary">{jobs.length}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">نتيجة محفوظة</div>
      </div>
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="text-2xl font-bold text-emerald-400">{(totalChars / 1000).toFixed(0)}k</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">حرف من المحتوى</div>
      </div>
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="text-2xl font-bold text-sky-400">{new Set(jobs.map(j => j.project_id)).size}</div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">مشاريع فريدة</div>
      </div>
      <div className="p-3 rounded-xl bg-card border border-border/50">
        <div className="flex flex-wrap gap-1 min-h-[28px] items-center">
          {byphase.map(({ phase, count }) => {
            const meta = PHASE_META[phase];
            const Icon = meta.icon;
            return (
              <span key={phase} className={`flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded-full ${meta.bgCls} ${meta.borderCls} border ${meta.textCls}`}>
                <Icon size={7} />{count}
              </span>
            );
          })}
        </div>
        <div className="text-xs font-mono text-muted-foreground mt-0.5">توزيع المراحل</div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const { data: projects } = useListProjects();
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "longest">("newest");
  const [viewJob, setViewJob] = useState<any | null>(null);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/production/archive?limit=500`);
      if (res.ok) setAllJobs(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchArchive(); }, []);

  const filtered = useMemo(() => {
    let list = allJobs;
    if (phaseFilter !== "all") list = list.filter(j => j.phase === phaseFilter);
    if (projectFilter !== "all") list = list.filter(j => j.project_id === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(j =>
        j.result?.toLowerCase().includes(q) ||
        j.project_title?.toLowerCase().includes(q) ||
        j.phase?.includes(q)
      );
    }
    if (sortOrder === "newest") list = [...list].sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
    else if (sortOrder === "oldest") list = [...list].sort((a, b) => new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime());
    else if (sortOrder === "longest") list = [...list].sort((a, b) => (b.result?.length || 0) - (a.result?.length || 0));
    return list;
  }, [allJobs, phaseFilter, projectFilter, search, sortOrder]);

  const uniqueProjects = useMemo(() => [...new Set(allJobs.map(j => ({ id: j.project_id, title: j.project_title })).map(JSON.stringify))].map(s => JSON.parse(s as string)), [allJobs]);

  return (
    <div className="space-y-6" dir="rtl">
      {viewJob && <FullResultModal job={viewJob} onClose={() => setViewJob(null)} />}

      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <Archive size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">أرشيف النتائج</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">
                {allJobs.length} نتيجة
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              جميع مخرجات الذكاء الاصطناعي · قابلة للبحث والتصفية والتصدير
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchArchive}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> تحديث
          </button>
          <button
            onClick={() => exportMarkdown(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40">
            <Download size={12} /> تصدير Markdown ({filtered.length})
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && allJobs.length > 0 && <StatsBar jobs={allJobs} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-card rounded-xl border border-border/50">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في المحتوى، المشروع، المرحلة…"
            className="pr-8 bg-secondary border-border/50 text-right text-sm"
            dir="rtl"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Phase filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setPhaseFilter("all")}
            className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${phaseFilter === "all" ? "bg-primary/10 border-primary/30 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
            <Filter size={11} /> الكل
          </button>
          {ALL_PHASES.map(p => {
            const meta = PHASE_META[p];
            const Icon = meta.icon;
            const count = allJobs.filter(j => j.phase === p).length;
            if (count === 0) return null;
            return (
              <button key={p} onClick={() => setPhaseFilter(phaseFilter === p ? "all" : p)}
                className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${phaseFilter === p ? `${meta.bgCls} ${meta.borderCls} ${meta.textCls}` : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                <Icon size={11} /> {meta.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Project & Sort */}
        <div className="flex items-center gap-2">
          <select
            value={projectFilter}
            onChange={e => setProjectFilter(e.target.value)}
            className="text-xs font-mono bg-secondary border border-border/50 rounded-lg px-2 py-1.5 text-muted-foreground focus:outline-none focus:border-primary/50"
            dir="rtl">
            <option value="all">كل المشاريع</option>
            {uniqueProjects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as any)}
            className="text-xs font-mono bg-secondary border border-border/50 rounded-lg px-2 py-1.5 text-muted-foreground focus:outline-none focus:border-primary/50"
            dir="rtl">
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
            <option value="longest">الأطول محتوى</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{search || phaseFilter !== "all" || projectFilter !== "all" ? `${filtered.length} من ${allJobs.length} نتيجة` : `${filtered.length} نتيجة`}</span>
          {(search || phaseFilter !== "all" || projectFilter !== "all") && (
            <button onClick={() => { setSearch(""); setPhaseFilter("all"); setProjectFilter("all"); }}
              className="flex items-center gap-1 text-primary/70 hover:text-primary transition-colors">
              <X size={10} /> مسح الفلاتر
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl bg-card border border-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Archive size={48} className="mx-auto mb-4 opacity-20" />
          {allJobs.length === 0 ? (
            <>
              <p className="font-medium">الأرشيف فارغ</p>
              <p className="text-xs mt-1 opacity-60">شغّل مراحل الإنتاج من صفحة "من القصة للرؤية" لتوليد المحتوى</p>
            </>
          ) : (
            <>
              <p className="font-medium">لا توجد نتائج مطابقة</p>
              <p className="text-xs mt-1 opacity-60">جرّب تغيير كلمة البحث أو الفلاتر</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(job => (
            <ResultCard key={job.id} job={job} onView={() => setViewJob(job)} />
          ))}
        </div>
      )}
    </div>
  );
}
