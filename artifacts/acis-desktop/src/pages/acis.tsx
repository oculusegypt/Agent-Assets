import { useState, useRef, useCallback } from "react";
import { useListAgents, useListAgentExecutions, useExecuteAgent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  MonitorPlay, Clapperboard, Eye, Music, Layers, Zap,
  CheckCircle2, Clock, AlertCircle, Film, Cpu, Play,
  BarChart3, GitBranch, X, ChevronUp, ChevronDown,
  Plus, Minus, Sparkles, ArrowRight, Brain, Timer,
  ChevronDown as ExpandIcon, ChevronRight as CollapseIcon,
  Loader2, Trophy, Coins,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
function getApiUrl(path: string) {
  return `${BASE_URL}/${path.replace(/^\//, "")}`;
}

/* ─── Constants ─────────────────────────────────────────────── */

const SYSTEM_COLORS: Record<string, string> = {
  ACIS:              "bg-primary/10 text-primary border-primary/30",
  StoryboardToVision:"bg-purple-500/10 text-purple-400 border-purple-500/30",
  NEXUS:             "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CAEOS:             "bg-orange-500/10 text-orange-400 border-orange-500/30",
  BILLIE:            "bg-pink-500/10 text-pink-400 border-pink-500/30",
};

const STATUS_DOT: Record<string, string> = {
  online:  "bg-emerald-500",
  busy:    "bg-primary animate-pulse",
  offline: "bg-red-500",
  idle:    "bg-muted-foreground",
};

const STEP_STATUS_STYLE = {
  pending:  { border: "border-border/30",         bg: "bg-card",          text: "text-muted-foreground" },
  running:  { border: "border-primary/60",        bg: "bg-primary/5",     text: "text-primary" },
  done:     { border: "border-emerald-500/50",    bg: "bg-emerald-500/5", text: "text-emerald-400" },
  error:    { border: "border-red-500/50",        bg: "bg-red-500/5",     text: "text-red-400" },
};

/* ─── Types ──────────────────────────────────────────────────── */

type StepState = {
  agent_id:   string;
  agent_name: string;
  status:     "pending" | "running" | "done" | "error";
  result?:    string;
  tokens?:    number;
  model?:     string;
  duration_ms?: number;
  expanded:   boolean;
};

/* ─── Pipeline Studio ────────────────────────────────────────── */

function PipelineStudio({ agents }: { agents: any[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "story-architect", "scene-breakdown", "emotional-narrative",
    "visual-storyboard", "sound-music",
  ]);
  const [pipelineName, setPipelineName] = useState("خط الإنتاج السينمائي المخصص");
  const [idea, setIdea] = useState("");
  const [steps, setSteps] = useState<StepState[]>([]);
  const [running, setRunning] = useState(false);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [stats, setStats] = useState<{ tokens: number; duration_ms: number; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();

  const orderedAgents = selectedIds
    .map(id => agents.find(a => a.id === id))
    .filter(Boolean);

  const availableAgents = agents.filter(a => !selectedIds.includes(a.id));

  function toggleAgent(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setSelectedIds(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    if (idx === selectedIds.length - 1) return;
    setSelectedIds(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function removeAgent(id: string) {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }

  function toggleExpand(idx: number) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, expanded: !s.expanded } : s));
  }

  function abort() {
    abortRef.current?.abort();
    setRunning(false);
    setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "error" } : s));
  }

  const launch = useCallback(async () => {
    if (!idea.trim() || selectedIds.length === 0 || running) return;

    setRunning(true);
    setFinalOutput(null);
    setStats(null);
    setError(null);

    const initialSteps: StepState[] = selectedIds.map(id => ({
      agent_id: id,
      agent_name: agents.find(a => a.id === id)?.nameAr || agents.find(a => a.id === id)?.name || id,
      status: "pending",
      expanded: false,
    }));
    setSteps(initialSteps);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(getApiUrl("api/agents/pipeline-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_ids: selectedIds, input: idea, pipeline_name: pipelineName }),
        signal: ctrl.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("لا يوجد ReadableStream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "step_start") {
              setSteps(prev => prev.map((s, i) =>
                i === event.index ? { ...s, status: "running", expanded: true } : s
              ));
            } else if (event.type === "step_complete") {
              setSteps(prev => prev.map((s, i) =>
                i === event.index
                  ? {
                      ...s,
                      status: "done",
                      result: event.step.result,
                      tokens: event.step.tokens,
                      model: event.step.model,
                      duration_ms: event.step.duration_ms,
                      expanded: true,
                    }
                  : s
              ));
            } else if (event.type === "pipeline_complete") {
              setFinalOutput(event.final_output);
              setStats({ tokens: event.total_tokens, duration_ms: event.total_duration_ms, count: event.agent_count });
              qc.invalidateQueries();
            } else if (event.type === "pipeline_error") {
              setError(event.error);
              setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "error" } : s));
            } else if (event.type === "step_skip") {
              setSteps(prev => prev.map((s, i) =>
                i === event.index ? { ...s, status: "error" } : s
              ));
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "فشل الاتصال");
        setSteps(prev => prev.map(s => s.status === "running" ? { ...s, status: "error" } : s));
      }
    }

    setRunning(false);
  }, [idea, selectedIds, pipelineName, agents, running]);

  const completedCount = steps.filter(s => s.status === "done").length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 justify-end">
        <div className="text-right">
          <h2 className="text-lg font-bold flex items-center gap-2 justify-end">
            <span>استوديو خط الأنابيب</span>
            <GitBranch size={18} className="text-primary" />
          </h2>
          <p className="text-xs text-muted-foreground font-mono">اختر الوكلاء ورتّبهم — كل وكيل يبني على عمل من قبله</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* LEFT: Agent Selector */}
        <div className="xl:col-span-2 space-y-4">
          {/* Pipeline order */}
          <div className="p-4 rounded border border-border/50 bg-card space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-muted-foreground">{selectedIds.length} وكيل</span>
              <div className="text-xs font-mono text-primary uppercase tracking-widest">ترتيب خط الأنابيب</div>
            </div>

            {selectedIds.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-6 border border-dashed border-border/40 rounded">
                اختر وكلاء من القائمة أدناه
              </div>
            )}

            <div className="space-y-1.5">
              {orderedAgents.map((agent, idx) => {
                const style = STEP_STATUS_STYLE[steps[idx]?.status ?? "pending"];
                return (
                  <div key={agent.id}
                    className={`flex items-center gap-2 p-2.5 rounded border transition-all ${style.border} ${style.bg}`}>
                    {/* Number */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${
                      steps[idx]?.status === "done"    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      steps[idx]?.status === "running" ? "bg-primary/20 text-primary border border-primary/40 animate-pulse" :
                      "bg-secondary text-muted-foreground border border-border/40"
                    }`}>
                      {steps[idx]?.status === "done" ? "✓" : steps[idx]?.status === "running" ? "⋯" : idx + 1}
                    </div>

                    {/* Name */}
                    <div className="flex-1 text-right min-w-0">
                      <div className={`text-xs font-bold truncate ${style.text}`}>{agent.nameAr || agent.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground/60 truncate">{agent.system}</div>
                    </div>

                    {/* Controls */}
                    {!running && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => moveUp(idx)} disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 text-muted-foreground hover:text-foreground">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveDown(idx)} disabled={idx === selectedIds.length - 1}
                          className="p-0.5 rounded hover:bg-secondary disabled:opacity-20 text-muted-foreground hover:text-foreground">
                          <ChevronDown size={12} />
                        </button>
                        <button onClick={() => removeAgent(agent.id)}
                          className="p-0.5 rounded hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/50">
                          <X size={11} />
                        </button>
                      </div>
                    )}

                    {/* Running indicator */}
                    {steps[idx]?.status === "running" && (
                      <Loader2 size={12} className="text-primary animate-spin shrink-0" />
                    )}
                    {steps[idx]?.status === "done" && steps[idx]?.tokens && (
                      <span className="text-[9px] font-mono text-emerald-400/60 shrink-0">{steps[idx].tokens}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Arrow between last agent and output */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-center py-1">
                <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/40">
                  <ArrowRight size={10} className="rotate-90" />
                  <span>مخرج تكاملي</span>
                </div>
              </div>
            )}
          </div>

          {/* Available agents to add */}
          <div className="p-3 rounded border border-border/40 bg-card/50 space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-right">
              إضافة وكلاء ({availableAgents.length})
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {availableAgents.map(agent => (
                <button key={agent.id} onClick={() => toggleAgent(agent.id)}
                  className="w-full flex items-center gap-2 p-2 rounded border border-border/30 bg-card hover:border-primary/30 hover:bg-primary/5 text-right transition-colors group">
                  <Plus size={12} className="text-primary opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-xs font-medium truncate">{agent.nameAr || agent.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground/60 truncate">{agent.system}</div>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[agent.status] ?? "bg-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Idea + Controls + Live results */}
        <div className="xl:col-span-3 space-y-4 flex flex-col">
          {/* Pipeline name */}
          <div className="flex items-center gap-2">
            <Input value={pipelineName} onChange={e => setPipelineName(e.target.value)}
              className="text-right h-8 text-sm bg-secondary border-border/40 font-mono" dir="rtl"
              placeholder="اسم خط الأنابيب" disabled={running} />
          </div>

          {/* Idea input */}
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-right">الفكرة الأساسية المشتركة</div>
            <Textarea
              placeholder={`اكتب الفكرة التي سيعمل عليها جميع الوكلاء بالتسلسل…\n\nمثال: فيلم قصير عن عالم عربي يكتشف آلة الزمن في القاهرة القديمة — يسافر لعصر ابن خلدون ويشهد بناء أعظم نظرية في التاريخ`}
              rows={5} value={idea}
              onChange={e => setIdea(e.target.value)}
              dir="rtl" className="text-right resize-none bg-background"
              disabled={running}
            />
          </div>

          {/* Progress bar */}
          {steps.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="text-primary">{Math.round(progress)}%</span>
                <span>{completedCount}/{steps.length} وكيل أكمل</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-primary to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Launch / Abort */}
          <div className="flex gap-2">
            {running ? (
              <Button onClick={abort}
                className="flex-1 gap-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 h-11">
                <X size={15} /> إيقاف خط الأنابيب
              </Button>
            ) : (
              <Button onClick={launch}
                disabled={!idea.trim() || selectedIds.length === 0}
                className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-base font-bold">
                <Sparkles size={16} />
                تشغيل {selectedIds.length > 0 ? `${selectedIds.length} وكلاء` : "خط الأنابيب"}
              </Button>
            )}
          </div>

          {error && (
            <div className="p-3 rounded border border-red-500/30 bg-red-500/5 text-red-400 text-sm flex items-start gap-2" dir="rtl">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-4 p-3 rounded border border-emerald-500/20 bg-emerald-500/5 text-xs font-mono" dir="rtl">
              <div className="flex items-center gap-1 text-emerald-400">
                <Trophy size={12} />
                <span>{stats.count} وكيل أكمل</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <Coins size={12} />
                <span>{stats.tokens.toLocaleString("ar-SA")} رمز</span>
              </div>
              <div className="flex items-center gap-1 text-sky-400">
                <Timer size={12} />
                <span>{Math.round(stats.duration_ms / 1000)}ث</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Live Step Results ─────────────────────────────────── */}
      {steps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-muted-foreground/50">
              {running ? "يعمل الآن…" : finalOutput ? "✓ اكتمل" : ""}
            </div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">نتائج الوكلاء المباشرة</div>
          </div>

          <div className="space-y-2">
            {steps.map((step, idx) => {
              const style = STEP_STATUS_STYLE[step.status];
              return (
                <div key={step.agent_id + idx}
                  className={`rounded border transition-all ${style.border} ${style.bg}`}>
                  {/* Step header */}
                  <button
                    className="w-full flex items-center gap-3 p-3 text-right"
                    onClick={() => step.result && toggleExpand(idx)}>
                    {/* Step number */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                      step.status === "done"    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" :
                      step.status === "running" ? "bg-primary/20 text-primary border border-primary/40" :
                      step.status === "error"   ? "bg-red-500/20 text-red-400 border border-red-500/40" :
                      "bg-secondary text-muted-foreground border border-border/40"
                    }`}>
                      {step.status === "done"    ? <CheckCircle2 size={13} /> :
                       step.status === "running" ? <Loader2 size={13} className="animate-spin" /> :
                       step.status === "error"   ? <AlertCircle size={13} /> :
                       idx + 1}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 text-right">
                      <div className={`font-bold text-sm ${style.text}`}>{step.agent_name}</div>
                      {step.status === "running" && (
                        <div className="text-xs font-mono text-primary/60 animate-pulse">يعمل على الفكرة…</div>
                      )}
                      {step.status === "done" && (
                        <div className="text-xs font-mono text-muted-foreground/60">
                          {step.model} · {step.tokens?.toLocaleString()} رمز · {Math.round((step.duration_ms ?? 0) / 1000)}ث
                        </div>
                      )}
                      {step.status === "pending" && (
                        <div className="text-xs font-mono text-muted-foreground/40">في الانتظار…</div>
                      )}
                    </div>

                    {/* Context flow badge */}
                    {idx > 0 && step.status !== "pending" && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-mono shrink-0">
                        ←سياق {idx} وكيل
                      </Badge>
                    )}

                    {/* Expand/collapse */}
                    {step.result && (
                      <div className="text-muted-foreground/40 shrink-0">
                        {step.expanded ? <ExpandIcon size={14} /> : <CollapseIcon size={14} />}
                      </div>
                    )}
                  </button>

                  {/* Result content */}
                  {step.expanded && step.result && (
                    <div className="px-4 pb-4 border-t border-border/20 pt-3 space-y-2">
                      <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-7 max-h-72 overflow-y-auto" dir="rtl">
                        {step.result}
                      </div>
                      <div className="flex justify-start gap-2 pt-1">
                        <button
                          onClick={() => navigator.clipboard?.writeText(step.result!)}
                          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-colors">
                          <Brain size={10} /> نسخ النتيجة
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Final Integrated Output ───────────────────────────── */}
      {finalOutput && (
        <div className="rounded border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-5 space-y-3" dir="rtl">
          <div className="flex items-center gap-2 justify-end">
            <div className="text-xs font-mono text-primary uppercase tracking-widest">المنتج النهائي التكاملي</div>
            <Trophy size={16} className="text-primary" />
          </div>
          <div className="text-sm text-foreground leading-8 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {finalOutput}
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(finalOutput);
              }}
              className="text-xs font-mono text-muted-foreground hover:text-primary transition-colors px-3 py-1 rounded border border-border/40 hover:border-primary/30">
              نسخ المنتج النهائي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Agent Quick Execute ────────────────────────────────────── */

function AgentExecute({ agents, executions }: { agents: any[]; executions: any[] }) {
  const executeAgent = useExecuteAgent();
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const selectedData = agents.find(a => a.id === selectedAgent);

  async function handleExecute() {
    if (!selectedAgent || !prompt.trim()) return;
    setExecuting(true); setResult(null);
    try {
      const res = await executeAgent.mutateAsync({
        agentId: selectedAgent,
        data: { action: prompt, parameters: {} },
      });
      setResult(res?.result ?? "اكتمل.");
      qc.invalidateQueries();
    } catch (e: any) { setResult(`خطأ: ${e?.message}`); }
    setExecuting(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" dir="rtl">
      <div className="lg:col-span-2 space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">قائمة الوكلاء</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {agents.map(agent => (
            <button key={agent.id} onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
              className={`p-3 rounded border text-right transition-all ${
                selectedAgent === agent.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/50 bg-card hover:border-primary/20"
              }`}>
              <div className="flex items-start justify-between mb-1.5">
                <Badge className={`text-[10px] font-mono ${SYSTEM_COLORS[agent.system] ?? "bg-secondary border-border/50 text-muted-foreground"}`}>
                  {agent.system}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs">{agent.nameAr || agent.name}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[agent.status] ?? "bg-muted-foreground"}`} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{agent.descriptionAr || agent.description}</p>
              <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-muted-foreground">
                <div className="flex items-center gap-1"><BarChart3 size={8} />{agent.executions_today ?? 0}</div>
                <span>{agent.model?.split("-").slice(0, 2).join("-")}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">تنفيذ سريع</div>
        <div className="p-4 rounded border border-border/50 bg-card space-y-3">
          {selectedData ? (
            <>
              <div className="flex items-center gap-2 justify-end">
                <span className="font-bold text-sm">{selectedData.nameAr || selectedData.name}</span>
                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[selectedData.status]}`} />
              </div>
              <Textarea placeholder={`أرسل مهمة إلى ${selectedData.nameAr}…`}
                rows={5} value={prompt} onChange={e => setPrompt(e.target.value)}
                dir="rtl" className="text-right" />
              <Button onClick={handleExecute} disabled={executing || !prompt.trim()}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                {executing ? <><Loader2 size={13} className="animate-spin" />جارٍ…</> : <><Play size={13} />تشغيل</>}
              </Button>
            </>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-8">
              <MonitorPlay size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">اختر وكيلاً</p>
            </div>
          )}
          {result && (
            <div className="p-3 rounded border border-primary/20 bg-primary/5 text-xs font-mono whitespace-pre-wrap max-h-52 overflow-y-auto" dir="rtl">
              <div className="text-primary text-[10px] mb-1 font-bold">النتيجة:</div>
              {result}
            </div>
          )}
        </div>

        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-2">آخر التنفيذات</div>
        <div className="space-y-1.5">
          {executions?.slice(0, 5).map(ex => (
            <div key={ex.id} className="p-2.5 rounded border border-border/40 bg-card text-xs" dir="rtl">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`font-mono text-[10px] ${ex.status === "completed" ? "text-emerald-400" : ex.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                  {ex.status === "completed" ? "✓" : ex.status === "failed" ? "✗" : "⋯"}
                  {" "}{ex.status === "completed" ? "مكتمل" : ex.status === "failed" ? "فشل" : "جارٍ"}
                </span>
                <span className="font-mono text-muted-foreground text-[10px]">{ex.agent_id}</span>
              </div>
              <div className="text-muted-foreground line-clamp-1">{ex.input || ex.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function AcisPage() {
  const { data: allAgents, isLoading } = useListAgents();
  const { data: executions } = useListAgentExecutions({ limit: 10 });

  const [tab, setTab] = useState<"studio" | "agents">("studio");

  const allAgentsList = allAgents ?? [];

  const TABS = [
    { key: "studio", label: "استوديو خط الأنابيب", icon: Sparkles },
    { key: "agents", label: "تنفيذ سريع",           icon: Play },
  ] as const;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <MonitorPlay size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">ACIS السينمائي</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-[10px]">إنتاج أفلام ذكاء اصطناعي</Badge>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5 font-mono">
              {allAgentsList.filter(a => a.system === "ACIS" || a.system === "StoryboardToVision").length} وكيل ·
              خط أنابيب تكاملي متسلسل
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-primary">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          نشط
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
              tab === t.key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border-border/50" />)}
        </div>
      ) : (
        <>
          {tab === "studio" && <PipelineStudio agents={allAgentsList} />}
          {tab === "agents" && <AgentExecute agents={allAgentsList} executions={executions ?? []} />}
        </>
      )}
    </div>
  );
}
