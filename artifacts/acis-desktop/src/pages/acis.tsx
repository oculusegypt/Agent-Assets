import { useState } from "react";
import { useListAgents, useListAgentExecutions, useExecuteAgent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MonitorPlay, Clapperboard, Eye, Music, Layers, Zap,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Film,
  Cpu, Play, BarChart3,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SYSTEM_LABEL_COLORS: Record<string, string> = {
  ACIS: "bg-primary/10 text-primary border-primary/30",
  StoryboardToVision: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  NEXUS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CAEOS: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  BILLIE: "bg-pink-500/10 text-pink-400 border-pink-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  online: "bg-emerald-500",
  busy: "bg-primary animate-pulse",
  offline: "bg-red-500",
  idle: "bg-muted-foreground",
};

const AGENT_ICONS: Record<string, any> = {
  "story-architect": Clapperboard,
  "honesty-auditor": Eye,
  "sound-music": Music,
  "scene-breakdown": Layers,
  "gpu-render-workers": Cpu,
  "model-orchestrator": Zap,
  "timeline-assembly": Film,
  "post-production": Layers,
};

const PIPELINE_PHASES = [
  { label: "Story", icon: Clapperboard, agents: ["story-architect", "scene-breakdown"] },
  { label: "Script", icon: Film, agents: ["honesty-auditor", "cinematic-director"] },
  { label: "Visual", icon: MonitorPlay, agents: ["visual-storyboard", "ai-prompt-director"] },
  { label: "Generate", icon: Cpu, agents: ["model-orchestrator", "gpu-render-workers"] },
  { label: "Audio", icon: Music, agents: ["sound-music"] },
  { label: "Assemble", icon: Layers, agents: ["timeline-assembly", "post-production"] },
];

export default function AcisPage() {
  const { data: allAgents, isLoading } = useListAgents();
  const { data: executions } = useListAgentExecutions({ limit: 20 });
  const executeAgent = useExecuteAgent();
  const qc = useQueryClient();

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);

  const acisAgents = allAgents?.filter(a => a.system === "ACIS" || a.system === "StoryboardToVision") ?? [];
  const acisOnly = allAgents?.filter(a => a.system === "ACIS") ?? [];

  const selectedAgentData = acisAgents.find(a => a.id === selectedAgent);

  async function handleExecute() {
    if (!selectedAgent || !prompt.trim()) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await executeAgent.mutateAsync({ agentId: selectedAgent, input: prompt, language: "auto" });
      setResult(res?.output ?? "Execution completed.");
      qc.invalidateQueries();
    } catch (e: any) {
      setResult(`Error: ${e?.message ?? "Unknown error"}`);
    }
    setExecuting(false);
  }

  const onlineCount = acisOnly.filter(a => a.status === "online").length;
  const busyCount = acisOnly.filter(a => a.status === "busy").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary">
            <MonitorPlay size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">ACIS Cinematic</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">AI FILM PRODUCTION</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {onlineCount} online · {busyCount} busy · {acisOnly.length} total agents
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-primary">PIPELINE ACTIVE</span>
        </div>
      </div>

      {/* Production Pipeline Visualization */}
      <div className="p-4 rounded border border-border/50 bg-card">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Production Pipeline</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {PIPELINE_PHASES.map((phase, i) => (
            <div key={phase.label} className="flex items-center gap-1 shrink-0">
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
              {i < PIPELINE_PHASES.length - 1 && (
                <ChevronRight size={14} className={i < activePhase ? "text-emerald-400" : "text-muted-foreground/30"} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs font-mono text-muted-foreground">
          Active Phase: <span className="text-primary">{PIPELINE_PHASES[activePhase].label}</span>
          {" · "}Agents: {PIPELINE_PHASES[activePhase].agents.join(", ")}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Agent Roster</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isLoading
              ? Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 bg-card border border-border/50" />)
              : acisAgents.map(agent => {
                  const Icon = AGENT_ICONS[agent.id] ?? Play;
                  return (
                    <button key={agent.id} onClick={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                      className={`p-4 rounded border text-left transition-all hover:border-primary/30 group ${
                        selectedAgent === agent.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/50 bg-card"
                      }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-muted-foreground"}`} />
                          <span className="font-semibold text-sm">{agent.name}</span>
                        </div>
                        <Badge className={`text-[10px] font-mono ${SYSTEM_LABEL_COLORS[agent.system] ?? "bg-secondary border-border/50 text-muted-foreground"}`}>
                          {agent.system}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{agent.description}</p>
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span>{agent.model?.split("-").slice(0, 2).join("-")}</span>
                        <div className="flex items-center gap-1">
                          <BarChart3 size={10} />
                          <span>{agent.executions_today}</span>
                        </div>
                      </div>
                      {(agent.capabilities as string[])?.slice(0, 2).map((cap: string) => (
                        <span key={cap} className="inline-block text-[10px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground font-mono mr-1 mt-1">{cap}</span>
                      ))}
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Agent Interaction Panel */}
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Agent Interaction</div>
          <div className="p-4 rounded border border-border/50 bg-card space-y-3">
            {selectedAgentData ? (
              <>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[selectedAgentData.status]}`} />
                  <span className="font-bold text-sm">{selectedAgentData.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{selectedAgentData.description}</p>
                {selectedAgentData.name_ar && (
                  <div className="text-xs font-mono text-primary/70 font-bold" dir="rtl">{selectedAgentData.name_ar}</div>
                )}
                <Textarea
                  placeholder={`Send task to ${selectedAgentData.name}…\n\nExample: Write a 3-act story about a scientist in Cairo who discovers time travel.`}
                  rows={5}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <Button onClick={handleExecute} disabled={executing || !prompt.trim()}
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {executing ? (
                    <><Clock size={14} className="animate-spin" /> Processing…</>
                  ) : (
                    <><Play size={14} /> Execute Agent</>
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MonitorPlay size={32} className="mx-auto mb-3 opacity-30" />
                <p>Select an agent from the roster to interact with it</p>
              </div>
            )}

            {result && (
              <div className="p-3 rounded border border-primary/20 bg-primary/5 text-xs font-mono text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">
                <div className="text-primary text-xs mb-1">OUTPUT:</div>
                {result}
              </div>
            )}
          </div>

          {/* Recent Executions */}
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Recent Executions</div>
          <div className="space-y-2">
            {executions?.slice(0, 5).map(ex => (
              <div key={ex.id} className="p-3 rounded border border-border/50 bg-card text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-muted-foreground">{ex.agent_id}</span>
                  <span className={`font-mono ${ex.status === "completed" ? "text-emerald-400" : ex.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                    {ex.status === "completed" ? <CheckCircle2 size={10} className="inline mr-1" /> : ex.status === "failed" ? <AlertCircle size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                    {ex.status}
                  </span>
                </div>
                <div className="text-muted-foreground line-clamp-1">{ex.input}</div>
                {ex.duration_ms && <div className="text-muted-foreground/60 mt-1">{ex.duration_ms}ms</div>}
              </div>
            ))}
            {!executions?.length && <div className="text-center text-muted-foreground text-xs py-4">No executions yet</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
