import { useState } from "react";
import { useListAgents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Layers, GitBranch, Lock, Database, Network,
  Cpu, Code2, AlertTriangle, CheckCircle2, Eye,
  Scale, Wrench, Globe, Zap, Brain, Server,
} from "lucide-react";

const SOVEREIGN_LAYERS = [
  { id: 1, name: "Constitutional Framework", icon: Scale, color: "text-amber-400", desc: "Core ethical principles, rights, obligations, and governance charter governing all AI behavior." },
  { id: 2, name: "Lexical Intelligence", icon: Brain, color: "text-purple-400", desc: "Advanced NLP, semantic understanding, multilingual processing (Arabic + English + 30+ langs)." },
  { id: 3, name: "Epistemological Validator", icon: Eye, color: "text-sky-400", desc: "Fact-checking, source verification, knowledge validation against trusted corpora." },
  { id: 4, name: "Ethical Reasoning Engine", icon: Shield, color: "text-emerald-400", desc: "Multi-framework ethical analysis: utilitarian, deontological, virtue, Islamic ethics integration." },
  { id: 5, name: "Systemic Risk Assessor", icon: AlertTriangle, color: "text-orange-400", desc: "Real-time risk scoring, threat modeling, and cascading failure analysis across all operations." },
  { id: 6, name: "Causal Inference Module", icon: GitBranch, color: "text-primary", desc: "Root cause analysis, counterfactual reasoning, and predictive causal chain modeling." },
  { id: 7, name: "Security Enforcement Layer", icon: Lock, color: "text-red-400", desc: "Zero-trust security, prompt injection prevention, data sanitization, and access control." },
  { id: 8, name: "Knowledge Architecture", icon: Database, color: "text-sky-400", desc: "Distributed knowledge graph, semantic indexing, cross-domain concept linking." },
  { id: 9, name: "Coordination Protocol", icon: Network, color: "text-emerald-400", desc: "Multi-agent orchestration, consensus building, and conflict resolution between agents." },
  { id: 10, name: "Adaptive Learning Core", icon: Cpu, color: "text-primary", desc: "Continuous improvement from feedback, performance optimization, model fine-tuning triggers." },
  { id: 11, name: "Transparency Engine", icon: Eye, color: "text-purple-400", desc: "Explainability generation, audit trails, decision rationale, GDPR-compliant logging." },
  { id: 12, name: "Compliance Monitor", icon: CheckCircle2, color: "text-amber-400", desc: "Regulatory compliance checking across GDPR, CCPA, AI Act, UAE AI ethics guidelines." },
  { id: 13, name: "Resource Optimizer", icon: Wrench, color: "text-orange-400", desc: "Compute allocation, cost optimization, energy efficiency, and SLA management." },
  { id: 14, name: "Cultural Intelligence", icon: Globe, color: "text-emerald-400", desc: "Cross-cultural communication, Arabic/Islamic context awareness, regional norm adaptation." },
  { id: 15, name: "Evolution Controller", icon: Zap, color: "text-red-400", desc: "System self-improvement, architecture evolution proposals, version control for AI behaviors." },
];

const PHASE_PIPELINE = [
  "Input Ingestion", "Constitutional Check", "Lexical Parse", "Epistemic Validation",
  "Ethical Analysis", "Risk Assessment", "Causal Modeling", "Security Gate",
  "Knowledge Query", "Agent Coordination", "Response Generation", "Transparency Log",
  "Compliance Verify", "Resource Settle", "Cultural Adapt", "Output Delivery",
  "Feedback Capture", "Learning Update", "Audit Archive", "Evolution Signal",
  "Stakeholder Report", "Cycle Complete",
];

export default function CaeosPage() {
  const { data: allAgents } = useListAgents();
  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState(7);

  const caeos = allAgents?.filter(a => a.system === "CAEOS") ?? [];
  const layerData = activeLayer != null ? SOVEREIGN_LAYERS[activeLayer - 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400">
            <Shield size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">CAEOS / SERVX</h1>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-mono text-xs">CONSTITUTIONAL AI OS</Badge>
              <Badge className="bg-red-500/10 text-red-400 border-red-500/30 font-mono text-xs">v2.0</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              15 Sovereign Layers · 22-Phase Pipeline · Constitutional AI Engineering
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          CAEOS ACTIVE
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sovereign Layers */}
        <div className="xl:col-span-2 space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">15 Sovereign Layers</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SOVEREIGN_LAYERS.map(layer => {
              const Icon = layer.icon;
              const isActive = activeLayer === layer.id;
              return (
                <button key={layer.id} onClick={() => setActiveLayer(isActive ? null : layer.id)}
                  className={`p-3 rounded border text-left transition-all group ${
                    isActive
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-border/50 bg-card hover:border-orange-500/20 hover:bg-orange-500/5"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded flex items-center justify-center bg-secondary shrink-0`}>
                      <Icon size={12} className={layer.color} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">L{String(layer.id).padStart(2, "0")}</span>
                  </div>
                  <div className="text-xs font-bold">{layer.name}</div>
                </button>
              );
            })}
          </div>

          {/* Layer Detail */}
          {layerData && (
            <div className={`p-4 rounded border bg-card`} style={{ borderColor: "rgba(249,115,22,0.3)" }}>
              <div className="flex items-center gap-3 mb-2">
                <layerData.icon size={20} className={layerData.color} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{layerData.name}</span>
                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px] font-mono">
                      Layer {layerData.id}
                    </Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{layerData.desc}</p>
            </div>
          )}
        </div>

        {/* 22-Phase Pipeline */}
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">22-Phase Processing Pipeline</div>
          <div className="p-4 bg-card border border-border/50 rounded space-y-1 h-[540px] overflow-y-auto">
            {PHASE_PIPELINE.map((phase, i) => (
              <button key={phase} onClick={() => setActivePhase(i)}
                className={`w-full flex items-center gap-2 p-2 rounded text-xs text-left transition-colors ${
                  i === activePhase
                    ? "bg-orange-500/10 border border-orange-500/30 text-orange-300"
                    : i < activePhase
                    ? "bg-emerald-500/5 text-emerald-400/70"
                    : "text-muted-foreground hover:bg-secondary"
                }`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${
                  i === activePhase ? "bg-orange-500/20 text-orange-400" :
                  i < activePhase ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {i < activePhase ? "✓" : String(i + 1).padStart(2, "0")}
                </div>
                <span className="font-mono">{phase}</span>
                {i === activePhase && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CAEOS Agents */}
      {caeos.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Live CAEOS Agents</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {caeos.map(agent => (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-orange-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-orange-400 animate-pulse" : "bg-muted-foreground"}`} />
                  <span className="font-semibold text-sm">{agent.name}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
                <div className="mt-2 text-xs font-mono text-muted-foreground flex items-center justify-between">
                  <span>{agent.model}</span>
                  <span>{agent.executions_today} exec/day</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constitutional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ethical Compliance", value: "99.8%", icon: Shield, color: "text-emerald-400" },
          { label: "Avg Risk Score", value: "1.4/10", icon: AlertTriangle, color: "text-amber-400" },
          { label: "Pipeline Throughput", value: "2.1k/hr", icon: Zap, color: "text-primary" },
          { label: "Layer Health", value: "15/15", icon: Layers, color: "text-orange-400" },
        ].map(m => (
          <div key={m.label} className="p-4 rounded border border-border/50 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <m.icon size={14} className={m.color} />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{m.label}</span>
            </div>
            <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
