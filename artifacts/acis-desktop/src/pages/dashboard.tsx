import { useEffect } from "react";
import { useGetSystemMetrics, useListAgents, useGetSystemActivity } from "@workspace/api-client-react";
import { useSystemHealthCheck } from "@workspace/api-client-react";
import { Activity, Server, Users, Zap, CheckCircle2, Brain, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

const SYSTEM_COLORS: Record<string, string> = {
  ACIS:              "text-primary border-primary/30 bg-primary/10",
  StoryboardToVision:"text-purple-400 border-purple-400/30 bg-purple-400/10",
  NEXUS:             "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  CAEOS:             "text-orange-400 border-orange-400/30 bg-orange-400/10",
  BILLIE:            "text-pink-400 border-pink-400/30 bg-pink-400/10",
  SERVX:             "text-sky-400 border-sky-400/30 bg-sky-400/10",
};

const STATUS_COLORS: Record<string, string> = {
  online:  "bg-emerald-500",
  busy:    "bg-primary animate-pulse",
  offline: "bg-red-500",
  idle:    "bg-muted-foreground",
  error:   "bg-red-500",
};

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useGetSystemMetrics();
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useListAgents();
  const { data: activity, isLoading: activityLoading, refetch: refetchActivity } = useGetSystemActivity();
  const healthCheck = useSystemHealthCheck();
  const qc = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      refetchMetrics();
      refetchAgents();
      refetchActivity();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchMetrics, refetchAgents, refetchActivity]);

  const health = metrics?.system_health ?? 0;
  const healthColor = health >= 90 ? "text-emerald-400" : health >= 70 ? "text-amber-400" : "text-red-400";
  const healthBarColor = health >= 90 ? "bg-emerald-500" : health >= 70 ? "bg-amber-500" : "bg-red-500";

  const systemGroups = agents
    ? Object.entries(
        agents.reduce((acc: Record<string, typeof agents>, a) => {
          const sys = a.system || "أخرى";
          acc[sys] = acc[sys] || [];
          acc[sys].push(a);
          return acc;
        }, {})
      )
    : [];

  async function runHealthCheck() {
    await healthCheck.mutateAsync();
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة القيادة الرئيسية</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">مقاييس النظام الحية والحالة التشغيلية</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={runHealthCheck} disabled={healthCheck.isPending}
            className="px-3 py-1.5 rounded border border-border/50 bg-card text-xs font-mono text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-50">
            {healthCheck.isPending ? "جارٍ الفحص…" : "فحص صحة النظام"}
          </button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            النظام سليم
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="إجمالي الوكلاء"     value={metrics?.total_agents}             icon={<Users size={16} />}       loading={metricsLoading} />
        <StatCard title="التنفيذات اليوم"     value={metrics?.total_executions_today}  icon={<Zap size={16} />}         loading={metricsLoading} className="text-primary" />
        <StatCard title="معدل النجاح"          value={metrics ? `${metrics.success_rate}%` : undefined} icon={<CheckCircle2 size={16} />} loading={metricsLoading} className="text-emerald-500" />
        <StatCard title="متوسط الاستجابة"    value={metrics ? `${metrics.avg_response_ms}ms` : undefined} icon={<Server size={16} />} loading={metricsLoading} className="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="الرموز المستخدمة اليوم" value={metrics?.tokens_used_today ? metrics.tokens_used_today.toLocaleString("ar-SA") : "0"} icon={<Brain size={16} />} loading={metricsLoading} className="text-purple-400" />
        <StatCard title="المشاريع النشطة"       value={metrics?.active_projects}         icon={<TrendingUp size={16} />}  loading={metricsLoading} className="text-sky-400" />
        <div className="p-4 border border-border/50 bg-card rounded flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle size={16} className={`opacity-50 ${healthColor}`} />
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-right">صحة النظام</div>
          </div>
          {metricsLoading ? (
            <Skeleton className="h-8 w-1/2 bg-secondary" />
          ) : (
            <>
              <div className={`text-3xl font-mono font-bold ${healthColor}`}>{health}%</div>
              <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${healthBarColor}`} style={{ width: `${health}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {agentsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full bg-card border-border/50" />)}
            </div>
          ) : (
            systemGroups.map(([system, sysAgents]) => (
              <div key={system} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] font-mono border ${SYSTEM_COLORS[system] ?? "text-muted-foreground border-border/50 bg-secondary"}`}>
                    {system}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{sysAgents.length} وكيل</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sysAgents.map(agent => (
                    <div key={agent.id} className="p-3 rounded border border-border/50 bg-card hover:border-primary/20 transition-colors relative overflow-hidden group">
                      <div className="absolute top-2 left-2">
                        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-muted-foreground"}`} />
                      </div>
                      <div className="flex items-start gap-2 pr-1">
                        <div className="text-right flex-1">
                          <h3 className="font-bold text-sm">{agent.nameAr || agent.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.descriptionAr || agent.description}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span className="text-[10px] opacity-60">{agent.model?.split("-").slice(0, 2).join("-")}</span>
                        <span>{agent.executions_today ?? 0} تنفيذ</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground/60 animate-pulse">تحديث كل 30ث</span>
            <h2 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">النشاط الحي</h2>
          </div>
          <div className="bg-card border border-border/50 rounded flex flex-col" style={{ height: "480px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activityLoading ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)
              ) : activity?.map(item => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="text-right flex-1 min-w-0">
                    <div className="font-mono text-xs text-muted-foreground mb-0.5">
                      {new Date(item.created_at).toLocaleTimeString("ar-SA")}
                    </div>
                    <div className="font-medium text-sm truncate">{item.title}</div>
                    <div className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{item.description}</div>
                  </div>
                </div>
              ))}
              {!activityLoading && !activity?.length && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  <Activity size={24} className="mx-auto mb-2 opacity-30" />
                  لا يوجد نشاط حتى الآن
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading, className = "" }: any) {
  return (
    <div className="p-4 border border-border/50 bg-card rounded flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className={`opacity-50 ${className}`}>{icon}</div>
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest text-right">{title}</div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-1/2 bg-secondary" />
      ) : (
        <div className={`text-3xl font-mono font-bold ${className}`}>{value || 0}</div>
      )}
    </div>
  );
}
