import { useState } from "react";
import {
  useListNexusTasks, useGetNexusSummary, useListAgents, useCreateNexusTask,
} from "@workspace/api-client-react";
import {
  useGetNexusTemplates, useGetNexusTask, useDeleteNexusTask,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Building2, FileText, BarChart3, Presentation, Mail,
  CalendarDays, BookOpen, Search, Workflow, Users,
  CheckCircle2, Clock, AlertCircle, TrendingUp, Brain,
  Plus, X, Trash2, Layers,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const TASK_TYPE_ICONS: Record<string, any> = {
  document: FileText, spreadsheet: BarChart3, presentation: Presentation,
  email: Mail, meeting: CalendarDays, calendar: CalendarDays,
  knowledge: BookOpen, research: Search, workflow: Workflow, crm: Users,
};

const TASK_TYPE_AR: Record<string, string> = {
  document: "مستند", spreadsheet: "جدول بيانات", presentation: "عرض تقديمي",
  email: "بريد إلكتروني", meeting: "اجتماع", calendar: "تقويم",
  knowledge: "معرفة", research: "بحث", workflow: "سير عمل", crm: "علاقات عملاء",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  running:   "text-primary bg-primary/10 border-primary/30",
  pending:   "text-muted-foreground bg-secondary border-border/50",
  failed:    "text-red-400 bg-red-400/10 border-red-400/30",
};

const STATUS_AR: Record<string, string> = {
  completed: "مكتمل", running: "جارٍ", pending: "منتظر", failed: "فشل",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10 border-red-400/30",
  high:   "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low:    "text-sky-400 bg-sky-400/10 border-sky-400/30",
};

const PRIORITY_AR: Record<string, string> = {
  urgent: "عاجل", high: "مرتفع", medium: "متوسط", low: "منخفض",
};

function TaskResultModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, isLoading } = useGetNexusTask(taskId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-card border border-emerald-500/30 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X size={16} /></button>
          <div className="text-right">
            <h3 className="font-bold">{task?.title || "نتيجة المهمة"}</h3>
            {task && (
              <p className="text-xs text-muted-foreground font-mono">
                {task.assigned_agent} ·
                <span className={task.status === "completed" ? " text-emerald-400" : task.status === "failed" ? " text-red-400" : " text-amber-400 animate-pulse"}>
                  {" "}{STATUS_AR[task.status] || task.status}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <div className="text-center py-8"><Clock size={24} className="mx-auto mb-2 animate-spin text-muted-foreground" /></div>}
          {task?.status === "running" && !task?.result && (
            <div className="text-center py-8 text-amber-400">
              <Brain size={24} className="mx-auto mb-2 animate-pulse" />
              <p className="text-sm font-mono">الوكيل يعمل… يرجى الانتظار</p>
            </div>
          )}
          {task?.result && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90" dir="rtl">
              {task.result}
            </div>
          )}
          {task?.status === "failed" && !task?.result && (
            <p className="text-red-400 text-sm">فشل التنفيذ — تحقق من الاتصال.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NexusPage() {
  const { data: tasks, isLoading: tLoad } = useListNexusTasks();
  const { data: summary } = useGetNexusSummary();
  const { data: templates } = useGetNexusTemplates();
  const createTask  = useCreateNexusTask();
  const deleteTask  = useDeleteNexusTask();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"tasks" | "new" | "templates" | "analytics">("tasks");
  const [form, setForm] = useState({ title: "", description: "", type: "document", priority: "medium" });
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);

  const completedTasks = tasks?.filter(t => t.status === "completed").length ?? 0;
  const runningTasks   = tasks?.filter(t => t.status === "running").length ?? 0;
  const pendingTasks   = tasks?.filter(t => t.status === "pending").length ?? 0;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await createTask.mutateAsync({ data: form as any });
    qc.invalidateQueries();
    setTab("tasks");
    setViewTaskId((res as any)?.id ?? null);
    setForm({ title: "", description: "", type: "document", priority: "medium" });
  }

  async function handleDelete(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteTask.mutateAsync({ taskId });
    qc.invalidateQueries();
  }

  function applyTemplate(tpl: any) {
    setForm({ title: tpl.name, description: tpl.description, type: tpl.type, priority: tpl.priority });
    setTab("new");
  }

  const TABS = [
    { key: "tasks",     label: "لوحة المهام",   icon: CheckCircle2 },
    { key: "templates", label: "القوالب",        icon: Layers },
    { key: "new",       label: "مهمة جديدة",    icon: Plus },
    { key: "analytics", label: "التحليلات",     icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Building2 size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">نيكسوس المكتبي</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs">ذكاء مؤسسي</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              10 وكلاء مكتبيين · {completedTasks} مكتمل · {runningTasks} جارٍ · {pendingTasks} منتظر
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          NEXUS نشط
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي المهام", value: summary?.total ?? 0, color: "text-foreground" },
          { label: "مكتملة", value: completedTasks, color: "text-emerald-400" },
          { label: "جارية", value: runningTasks, color: "text-primary" },
          { label: "معدل الإنجاز", value: `${summary?.completion_rate ?? 0}%`, color: "text-amber-400" },
        ].map(m => (
          <div key={m.label} className="p-3 rounded border border-border/50 bg-card text-right">
            <div className="text-xs text-muted-foreground font-mono mb-1">{m.label}</div>
            <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.value}</div>
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
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border-border/50" />)
          ) : !tasks?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد مهام — ابدأ مهمة جديدة أو استخدم قالباً</p>
              <div className="flex items-center gap-2 justify-center mt-4">
                <Button onClick={() => setTab("templates")} variant="outline" className="gap-2 text-xs border-emerald-500/30 text-emerald-400">
                  <Layers size={12} /> استخدم قالباً
                </Button>
                <Button onClick={() => setTab("new")} className="gap-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Plus size={12} /> مهمة جديدة
                </Button>
              </div>
            </div>
          ) : tasks.map(task => {
            const Icon = TASK_TYPE_ICONS[task.type] ?? Brain;
            return (
              <div key={task.id} className="p-4 rounded border border-border/50 bg-card hover:border-emerald-500/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 mt-0.5">
                    <button onClick={() => handleDelete(task.id, event as any)}
                      className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-muted-foreground/50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <button className="flex-1 text-right" onClick={() => setViewTaskId(task.id)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] font-mono border ${STATUS_STYLES[task.status]}`}>
                          {task.status === "running" && <Clock size={8} className="inline mr-0.5 animate-spin" />}
                          {STATUS_AR[task.status] || task.status}
                        </Badge>
                        <Badge className={`text-[10px] font-mono border ${PRIORITY_STYLES[task.priority]}`}>
                          {PRIORITY_AR[task.priority] || task.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{task.title}</span>
                        <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Icon size={13} className="text-emerald-400" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 text-right mb-2">{task.description}</p>
                    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span>{new Date(task.created_at).toLocaleString("ar-SA")}</span>
                      <span>{task.assigned_agent} · {TASK_TYPE_AR[task.type] || task.type}</span>
                    </div>
                    {task.status === "completed" && (
                      <div className="mt-2 text-xs text-emerald-400 font-mono">اضغط لعرض النتيجة ←</div>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground text-right">اختر قالباً لبدء مهمة مُعدّة مسبقاً بشكل سريع</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {templates?.map((tpl: any) => {
              const Icon = TASK_TYPE_ICONS[tpl.type] ?? Brain;
              return (
                <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                  className="p-4 rounded border border-border/50 bg-card hover:border-emerald-500/30 hover:bg-emerald-500/5 text-right transition-all group">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    <span className="font-bold text-sm">{tpl.name}</span>
                    <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Icon size={15} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{tpl.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${PRIORITY_STYLES[tpl.priority]}`}>
                      {PRIORITY_AR[tpl.priority]}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono group-hover:underline">استخدم القالب ←</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "new" && (
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleCreateTask} className="p-6 bg-card border border-border/50 rounded space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">عنوان المهمة</label>
              <Input required placeholder="عنوان مهمة واضح ومحدد" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} dir="rtl" className="text-right" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">تفاصيل المهمة</label>
              <Textarea required rows={5}
                placeholder="اشرح المهمة بتفاصيل واضحة…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                dir="rtl" className="text-right" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">النوع</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                  {Object.entries(TASK_TYPE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-widest block text-right">الأولوية</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                  <option value="urgent">عاجل</option>
                  <option value="high">مرتفع</option>
                  <option value="medium">متوسط</option>
                  <option value="low">منخفض</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={createTask.isPending}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {createTask.isPending ? <Clock size={14} className="animate-spin" /> : <Plus size={14} />}
              {createTask.isPending ? "جارٍ الإنشاء…" : "إنشاء المهمة"}
            </Button>
          </form>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-card border border-border/50 rounded">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 text-right">توزيع الأنواع</div>
              {summary?.by_type && Object.entries(summary.by_type)
                .filter(([, count]) => (count as number) > 0)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .map(([type, count]) => {
                  const pct = summary.total > 0 ? Math.round(((count as number) / summary.total) * 100) : 0;
                  return (
                    <div key={type} className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-muted-foreground w-8 text-left shrink-0">{pct}%</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground text-right shrink-0">{TASK_TYPE_AR[type] || type}</span>
                    </div>
                  );
                })
              }
              {(!summary?.by_type || Object.values(summary.by_type).every(v => v === 0)) && (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد مهام بعد</p>
              )}
            </div>
            <div className="p-4 bg-card border border-border/50 rounded">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 text-right">ملخص الأداء</div>
              {[
                { label: "إجمالي المهام", value: summary?.total ?? 0 },
                { label: "مكتملة", value: summary?.completed ?? 0, color: "text-emerald-400" },
                { label: "فاشلة", value: summary?.failed ?? 0, color: "text-red-400" },
                { label: "معدل الإنجاز", value: `${summary?.completion_rate ?? 0}%`, color: "text-amber-400" },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <span className={`font-mono font-bold ${m.color || ""}`}>{m.value}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewTaskId && (
        <TaskResultModal taskId={viewTaskId} onClose={() => setViewTaskId(null)} />
      )}
    </div>
  );
}
