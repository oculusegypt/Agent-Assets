import { useState } from "react";
import { useListAgents, useListAgentExecutions, useExecuteAgent } from "@workspace/api-client-react";
import { useAgentPipeline } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MonitorPlay, Clapperboard, Eye, Music, Layers, Zap,
  CheckCircle2, Clock, AlertCircle, ChevronLeft, Film,
  Cpu, Play, BarChart3, GitBranch, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SYSTEM_LABEL_COLORS: Record<string, string> = {
  ACIS:              "bg-primary/10 text-primary border-primary/30",
  StoryboardToVision:"bg-purple-500/10 text-purple-400 border-purple-500/30",
  NEXUS:             "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CAEOS:             "bg-orange-500/10 text-orange-400 border-orange-500/30",
  BILLIE:            "bg-pink-500/10 text-pink-400 border-pink-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  online:  "bg-emerald-500",
  busy:    "bg-primary animate-pulse",
  offline: "bg-red-500",
  idle:    "bg-muted-foreground",
};

const AGENT_ICONS: Record<string, any> = {
  "story-architect":   Clapperboard,
  "honesty-auditor":   Eye,
  "sound-music":       Music,
  "scene-breakdown":   Layers,
  "gpu-render-workers":Cpu,
  "model-orchestrator":Zap,
  "timeline-assembly": Film,
  "post-production":   Layers,
};

const PIPELINE_PHASES = [
  { label: "القصة",    icon: Clapperboard, agents: ["story-architect", "scene-breakdown"],          color: "primary" },
  { label: "السيناريو",icon: Film,          agents: ["honesty-auditor", "cinematic-director"],       color: "purple" },
  { label: "المرئيات", icon: MonitorPlay,   agents: ["visual-storyboard", "ai-prompt-director"],    color: "sky" },
  { label: "التوليد",  icon: Cpu,           agents: ["model-orchestrator", "gpu-render-workers"],   color: "amber" },
  { label: "الصوت",    icon: Music,         agents: ["sound-music"],                                color: "emerald" },
  { label: "التجميع",  icon: Layers,        agents: ["timeline-assembly", "post-production"],       color: "orange" },
];

const CINEMATIC_PIPELINE = [
  "story-architect", "scene-breakdown", "emotional-narrative",
  "visual-storyboard", "ai-prompt-director", "sound-music",
];

export default function AcisPage() {
  const { data: allAgents, isLoading } = useListAgents();
  const { data: executions } = useListAgentExecutions({ limit: 20 });
  const executeAgent = useExecuteAgent();
  const runPipeline = useAgentPipeline();
  const qc = useQueryClient();

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);

  const [pipelinePrompt, setPipelinePrompt] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  const acisAgents = allAgents?.filter(a => a.system === "ACIS" || a.system === "StoryboardToVision") ?? [];
  const acisOnly = allAgents?.filter(a => a.system === "ACIS") ?? [];
  const selectedAgentData = acisAgents.find(a => a.id === selectedAgent);

  async function handleExecute() {
    if (!selectedAgent || !prompt.trim()) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await executeAgent.mutateAsync({
        agentId: selectedAgent,
        data: { action: prompt, parameters: {} },
      });
      setResult(res?.result ?? "اكتمل التنفيذ.");
      qc.invalidateQueries();
    } catch (e: any) {
      setResult(`خطأ: ${e?.message ?? "حدث خطأ غير معروف"}`);
    }
    setExecuting(false);
  }

  async function handleRunPipeline() {
    if (!pipelinePrompt.trim()) return;
    setPipelineRunning(true);
    setPipelineResult(null);
    try {
      const res = await runPipeline.mutateAsync({
        agent_ids: CINEMATIC_PIPELINE,
        input: pipelinePrompt,
        pipeline_name: "خط الإنتاج السينمائي الكامل",
      });
      setPipelineResult(res);
      setShowPipelineModal(true);
      qc.invalidateQueries();
    } catch (e: any) {
      setPipelineResult({ error: e?.message });
      setShowPipelineModal(true);
    }
    setPipelineRunning(false);
  }

  const onlineCount = acisOnly.filter(a => a.status === "online").length;
  const busyCount   = acisOnly.filter(a => a.status === "busy").length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <MonitorPlay size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">ACIS السينمائي</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">إنتاج أفلام الذكاء الاصطناعي</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {onlineCount} متصل · {busyCount} مشغول · {acisOnly.length} وكيل إجمالاً
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-primary">خط الإنتاج نشط</span>
        </div>
      </div>

      {/* Production Pipeline Visualization */}
      <div className="p-4 rounded border border-border/50 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">خط الإنتاج</div>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2 flex-row-reverse">
          {PIPELINE_PHASES.map((phase, i) => (
            <div key={phase.label} className="flex items-center gap-1 shrink-0">
              {i < PIPELINE_PHASES.length - 1 && (
                <ChevronLeft size={14} className={i < activePhase ? "text-emerald-400" : "text-muted-foreground/30"} />
              )}
              <button onClick={() => setActivePhase(i)}
                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded transition-all border ${
                  i === activePhase
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : i < activePhase
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/20"
                }`}>
                <phase.icon size={16} />
                <span className="text-xs font-mono font-bold">{phase.label}</span>
                {i < activePhase && <CheckCircle2 size={10} className="text-emerald-400" />}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs font-mono text-muted-foreground text-right">
          المرحلة النشطة: <span className="text-primary">{PIPELINE_PHASES[activePhase].label}</span>
          {" · "}الوكلاء: {PIPELINE_PHASES[activePhase].agents.join("، ")}
        </div>
      </div>

      {/* Full Pipeline Execution */}
      <div className="p-4 rounded border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm font-bold">تشغيل خط الإنتاج الكامل</span>
          <GitBranch size={16} className="text-primary" />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          يُشغّل 6 وكلاء بالتسلسل: معمار القصة ← محلل المشاهد ← السرد العاطفي ← مصمم اللوحة ← مخرج البرومبت ← الصوت
        </p>
        <Textarea
          placeholder="أدخل فكرة القصة هنا… مثال: رحلة عالم عربي يكتشف آلة الزمن في القاهرة القديمة"
          rows={3}
          value={pipelinePrompt}
          onChange={e => setPipelinePrompt(e.target.value)}
          dir="rtl" className="text-right bg-background/50"
        />
        <Button onClick={handleRunPipeline} disabled={pipelineRunning || !pipelinePrompt.trim()}
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          {pipelineRunning ? (
            <><Clock size={14} className="animate-spin" />الوكلاء يعملون… قد يستغرق دقيقتين</>
          ) : (
            <><GitBranch size={14} />تشغيل خط الإنتاج الكامل (6 وكلاء)</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">قائمة الوكلاء</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isLoading
              ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 bg-card border border-border/50" />)
              : acisAgents.map(agent => {
                  const Icon = AGENT_ICONS[agent.id] ?? Play;
                  return (
                    <button key={agent.id} onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                      className={`p-4 rounded border text-right transition-all hover:border-primary/30 group ${
                        selectedAgent === agent.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 bg-card"
                      }`}>
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={`text-[10px] font-mono ${SYSTEM_LABEL_COLORS[agent.system] ?? "bg-secondary border-border/50 text-muted-foreground"}`}>
                          {agent.system}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{agent.nameAr || agent.name}</span>
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-muted-foreground"}`} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{agent.descriptionAr || agent.description}</p>
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BarChart3 size={10} />
                          <span>{agent.executions_today ?? 0}</span>
                        </div>
                        <span>{agent.model?.split("-").slice(0, 2).join("-")}</span>
                      </div>
                      {(agent.capabilities as string[])?.slice(0, 2).map((cap: string) => (
                        <span key={cap} className="inline-block text-[10px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground font-mono ml-1 mt-1">{cap}</span>
                      ))}
                    </button>
                  );
                })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">تفاعل مع الوكيل</div>
          <div className="p-4 rounded border border-border/50 bg-card space-y-3">
            {selectedAgentData ? (
              <>
                <div className="flex items-center gap-2 justify-end">
                  <span className="font-bold text-sm">{selectedAgentData.nameAr || selectedAgentData.name}</span>
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[selectedAgentData.status]}`} />
                </div>
                <p className="text-xs text-muted-foreground text-right">{selectedAgentData.descriptionAr || selectedAgentData.description}</p>
                <Textarea
                  placeholder={`أرسل مهمة إلى ${selectedAgentData.nameAr || selectedAgentData.name}…`}
                  rows={5} value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  dir="rtl" className="text-right"
                />
                <Button onClick={handleExecute} disabled={executing || !prompt.trim()}
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {executing ? (
                    <><Clock size={14} className="animate-spin" />جارٍ المعالجة…</>
                  ) : (
                    <><Play size={14} />تشغيل الوكيل</>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MonitorPlay size={32} className="mx-auto mb-3 opacity-30" />
                <p>اختر وكيلاً من القائمة للتفاعل معه</p>
              </div>
            )}

            {result && (
              <div className="p-3 rounded border border-primary/20 bg-primary/5 text-xs font-mono text-foreground/90 whitespace-pre-wrap max-h-64 overflow-y-auto" dir="rtl">
                <div className="text-primary text-xs mb-1 font-bold">نتيجة التنفيذ:</div>
                {result}
              </div>
            )}
          </div>

          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">آخر التنفيذات</div>
          <div className="space-y-2">
            {executions?.slice(0, 5).map(ex => (
              <div key={ex.id} className="p-3 rounded border border-border/50 bg-card text-xs" dir="rtl">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono ${ex.status === "completed" ? "text-emerald-400" : ex.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                    {ex.status === "completed" ? <CheckCircle2 size={10} className="inline ml-1" /> : ex.status === "failed" ? <AlertCircle size={10} className="inline ml-1" /> : <Clock size={10} className="inline ml-1" />}
                    {ex.status === "completed" ? "مكتمل" : ex.status === "failed" ? "فشل" : "جارٍ"}
                  </span>
                  <span className="font-mono text-muted-foreground">{ex.agent_id}</span>
                </div>
                <div className="text-muted-foreground line-clamp-1 text-right">{ex.input || ex.action}</div>
                {ex.duration_ms && <div className="text-muted-foreground/60 mt-1 text-left">{ex.duration_ms}ms</div>}
              </div>
            ))}
            {!executions?.length && <div className="text-center text-muted-foreground text-xs py-4">لا توجد تنفيذات بعد</div>}
          </div>
        </div>
      </div>

      {/* Pipeline Result Modal */}
      {showPipelineModal && pipelineResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-card border border-primary/30 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <button onClick={() => setShowPipelineModal(false)} className="p-1 hover:bg-secondary rounded">
                <X size={16} />
              </button>
              <div className="text-right">
                <h3 className="font-bold">نتائج خط الإنتاج الكامل</h3>
                {pipelineResult.agent_count && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {pipelineResult.agent_count} وكيل · {pipelineResult.total_tokens?.toLocaleString()} رمز · {Math.floor((pipelineResult.total_duration_ms || 0) / 1000)}ث
                  </p>
                )}
              </div>
            </div>
            {pipelineResult.error ? (
              <div className="p-4 text-red-400 text-sm">{pipelineResult.error}</div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {pipelineResult.steps?.map((step: any, i: number) => (
                  <div key={i} className="p-4 border-b border-border/30">
                    <div className="flex items-center gap-2 mb-2 justify-end">
                      <span className="font-mono text-xs text-muted-foreground">{step.model} · {step.duration_ms}ms · {step.tokens} رمز</span>
                      <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] font-mono">
                        المرحلة {i + 1}
                      </Badge>
                      <span className="font-bold text-sm">{step.agent_name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap text-right leading-relaxed max-h-40 overflow-y-auto">
                      {step.result}
                    </div>
                  </div>
                ))}
                {pipelineResult.final_output && (
                  <div className="p-4 bg-primary/5">
                    <div className="text-xs font-mono text-primary uppercase tracking-widest mb-2 text-right">المخرج النهائي</div>
                    <div className="text-sm whitespace-pre-wrap text-right leading-relaxed">{pipelineResult.final_output}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
