import { useEffect, useState } from "react";
import { X, Bot, Zap, CheckCircle2, Clock, AlertCircle, Activity, Brain, Hash, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const SYS_COLORS: Record<string, string> = {
  billie: "text-pink-400 border-pink-400/40 bg-pink-400/10",
  acis:   "text-primary border-primary/40 bg-primary/10",
  nexus:  "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  caeos:  "text-orange-400 border-orange-400/40 bg-orange-400/10",
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-400", busy: "bg-primary animate-pulse",
  offline: "bg-red-400", error: "bg-red-400", idle: "bg-muted-foreground",
};

const STATUS_AR: Record<string, string> = {
  online: "متاح", busy: "مشغول", offline: "غير متاح", error: "خطأ", idle: "خامل",
};

interface Props {
  agentId: string | null;
  onClose: () => void;
}

export function AgentDetailSheet({ agentId, onClose }: Props) {
  const [agent, setAgent] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/api/agents/${agentId}`).then(r => r.json()).catch(() => null),
      fetch(`${BASE}/api/agents/executions?limit=50`).then(r => r.json()).catch(() => []),
    ]).then(([agentData, allExecs]) => {
      setAgent(agentData);
      const filtered = (Array.isArray(allExecs) ? allExecs : [])
        .filter((e: any) => e.agent_id === agentId)
        .slice(0, 10);
      setExecutions(filtered);
      setLoading(false);
    });
  }, [agentId]);

  if (!agentId) return null;

  const sysColor = SYS_COLORS[agent?.system ?? ""] ?? "text-muted-foreground border-border/40 bg-secondary";
  const successCount = executions.filter(e => e.status === "completed").length;
  const totalTokens = executions.reduce((s, e) => s + (e.tokens_used || 0), 0);
  const avgMs = executions.filter(e => e.duration_ms).length > 0
    ? Math.round(executions.filter(e => e.duration_ms).reduce((s,e) => s + e.duration_ms, 0) / executions.filter(e => e.duration_ms).length)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-card border-r border-border shadow-2xl shadow-black/60 flex flex-col h-full overflow-y-auto animate-in slide-in-from-right-4 duration-300"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 sticky top-0 bg-card z-10">
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-base text-right">
                {loading ? <span className="text-muted-foreground">جارٍ التحميل…</span> : (agent?.nameAr || agent?.name || agentId)}
              </h2>
              <p className="text-xs text-muted-foreground text-right font-mono">{agentId}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${sysColor}`}>
              <Bot size={18} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Activity size={20} className="text-primary animate-spin" />
          </div>
        ) : agent ? (
          <div className="p-5 space-y-5">
            {/* Status + System */}
            <div className="flex items-center gap-2 justify-end flex-wrap">
              <Badge className={`text-[11px] font-mono border ${sysColor}`}>{agent.system?.toUpperCase()}</Badge>
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">{STATUS_AR[agent.status] || agent.status}</span>
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[agent.status] ?? "bg-muted-foreground"}`} />
              </div>
            </div>

            {/* Description */}
            {agent.descriptionAr && (
              <div className="text-sm text-muted-foreground text-right leading-relaxed border-r-2 border-primary/30 pr-3">
                {agent.descriptionAr}
              </div>
            )}

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "تنفيذات اليوم", value: agent.executions_today ?? 0, icon: Zap, color: "text-primary" },
                { label: "معدل النجاح", value: executions.length > 0 ? `${Math.round(successCount/executions.length*100)}%` : "—", icon: CheckCircle2, color: "text-emerald-400" },
                { label: "متوسط الوقت", value: avgMs > 0 ? `${(avgMs/1000).toFixed(1)}s` : "—", icon: Clock, color: "text-amber-400" },
              ].map(s => (
                <div key={s.label} className="p-2.5 bg-secondary/30 rounded border border-border/30 text-right">
                  <s.icon size={13} className={`${s.color} mb-1 mr-auto`} />
                  <div className={`text-base font-mono font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tokens */}
            <div className="flex items-center justify-between p-3 bg-purple-500/5 border border-purple-500/20 rounded">
              <span className="text-purple-400 font-mono font-bold">{totalTokens.toLocaleString()}</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>إجمالي الرموز المستخدمة</span>
                <Hash size={13} className="text-purple-400" />
              </div>
            </div>

            {/* Model */}
            {agent.model && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground/60 border border-border/30 rounded px-2 py-0.5">{agent.model}</span>
                <span className="text-muted-foreground">النموذج المستخدم</span>
              </div>
            )}

            {/* Capabilities */}
            {agent.capabilities?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">القدرات</span>
                  <Brain size={13} className="text-muted-foreground" />
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {agent.capabilities.map((cap: string) => (
                    <span key={cap} className="text-[10px] font-mono bg-secondary border border-border/40 text-muted-foreground px-2 py-0.5 rounded">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Executions */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">آخر {executions.length} تنفيذات</span>
                <BarChart3 size={13} className="text-muted-foreground" />
              </div>
              {executions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/20 rounded border border-border/30">
                  لا توجد تنفيذات مسجّلة
                </p>
              ) : (
                <div className="space-y-1.5">
                  {executions.map((exec) => (
                    <div key={exec.id} className="p-2.5 bg-secondary/20 rounded border border-border/30 text-right">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          {exec.status === "completed" ? (
                            <CheckCircle2 size={11} className="text-emerald-400" />
                          ) : exec.status === "failed" ? (
                            <AlertCircle size={11} className="text-red-400" />
                          ) : (
                            <Clock size={11} className="text-amber-400 animate-spin" />
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {exec.duration_ms ? `${(exec.duration_ms/1000).toFixed(1)}s` : "—"}
                          </span>
                          {exec.tokens_used > 0 && (
                            <span className="text-[10px] font-mono text-purple-400">{exec.tokens_used} رمز</span>
                          )}
                        </div>
                        <span className="text-xs font-medium truncate max-w-[160px]">{exec.action}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground/50">
                          {exec.created_at ? new Date(exec.created_at).toLocaleString("ar-SA") : "—"}
                        </span>
                        {exec.model_used && (
                          <span className="text-[9px] font-mono border border-border/30 rounded px-1 text-muted-foreground/50">
                            {exec.model_used.split("-").slice(0, 2).join("-")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle size={20} />
            <span className="text-sm">تعذّر تحميل بيانات الوكيل</span>
          </div>
        )}
      </div>
    </div>
  );
}
