import { useState } from "react";
import {
  useListProjects, useListModels, useCreateProject, useGenerateProduction,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Film, Clapperboard, Image, Music, Mic, Video,
  Play, Plus, CheckCircle2, Clock, Zap, ChevronRight,
  Star, Cpu,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const PHASE_LABELS = [
  "Scripting", "Storyboard", "Voice Acting", "Image Gen", "Video Gen", "Music", "Assembly"
];

const PHASE_ICONS = [Clapperboard, Film, Mic, Image, Video, Music, Zap];

const STATUS_STYLES: Record<string, string> = {
  storyboard: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  scripting: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  generating: "text-primary bg-primary/10 border-primary/30",
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
};

const MODEL_TYPE_ICONS: Record<string, any> = {
  video: Video,
  image: Image,
  audio: Music,
  tts: Mic,
  music: Music,
  language: Zap,
};

export default function ProductionPage() {
  const { data: projects, isLoading: pLoad } = useListProjects();
  const { data: models, isLoading: mLoad } = useListModels();
  const createProject = useCreateProject();
  const generateProduction = useGenerateProduction();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"projects" | "models" | "new">("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", story_prompt: "", language: "ar",
    type: "short", duration_seconds: 90,
  });

  const projectData = projects?.find(p => p.id === selectedProject);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await createProject.mutateAsync(form as any);
    qc.invalidateQueries();
    setTab("projects");
    setSelectedProject(res?.id ?? null);
  }

  async function handleGenerate(projectId: string, type: string, model?: string) {
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await generateProduction.mutateAsync({ projectId, data: { type, model } });
      setGenResult(res?.job_id ? `Job queued: ${res.job_id} | Status: ${res.status}` : "Generation started.");
      qc.invalidateQueries();
    } catch (e: any) {
      setGenResult(`Error: ${e?.message}`);
    }
    setGenerating(false);
  }

  const TABS = [
    { key: "projects", label: "Projects", icon: Film },
    { key: "models", label: "Model Registry", icon: Cpu },
    { key: "new", label: "New Project", icon: Plus },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400">
            <Film size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">From Storyboard To Vision</h1>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono text-xs">CINEMATIC PIPELINE</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              End-to-end AI film production · story → video · Arabic & English
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
                <p>No projects yet — create your first film</p>
                <Button onClick={() => setTab("new")} className="mt-4 gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20">
                  <Plus size={14} /> New Project
                </Button>
              </div>
            ) : projects.map(p => (
              <button key={p.id} onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
                className={`w-full text-left p-5 rounded border transition-all ${selectedProject === p.id ? "border-purple-400/50 bg-purple-500/5" : "border-border/50 bg-card hover:border-purple-400/30"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{p.title}</span>
                      {p.title_ar && <span className="text-sm opacity-60 font-serif" dir="rtl">{p.title_ar}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs font-mono ${STATUS_STYLES[p.status] ?? "bg-secondary text-muted-foreground border-border/50"}`}>{p.status}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{p.type}</span>
                      <span className="text-xs text-muted-foreground font-mono">{p.duration_seconds}s</span>
                      <span className="text-xs text-muted-foreground font-mono">{p.language}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono text-muted-foreground">
                    <div>{p.assets_generated} assets</div>
                    <div>{p.scenes_count} scenes</div>
                  </div>
                </div>

                {/* Phase Progress */}
                <div className="flex items-center gap-1">
                  {PHASE_LABELS.map((label, i) => {
                    const done = i < (p.phase ?? 0);
                    const active = i === (p.phase ?? 0);
                    const PhaseIcon = PHASE_ICONS[i];
                    return (
                      <div key={label} className="flex items-center gap-0.5">
                        <div className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono ${done ? "text-emerald-400 bg-emerald-400/10" : active ? "text-purple-400 bg-purple-500/10 animate-pulse" : "text-muted-foreground/40 bg-secondary/40"}`}>
                          <PhaseIcon size={8} />
                          <span className="hidden sm:inline">{label}</span>
                        </div>
                        {i < PHASE_LABELS.length - 1 && <ChevronRight size={8} className="text-muted-foreground/20" />}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.story_prompt}</p>
              </button>
            ))}
          </div>

          {/* Project Detail Panel */}
          <div className="space-y-4">
            {projectData ? (
              <>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Production Actions</div>
                <div className="p-4 bg-card border border-border/50 rounded space-y-3">
                  <div className="font-bold mb-2">{projectData.title}</div>
                  {[
                    { type: "storyboard", label: "Generate Storyboard", icon: Clapperboard },
                    { type: "image", label: "Generate Images", icon: Image },
                    { type: "video", label: "Generate Video", icon: Video },
                    { type: "tts", label: "Generate Voice", icon: Mic },
                    { type: "music", label: "Generate Music", icon: Music },
                  ].map(action => (
                    <Button key={action.type} onClick={() => handleGenerate(projectData.id, action.type)}
                      disabled={generating}
                      className="w-full gap-2 bg-secondary border border-border/50 hover:border-purple-400/30 hover:bg-purple-500/10 text-foreground justify-start">
                      <action.icon size={14} className="text-purple-400" />
                      {action.label}
                    </Button>
                  ))}
                  {genResult && (
                    <div className="p-2 rounded border border-purple-400/20 bg-purple-500/5 text-xs font-mono text-purple-300">
                      {genResult}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 bg-card border border-border/50 rounded text-center text-muted-foreground text-sm py-8">
                <Film size={32} className="mx-auto mb-3 opacity-30" />
                <p>Select a project to see production actions</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "models" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">AI Model Registry — 2026</div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mLoad ? (
              Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-40 bg-card border border-border/50" />)
            ) : models?.map(model => {
              const Icon = MODEL_TYPE_ICONS[model.type] ?? Cpu;
              return (
                <div key={model.id} className="p-4 rounded border border-border/50 bg-card hover:border-purple-400/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Icon size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{model.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{model.provider}</div>
                      </div>
                    </div>
                    {model.is_free && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">FREE</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className="bg-secondary border-border/50 text-muted-foreground text-[10px] font-mono capitalize">{model.type}</Badge>
                    {model.supports_arabic && (
                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">عربي ✓</Badge>
                    )}
                  </div>
                  {model.quality_score && (
                    <div className="flex items-center gap-1 text-xs text-amber-400 font-mono mb-2">
                      <Star size={10} />
                      <span>{model.quality_score}/10</span>
                    </div>
                  )}
                  {model.cost_per_unit && (
                    <div className="text-xs text-muted-foreground font-mono">{model.cost_per_unit}</div>
                  )}
                  {model.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "new" && (
        <div className="max-w-2xl mx-auto">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Create New Production</div>
          <form onSubmit={handleCreate} className="p-6 bg-card border border-border/50 rounded space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Project Title</label>
              <Input required placeholder="الخوارزمي / The Algorithm" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Story Prompt</label>
              <Textarea required rows={5}
                placeholder="اكتب القصة هنا... / Write your story here...\n\nExample: قصة عالم عربي يكتشف آلة الزمن في القاهرة القديمة — A story of an Arab scientist who discovers a time machine in old Cairo."
                value={form.story_prompt}
                onChange={e => setForm(f => ({ ...f, story_prompt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Language</label>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground">
                  <option value="ar">Arabic (عربي)</option>
                  <option value="en">English</option>
                  <option value="both">Bilingual</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground">
                  <option value="short">Short Film</option>
                  <option value="documentary">Documentary</option>
                  <option value="film">Feature Film</option>
                  <option value="series">Series Episode</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Duration (sec)</label>
                <Input type="number" min={30} max={600} value={form.duration_seconds}
                  onChange={e => setForm(f => ({ ...f, duration_seconds: Number(e.target.value) }))} />
              </div>
            </div>
            <Button type="submit" disabled={createProject.isPending}
              className="w-full gap-2 bg-purple-500 hover:bg-purple-600 text-white">
              {createProject.isPending ? <Clock size={14} className="animate-spin" /> : <Play size={14} />}
              {createProject.isPending ? "Creating…" : "Launch Production"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
