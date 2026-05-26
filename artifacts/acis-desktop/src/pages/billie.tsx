import { useState } from "react";
import {
  useGetBillieStatus, useGetBillieNews, useGetBillieAlerts,
  useListComplaints, useListAgents, useGetSystemMetrics,
  useRunBillieAnalysis, useSubmitComplaint,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  BrainCircuit, Newspaper, AlertTriangle, ShieldCheck,
  Activity, RefreshCw, MessageSquarePlus, CheckCircle2,
  TrendingUp, Zap, Eye, ChevronRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  warning: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-sky-400 bg-sky-400/10 border-sky-400/30",
  info: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

export default function BilliePage() {
  const { data: status, isLoading: sLoad } = useGetBillieStatus();
  const { data: news, isLoading: nLoad } = useGetBillieNews();
  const { data: alerts, isLoading: aLoad } = useGetBillieAlerts();
  const { data: complaints, isLoading: cLoad } = useListComplaints();
  const { data: agents } = useListAgents();
  const { data: metrics } = useGetSystemMetrics();

  const runAnalysis = useRunBillieAnalysis();
  const submitComplaint = useSubmitComplaint();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"overview" | "news" | "alerts" | "complaints" | "agents">("overview");
  const [complaintForm, setComplaintForm] = useState({ title: "", description: "", agent_id: "", severity: "medium" });
  const [complaintSent, setComplaintSent] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const healthScore = status?.system_health_score ?? 0;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await runAnalysis.mutateAsync({ target: "all", depth: "full" });
      setAnalysisResult(result?.analysis ?? "تم اكتمال التحليل بنجاح.");
      qc.invalidateQueries();
    } catch { setAnalysisResult("فشل التحليل — تحقق من الاتصال بالخادم."); }
    setAnalyzing(false);
  }

  async function handleComplaint(e: React.FormEvent) {
    e.preventDefault();
    await submitComplaint.mutateAsync(complaintForm as any);
    setComplaintSent(true);
    setComplaintForm({ title: "", description: "", agent_id: "", severity: "medium" });
    qc.invalidateQueries();
    setTimeout(() => setComplaintSent(false), 4000);
  }

  const TABS = [
    { key: "overview", label: "Overview", icon: Eye },
    { key: "news", label: "AI News", icon: Newspaper },
    { key: "alerts", label: "Alerts", icon: AlertTriangle },
    { key: "complaints", label: "Complaints", icon: MessageSquarePlus },
    { key: "agents", label: "Agent Control", icon: Zap },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
            <BrainCircuit size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Billie</h1>
              <span className="font-bold text-xl opacity-60 font-serif" dir="rtl">بيليه</span>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">SUPREME SUPERVISOR</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">AI system overseer · agent orchestrator · evolution engine</p>
          </div>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20">
          {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
          {analyzing ? "Analyzing…" : "Run Full Analysis"}
        </Button>
      </div>

      {analysisResult && (
        <div className="p-4 rounded border border-primary/30 bg-primary/5 font-mono text-sm whitespace-pre-wrap text-foreground/90">
          <div className="text-primary text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><ShieldCheck size={12} /> BILLIE ANALYSIS REPORT</div>
          {analysisResult}
        </div>
      )}

      <div className="flex gap-1 border-b border-border/50 pb-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${tab === t.key ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Health Score" value={sLoad ? null : `${healthScore}%`} sub="system overall" className={healthColor} />
            <MetricCard label="Active Agents" value={sLoad ? null : status?.agents_monitored} sub="connected" className="text-emerald-400" />
            <MetricCard label="Today's Jobs" value={metrics?.total_executions_today ?? null} sub="executions" className="text-sky-400" />
            <MetricCard label="Success Rate" value={metrics ? `${metrics.success_rate}%` : null} sub="pipeline" className="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={12} /> System Vitals
              </div>
              {sLoad ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-5 w-full bg-secondary" />)
              ) : (
                <div className="space-y-2 font-mono text-sm">
                  {[
                    { k: "Agents Online", v: `${metrics?.agents_online ?? 0}/${metrics?.total_agents ?? 0}`, bar: metrics?.total_agents ? Math.round((metrics.agents_online ?? 0) / metrics.total_agents * 100) : 0 },
                    { k: "Success Rate", v: `${metrics?.success_rate ?? 100}%`, bar: metrics?.success_rate ?? 100 },
                    { k: "Avg Response", v: `${metrics?.avg_response_ms ?? 0}ms`, bar: Math.max(0, 100 - Math.min((metrics?.avg_response_ms ?? 0) / 30, 100)) },
                    { k: "Active Projects", v: `${metrics?.active_projects ?? 0} running`, bar: Math.min((metrics?.active_projects ?? 0) * 20, 100) },
                  ].map(row => (
                    <div key={row.k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{row.k}</span>
                        <span className={row.bar > 80 ? "text-red-400" : row.bar > 60 ? "text-amber-400" : "text-emerald-400"}>{row.v}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${row.bar > 80 ? "bg-red-400" : row.bar > 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                          style={{ width: `${row.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={12} /> Recent Alerts
              </div>
              {aLoad ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 bg-secondary" />)
              ) : alerts?.slice(0, 4).map(a => (
                <div key={a.id} className={`p-2 rounded border text-xs ${SEV_COLOR[a.severity] ?? SEV_COLOR.info}`}>
                  <div className="font-bold">{a.title}</div>
                  <div className="opacity-75 mt-0.5">{a.message}</div>
                </div>
              ))}
              {!aLoad && !alerts?.length && <div className="text-center text-muted-foreground text-sm py-4">✅ No active alerts</div>}
            </div>
          </div>
        </div>
      )}

      {tab === "news" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Live AI Intelligence Feed — 2026</div>
          {nLoad ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border border-border/50" />)
          ) : news?.map(item => (
            <div key={item.id} className="p-4 rounded border border-border/50 bg-card hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs font-mono px-1.5 py-0 ${
                      item.category === "breakthrough" ? "bg-primary/10 text-primary border-primary/30" :
                      item.category === "warning" ? "bg-amber-400/10 text-amber-400 border-amber-400/30" :
                      item.category === "research" ? "bg-purple-400/10 text-purple-400 border-purple-400/30" :
                      "bg-secondary text-muted-foreground border-border/50"
                    }`}>{item.category}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{item.source}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.date}</span>
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.title}</h3>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.summary}</p>
                </div>
                <div className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={14} />
                </div>
              </div>
              {item.impact && (
                <div className="mt-2 text-xs font-mono bg-secondary/50 rounded px-2 py-1 text-muted-foreground">
                  <span className="text-primary">BILLIE:</span> {item.impact}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-4">
          {aLoad ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)
          ) : !alerts?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
              <p>All systems nominal — no active alerts</p>
            </div>
          ) : alerts?.map(a => (
            <div key={a.id} className={`p-4 rounded border ${SEV_COLOR[a.severity] ?? SEV_COLOR.info}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs uppercase font-mono ${SEV_COLOR[a.severity]}`}>{a.severity}</Badge>
                    <span className="text-xs font-mono opacity-70">{a.agent_id}</span>
                  </div>
                  <h3 className="font-bold">{a.title}</h3>
                  <p className="text-sm opacity-80 mt-1">{a.message}</p>
                </div>
                {!a.resolved && (
                  <Badge className="bg-amber-400/10 text-amber-400 border-amber-400/30 font-mono text-xs">ACTIVE</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "complaints" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Submit Complaint to Billie</div>
            <form onSubmit={handleComplaint} className="space-y-3 p-4 bg-card border border-border/50 rounded">
              <Input placeholder="Complaint title" required value={complaintForm.title}
                onChange={e => setComplaintForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="Describe the issue in detail…" required rows={4} value={complaintForm.description}
                onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))} />
              <select value={complaintForm.agent_id} onChange={e => setComplaintForm(f => ({ ...f, agent_id: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground">
                <option value="">Select agent (optional)</option>
                {agents?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={complaintForm.severity} onChange={e => setComplaintForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground">
                {["low", "medium", "high", "critical"].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <Button type="submit" className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageSquarePlus size={14} /> Submit to Billie
              </Button>
              {complaintSent && (
                <div className="text-center text-emerald-400 text-sm font-mono flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} /> Complaint received — Billie will respond shortly
                </div>
              )}
            </form>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Complaint Log</div>
            {cLoad ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />)
            ) : complaints?.map(c => (
              <div key={c.id} className={`p-4 rounded border bg-card ${SEV_COLOR[c.severity] ?? SEV_COLOR.medium}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={`text-xs font-mono ${SEV_COLOR[c.severity]}`}>{c.severity}</Badge>
                  <Badge className={`text-xs font-mono ${c.status === "resolved" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" : "bg-amber-400/10 text-amber-400 border-amber-400/30"}`}>{c.status}</Badge>
                  {c.agent_id && <span className="text-xs font-mono opacity-60">{c.agent_id}</span>}
                </div>
                <h4 className="font-semibold text-sm">{c.title}</h4>
                <p className="text-xs opacity-70 mt-1">{c.description}</p>
                {c.billie_response && (
                  <div className="mt-2 text-xs bg-primary/5 border border-primary/20 rounded p-2 font-mono">
                    <span className="text-primary">بيليه: </span>{c.billie_response}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "agents" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Agent Control Panel — Managed by Billie</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents?.map(agent => (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-primary animate-pulse" : "bg-red-500"}`} />
                    <span className="font-semibold text-sm">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono text-xs bg-secondary border-border/50">{agent.system}</Badge>
                    <Badge className={`font-mono text-xs ${agent.status === "online" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : agent.status === "busy" ? "bg-primary/10 text-primary border-primary/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      {agent.status?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{agent.description}</p>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{agent.model}</span>
                  <span className="text-muted-foreground">{agent.executions_today} exec/day</span>
                </div>
                {agent.capabilities?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(agent.capabilities as string[]).slice(0, 3).map((cap: string) => (
                      <span key={cap} className="text-[10px] bg-secondary rounded px-1.5 py-0.5 text-muted-foreground font-mono">{cap}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, className = "" }: { label: string; value: any; sub: string; className?: string }) {
  return (
    <div className="p-4 border border-border/50 bg-card rounded">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3">{label}</div>
      {value == null ? (
        <Skeleton className="h-8 w-1/2 bg-secondary" />
      ) : (
        <div className={`text-3xl font-mono font-bold ${className}`}>{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
