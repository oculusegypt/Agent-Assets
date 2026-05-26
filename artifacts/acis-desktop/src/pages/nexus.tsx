import { useState } from "react";
import { useListNexusTasks, useGetNexusSummary, useListAgents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Building2, FileText, BarChart3, Presentation, Mail,
  CalendarDays, BookOpen, Search, Workflow, Users,
  CheckCircle2, Clock, AlertCircle, TrendingUp, Brain,
} from "lucide-react";

const TASK_TYPE_ICONS: Record<string, any> = {
  document: FileText,
  spreadsheet: BarChart3,
  presentation: Presentation,
  email: Mail,
  meeting: CalendarDays,
  calendar: CalendarDays,
  knowledge: BookOpen,
  research: Search,
  workflow: Workflow,
  crm: Users,
};

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  running: "text-primary bg-primary/10 border-primary/30",
  pending: "text-muted-foreground bg-secondary border-border/50",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10 border-red-400/30",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low: "text-sky-400 bg-sky-400/10 border-sky-400/30",
};

const NEXUS_AGENTS = [
  { id: "document-processor", name: "Document Processor", icon: FileText, desc: "Reads, summarizes, and drafts documents with AI precision. Handles PDF, DOCX, and TXT." },
  { id: "spreadsheet-analyst", name: "Spreadsheet Analyst", icon: BarChart3, desc: "Analyzes Excel and CSV data. Detects trends, anomalies, and creates dashboard summaries." },
  { id: "presentation-designer", name: "Presentation Designer", icon: Presentation, desc: "Creates executive-quality slide decks from bullet points or raw content." },
  { id: "email-manager", name: "Email Manager", icon: Mail, desc: "Drafts, categorizes, and responds to emails. Maintains professional tone in Arabic & English." },
  { id: "meeting-manager", name: "Meeting Manager", icon: CalendarDays, desc: "Transcribes meetings, extracts action items, assigns owners, and sends summaries." },
  { id: "calendar-scheduler", name: "Calendar Scheduler", icon: CalendarDays, desc: "Optimizes schedules, resolves conflicts, and books meetings automatically." },
  { id: "knowledge-curator", name: "Knowledge Curator", icon: BookOpen, desc: "Builds and maintains organizational knowledge base from all inputs." },
  { id: "research-analyst", name: "Research Analyst", icon: Search, desc: "Deep-dives any topic, compiles reports with citations and executive summaries." },
  { id: "workflow-automation", name: "Workflow Automation", icon: Workflow, desc: "Designs and executes multi-step business workflows across all tools." },
  { id: "crm-manager", name: "CRM Manager", icon: Users, desc: "Manages leads, enriches contacts, tracks pipeline, and forecasts revenue." },
];

export default function NexusPage() {
  const { data: tasks, isLoading: tLoad } = useListNexusTasks();
  const { data: summary, isLoading: sLoad } = useGetNexusSummary();
  const { data: allAgents } = useListAgents();

  const [tab, setTab] = useState<"tasks" | "agents" | "analytics">("tasks");
  const nexusAgents = allAgents?.filter(a => a.system === "NEXUS") ?? [];

  const completedTasks = tasks?.filter(t => t.status === "completed").length ?? 0;
  const runningTasks = tasks?.filter(t => t.status === "running").length ?? 0;
  const pendingTasks = tasks?.filter(t => t.status === "pending").length ?? 0;

  const TABS = [
    { key: "tasks", label: "Task Board", icon: CheckCircle2 },
    { key: "agents", label: "Office Agents", icon: Users },
    { key: "analytics", label: "Analytics", icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">NEXUS Office OS</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs">ENTERPRISE AI</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              10 specialized office agents · {completedTasks} completed · {runningTasks} running · {pendingTasks} pending
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          NEXUS ONLINE
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sLoad ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border border-border/50" />)
        ) : [
          { label: "Tasks Completed", value: summary?.tasks_completed ?? completedTasks, color: "text-emerald-400" },
          { label: "Documents Processed", value: summary?.documents_processed ?? 0, color: "text-sky-400" },
          { label: "Emails Handled", value: summary?.emails_handled ?? 0, color: "text-primary" },
          { label: "Efficiency Score", value: summary?.efficiency_score ? `${summary.efficiency_score}%` : "—", color: "text-amber-400" },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 rounded border border-border/50 bg-card">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">{kpi.label}</div>
            <div className={`text-2xl font-mono font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border/50">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${tab === t.key ? "border-emerald-400 text-emerald-400 bg-emerald-500/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "tasks" && (
        <div className="space-y-3">
          {tLoad ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28 bg-card border border-border/50" />)
          ) : tasks?.map(task => {
            const Icon = TASK_TYPE_ICONS[task.type] ?? FileText;
            return (
              <div key={task.id} className="p-4 rounded border border-border/50 bg-card hover:border-emerald-500/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{task.title}</span>
                      <Badge className={`text-[10px] font-mono ${STATUS_STYLES[task.status] ?? "bg-secondary"}`}>{task.status}</Badge>
                      <Badge className={`text-[10px] font-mono ${PRIORITY_STYLES[task.priority] ?? "bg-secondary"}`}>{task.priority}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mb-2">
                      Agent: <span className="text-emerald-400">{task.assigned_agent}</span>
                      {task.risk_score !== undefined && (
                        <span className={`ml-3 ${task.risk_score > 7 ? "text-red-400" : task.risk_score > 4 ? "text-amber-400" : "text-emerald-400"}`}>
                          Risk: {task.risk_score}/10
                        </span>
                      )}
                    </div>
                    {task.progress !== undefined && task.status !== "pending" && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${task.status === "completed" ? "bg-emerald-400" : task.status === "running" ? "bg-primary" : "bg-muted-foreground"}`}
                            style={{ width: `${task.progress}%` }} />
                        </div>
                      </div>
                    )}
                    {task.result && (
                      <div className="p-2 rounded bg-secondary/50 text-xs text-muted-foreground font-mono border border-border/30">
                        <span className="text-emerald-400">RESULT: </span>{task.result}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {task.status === "completed" ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : task.status === "running" ? (
                      <Clock size={18} className="text-primary animate-spin" />
                    ) : task.status === "failed" ? (
                      <AlertCircle size={18} className="text-red-400" />
                    ) : (
                      <Clock size={18} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!tLoad && !tasks?.length && (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>No tasks yet</p>
            </div>
          )}
        </div>
      )}

      {tab === "agents" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {NEXUS_AGENTS.map(agent => {
            const Icon = agent.icon;
            const liveAgent = nexusAgents.find(a => a.id.includes(agent.id.split("-")[0]));
            return (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-emerald-500/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{agent.name}</span>
                      {liveAgent && (
                        <div className={`w-2 h-2 rounded-full ${liveAgent.status === "online" ? "bg-emerald-500" : liveAgent.status === "busy" ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{agent.desc}</p>
                    {liveAgent && (
                      <div className="mt-2 text-xs font-mono text-muted-foreground">
                        {liveAgent.model} · {liveAgent.executions_today} exec/day
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Avg Task Completion Time", value: "4.2 min", icon: Clock, color: "text-primary" },
              { label: "AI Confidence Score", value: "94.7%", icon: Brain, color: "text-emerald-400" },
              { label: "Automation Rate", value: "87%", icon: Workflow, color: "text-purple-400" },
            ].map(item => (
              <div key={item.label} className="p-5 rounded border border-border/50 bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <item.icon size={16} className={item.color} />
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{item.label}</span>
                </div>
                <div className={`text-3xl font-mono font-bold ${item.color}`}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="p-4 rounded border border-border/50 bg-card">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Task Distribution by Agent</div>
            <div className="space-y-2">
              {NEXUS_AGENTS.slice(0, 6).map((agent, i) => {
                const pct = [78, 65, 54, 91, 44, 37][i];
                return (
                  <div key={agent.id}>
                    <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                      <span>{agent.name}</span>
                      <span className="text-emerald-400">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
