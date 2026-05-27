import { useState } from "react";
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
  Play, Plus, CheckCircle2, Clock, Zap, ChevronLeft,
  Star, Cpu, X, FileText, RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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

const MODEL_TYPE_ICONS: Record<string, any> = {
  video: Video, image: Image, audio: Music, tts: Mic, music: Music, language: Zap,
};

function JobResultViewer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: job, isLoading } = useGetGenerationJob(jobId);

  const phaseNameAr: Record<string, string> = {
    script: "السيناريو", storyboard: "اللوحة المصورة",
    audio: "الصوت", music: "الموسيقى", assembly: "التجميع",
    images: "الصور", video: "الفيديو",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-card border border-purple-500/30 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X size={16} /></button>
          <div className="text-right">
            <h3 className="font-bold">نتيجة التوليد الذكي</h3>
            {job && (
              <p className="text-xs text-muted-foreground font-mono">
                {phaseNameAr[job.phase] || job.phase} · {job.model_used} ·
                <span className={job.status === "completed" ? " text-emerald-400" : job.status === "failed" ? " text-red-400" : " text-amber-400"}>
                  {job.status === "completed" ? " مكتمل" : job.status === "failed" ? " فشل" : " جارٍ…"}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock size={24} className="mx-auto mb-2 animate-spin" />
              <p className="text-sm">جارٍ التحميل…</p>
            </div>
          )}
          {job?.status === "running" && !job?.result && (
            <div className="text-center py-8 text-amber-400">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
              <p className="text-sm font-mono">الذكاء الاصطناعي يعمل… يرجى الانتظار</p>
              <p className="text-xs text-muted-foreground mt-1">الوقت المتوقع: {job.estimated_seconds}ث</p>
            </div>
          )}
          {job?.result && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-mono" dir="rtl">
              {job.result}
            </div>
          )}
          {job?.status === "failed" && !job?.result && (
            <div className="text-red-400 text-sm p-3 border border-red-400/20 rounded bg-red-400/5">
              فشل التوليد — تحقق من مفاتيح API
            </div>
          )}
        </div>
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
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [form, setForm] = useState({ title: "", story_prompt: "", language: "ar", type: "short", duration_seconds: 90 });

  const { data: projectJobs } = useGetProjectJobs(selectedProject);
  const projectData = projects?.find(p => p.id === selectedProject);

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
    try {
      const res = await generateProd.mutateAsync({ projectId, data: { type } as any });
      if (res?.job_id) {
        setActiveJobId(res.job_id);
        setShowJobModal(true);
        setTimeout(() => {
          refetchProjects();
          qc.invalidateQueries();
        }, 3000);
      }
    } catch (e: any) {
      console.error(e);
    }
    setGenerating(false);
  }

  const TABS = [
    { key: "projects", label: "المشاريع", icon: Film },
    { key: "models",   label: "سجل النماذج", icon: Cpu },
    { key: "new",      label: "مشروع جديد", icon: Plus },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
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
              <button key={p.id} onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
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
            ))}
          </div>

          <div className="space-y-4">
            {projectData ? (
              <>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">إجراءات الإنتاج</div>
                <div className="p-4 bg-card border border-border/50 rounded space-y-3">
                  <div className="font-bold mb-2 text-right">{projectData.title_ar || projectData.title}</div>
                  <p className="text-xs text-muted-foreground text-right leading-relaxed border-r-2 border-purple-500/30 pr-2">
                    {projectData.story_prompt?.substring(0, 150)}{(projectData.story_prompt?.length ?? 0) > 150 ? "…" : ""}
                  </p>
                  <div className="space-y-2 pt-1">
                    {[
                      { type: "script",     label: "توليد السيناريو",   icon: FileText,    note: "ذكاء اصطناعي" },
                      { type: "storyboard", label: "توليد اللوحة المصورة + برومبت", icon: Clapperboard, note: "ذكاء اصطناعي" },
                      { type: "audio",      label: "تصميم المشهد الصوتي", icon: Mic,       note: "ذكاء اصطناعي" },
                      { type: "music",      label: "الهوية الموسيقية",   icon: Music,      note: "ذكاء اصطناعي" },
                      { type: "assembly",   label: "جدول المونتاج",      icon: Zap,        note: "ذكاء اصطناعي" },
                    ].map(action => (
                      <Button key={action.type} onClick={() => handleGenerate(projectData.id, action.type)}
                        disabled={generating}
                        className="w-full gap-2 bg-secondary border border-border/50 hover:border-purple-400/30 hover:bg-purple-500/10 text-foreground justify-start text-xs h-9">
                        <action.icon size={13} className="text-purple-400 shrink-0" />
                        <span className="flex-1 text-right">{action.label}</span>
                        <span className="text-[10px] text-purple-400/60 font-mono shrink-0">{action.note}</span>
                      </Button>
                    ))}
                  </div>
                  {generating && (
                    <div className="text-xs text-purple-400 font-mono text-center animate-pulse">
                      الذكاء الاصطناعي يعمل…
                    </div>
                  )}
                </div>

                {projectJobs && projectJobs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">مهام التوليد</div>
                    {projectJobs.slice(0, 6).map((job: any) => (
                      <button key={job.id}
                        onClick={() => { setActiveJobId(job.id); setShowJobModal(true); }}
                        className="w-full p-2 rounded border border-border/40 bg-card hover:border-purple-400/30 text-right text-xs flex items-center justify-between gap-2">
                        <span className={`font-mono shrink-0 ${job.status === "completed" ? "text-emerald-400" : job.status === "failed" ? "text-red-400" : "text-amber-400 animate-pulse"}`}>
                          {job.status === "completed" ? "✓" : job.status === "failed" ? "✗" : "⋯"}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">{
                          { script: "السيناريو", storyboard: "اللوحة المصورة", audio: "الصوت", music: "الموسيقى", assembly: "التجميع", images: "الصور", video: "الفيديو" }[job.phase] || job.phase
                        }</span>
                        <span className="text-purple-400/60 shrink-0">عرض ←</span>
                      </button>
                    ))}
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
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} dir="rtl" className="text-right" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">فكرة القصة</label>
              <Textarea required rows={5}
                placeholder="اكتب القصة هنا…&#10;&#10;مثال: قصة عالم عربي يكتشف آلة الزمن في القاهرة القديمة"
                value={form.story_prompt}
                onChange={e => setForm(f => ({ ...f, story_prompt: e.target.value }))}
                dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">اللغة</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                  <option value="ar">عربي</option>
                  <option value="en">إنجليزي</option>
                  <option value="both">ثنائي اللغة</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">النوع</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                  <option value="short">فيلم قصير</option>
                  <option value="documentary">وثائقي</option>
                  <option value="film">فيلم روائي</option>
                  <option value="series">حلقة مسلسل</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">المدة (ثانية)</label>
                <Input type="number" min={30} max={600} value={form.duration_seconds}
                  onChange={e => setForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))} className="text-right" dir="rtl" />
              </div>
            </div>
            <Button type="submit" disabled={createProject.isPending}
              className="w-full gap-2 bg-purple-500 hover:bg-purple-600 text-white">
              {createProject.isPending ? <Clock size={14} className="animate-spin" /> : <Play size={14} />}
              {createProject.isPending ? "جارٍ الإنشاء…" : "إطلاق الإنتاج"}
            </Button>
          </form>
        </div>
      )}

      {showJobModal && activeJobId && (
        <JobResultViewer jobId={activeJobId} onClose={() => setShowJobModal(false)} />
      )}
    </div>
  );
}
