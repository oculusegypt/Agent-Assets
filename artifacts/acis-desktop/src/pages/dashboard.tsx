import { useGetSystemMetrics, useListAgents, useGetSystemActivity } from "@workspace/api-client-react";
import { Activity, Server, Users, Zap, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useGetSystemMetrics();
  const { data: agents, isLoading: agentsLoading } = useListAgents();
  const { data: activity, isLoading: activityLoading } = useGetSystemActivity();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Main Dashboard</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Live system metrics and operational status</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-mono">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM NOMINAL
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Agents" value={metrics?.total_agents} icon={<Users size={16} />} loading={metricsLoading} />
        <StatCard title="Active Executions" value={metrics?.total_executions_today} icon={<Zap size={16} />} loading={metricsLoading} className="text-primary" />
        <StatCard title="Success Rate" value={metrics ? `${metrics.success_rate}%` : undefined} icon={<CheckCircle2 size={16} />} loading={metricsLoading} className="text-emerald-500" />
        <StatCard title="Avg Response" value={metrics ? `${metrics.avg_response_ms}ms` : undefined} icon={<Server size={16} />} loading={metricsLoading} className="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <h2 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">Active Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {agentsLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full bg-card border-border/50" />)
            ) : agents?.slice(0, 6).map(agent => (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-primary/30 transition-colors relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2">
                  <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'busy' ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl pt-1 opacity-80 group-hover:opacity-100 transition-opacity" style={{ color: agent.color }}>
                    {/* Placeholder for icon */}
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>{agent.model}</span>
                  <span>{agent.executions_today} execs</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">Live Activity</h2>
          <div className="bg-card border border-border/50 rounded flex flex-col h-[400px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activityLoading ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-secondary" />)
              ) : activity?.map(item => (
                <div key={item.id} className="flex gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">{new Date(item.created_at).toLocaleTimeString()}</div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{item.description}</div>
                  </div>
                </div>
              ))}
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
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{title}</div>
        <div className={`opacity-50 ${className}`}>{icon}</div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-1/2 bg-secondary" />
      ) : (
        <div className={`text-3xl font-mono font-bold ${className}`}>{value || 0}</div>
      )}
    </div>
  );
}
