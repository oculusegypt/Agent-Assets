import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useListNexusTasks, useGetNexusSummary, useCreateNexusTask,
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
  Plus, X, Trash2, Layers, Kanban, GripVertical,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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

const KANBAN_COLS: { key: string; label: string; icon: any; color: string; border: string; bg: string }[] = [
  { key: "pending",   label: "منتظر",   icon: Clock,         color: "text-muted-foreground", border: "border-border/50",       bg: "bg-secondary/20" },
  { key: "running",   label: "جارٍ",    icon: Brain,         color: "text-primary",           border: "border-primary/30",      bg: "bg-primary/5" },
  { key: "completed", label: "مكتمل",   icon: CheckCircle2,  color: "text-emerald-400",       border: "border-emerald-400/30",  bg: "bg-emerald-400/5" },
  { key: "failed",    label: "فشل",     icon: AlertCircle,   color: "text-red-400",           border: "border-red-400/30",      bg: "bg-red-400/5" },
];

function TaskResultModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, isLoading } = useGetNexusTask({ taskId });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-emerald-500/30 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X size={15} /></button>
          <h3 className="font-bold text-right">{isLoading ? "…" : task?.title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? <Skeleton className="h-32 bg-secondary" /> : (
            task?.result ? (
              <div className="prose prose-sm prose-invert max-w-none text-right" dir="rtl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.result}</ReactMarkdown>
              </div>
            ) : <p className="text-muted-foreground text-center py-8">لا توجد نتيجة بعد</p>
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

  const [tab, setTab] = useState<"kanban" | "new" | "templates" | "analytics">("kanban");
  const [form, setForm] = useState({ title: "", description: "", type: "document", priority: "medium" });
  const [viewTaskId, setViewTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragSrcStatus = useRef<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string, status: string) => {
    setDraggedTaskId(taskId);
    dragSrcStatus.current = status;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId || dragSrcStatus.current === newStatus) return;
    try {
      const res = await fetch(`${BASE}/api/nexus/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      qc.invalidateQueries();
      toast.success(`نُقلت المهمة إلى "${newStatus === "completed" ? "مكتمل" : newStatus === "running" ? "جارٍ" : newStatus === "failed" ? "فشل" : "منتظر"}"`);
    } catch {
      toast.error("فشل تحريك المهمة");
    }
    dragSrcStatus.current = null;
  }, [draggedTaskId, qc]);

  const completedTasks = tasks?.filter(t => t.status === "completed").length ?? 0;
  const runningTasks   = tasks?.filter(t => t.status === "running").length ?? 0;
  const pendingTasks   = tasks?.filter(t => t.status === "pending").length ?? 0;

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const tid = toast.loading("جارٍ إنشاء المهمة وتعيين الوكيل…");
    try {
      const res = await createTask.mutateAsync({ data: form as any });
      qc.invalidateQueries();
      setTab("kanban");
      setViewTaskId((res as any)?.id ?? null);
      setForm({ title: "", description: "", type: "document", priority: "medium" });
      toast.success("تم إنشاء المهمة بنجاح ✓", { id: tid });
    } catch (err: any) {
      toast.error(`فشل إنشاء المهمة: ${err?.message || "خطأ غير معروف"}`, { id: tid });
    }
  }

  async function handleDelete(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteTask.mutateAsync({ taskId });
      qc.invalidateQueries();
      toast.success("حُذفت المهمة");
    } catch {
      toast.error("فشل حذف المهمة");
    }
  }

  function applyTemplate(tpl: any) {
    setForm({ title: tpl.name, description: tpl.description, type: tpl.type, priority: tpl.priority });
    setTab("new");
  }

  const TABS = [
    { key: "kanban",    label: "لوحة كانبان",   icon: Kanban },
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

      {/* ─── KANBAN BOARD ───────────────────────────────────────────────── */}
      {tab === "kanban" && (
        <div>
          {tLoad ? (
            <div className="grid grid-cols-4 gap-4">
              {KANBAN_COLS.map(col => (
                <div key={col.key} className="space-y-3">
                  <Skeleton className="h-8 bg-card" />
                  {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28 bg-card" />)}
                </div>
              ))}
            </div>
          ) : !tasks?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Kanban size={36} className="mx-auto mb-3 opacity-30" />
              <p>لوحة الكانبان فارغة — ابدأ مهمة جديدة أو استخدم قالباً</p>
              <div className="flex items-center gap-2 justify-center mt-4">
                <Button onClick={() => setTab("templates")} variant="outline" className="gap-2 text-xs border-emerald-500/30 text-emerald-400">
                  <Layers size={12} /> استخدم قالباً
                </Button>
                <Button onClick={() => setTab("new")} className="gap-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Plus size={12} /> مهمة جديدة
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {KANBAN_COLS.map(col => {
                const colTasks = tasks.filter(t => t.status === col.key);
                const ColIcon = col.icon;
                const isDropTarget = dragOverCol === col.key && dragSrcStatus.current !== col.key;
                return (
                  <div key={col.key}
                    className={`rounded-xl border flex flex-col min-h-[200px] transition-all ${col.bg} ${
                      isDropTarget
                        ? "border-emerald-400/60 ring-1 ring-emerald-400/30 scale-[1.01]"
                        : col.border
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
                    onDrop={e => handleDrop(e, col.key)}
                  >
                    {/* Column Header */}
                    <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isDropTarget ? "border-emerald-400/40" : col.border}`}>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[col.key]} shrink-0`}>
                        {colTasks.length}
                      </span>
                      <div className={`flex items-center gap-1.5 font-semibold text-sm ${col.color}`}>
                        <span>{col.label}</span>
                        <ColIcon size={14} className={col.key === "running" ? "animate-pulse" : ""} />
                      </div>
                    </div>
                    {/* Drop hint */}
                    {isDropTarget && (
                      <div className="mx-2 mt-2 p-2 rounded border-2 border-dashed border-emerald-400/40 text-center text-[10px] text-emerald-400/60 font-mono">
                        أفلت هنا
                      </div>
                    )}
                    {/* Cards */}
                    <div className="p-2 space-y-2 flex-1">
                      {colTasks.length === 0 && !isDropTarget ? (
                        <div className="text-center py-6 text-muted-foreground/30 text-xs">
                          لا توجد مهام
                        </div>
                      ) : colTasks.map(task => {
                        const Icon = TASK_TYPE_ICONS[task.type] ?? Brain;
                        const isDragging = draggedTaskId === task.id;
                        return (
                          <div key={task.id}
                            draggable
                            onDragStart={e => handleDragStart(e, task.id, task.status)}
                            onDragEnd={() => { setDraggedTaskId(null); setDragOverCol(null); dragSrcStatus.current = null; }}
                            className={`p-3 rounded-lg bg-card border border-border/40 hover:border-emerald-500/20 transition-all group shadow-sm ${
                              isDragging ? "opacity-40 scale-95 cursor-grabbing" : "cursor-grab hover:cursor-grab"
                            }`}
                            onClick={() => setViewTaskId(task.id)}>
                            {/* Drag handle + Title row */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1">
                                <GripVertical size={10} className="text-muted-foreground/20 group-hover:text-muted-foreground/50 shrink-0 mt-0.5" />
                                <button
                                  onClick={e => handleDelete(task.id, e)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-muted-foreground/30 transition-all shrink-0">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 flex-1 justify-end">
                                <span className="font-semibold text-xs leading-tight text-right line-clamp-2">{task.title}</span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${STATUS_STYLES[col.key]}`}>
                                  <Icon size={11} />
                                </div>
                              </div>
                            </div>
                            {/* Description */}
                            <p className="text-[10px] text-muted-foreground line-clamp-2 text-right mb-2">{task.description}</p>
                            {/* Footer */}
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-mono text-muted-foreground/40">
                                {new Date(task.created_at).toLocaleDateString("ar-SA")}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className={`text-[9px] font-mono border rounded px-1 py-0.5 ${PRIORITY_STYLES[task.priority]}`}>
                                  {PRIORITY_AR[task.priority]}
                                </span>
                                <span className="text-[9px] font-mono text-muted-foreground/50">
                                  {TASK_TYPE_AR[task.type]}
                                </span>
                              </div>
                            </div>
                            {task.status === "completed" && (
                              <div className="mt-1.5 text-[9px] text-emerald-400 font-mono text-right">اضغط لعرض النتيجة ←</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
