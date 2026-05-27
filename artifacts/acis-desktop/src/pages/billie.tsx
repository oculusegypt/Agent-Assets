import { useState } from "react";
import {
  useGetBillieStatus, useGetBillieNews, useGetBillieAlerts,
  useListComplaints, useListAgents, useGetSystemMetrics,
  useRunBillieAnalysis, useSubmitComplaint,
} from "@workspace/api-client-react";
import {
  useResolveAlert, useResolveComplaint, useAnalyzeBillieNews, useCreateSystemAlert,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  BrainCircuit, Newspaper, AlertTriangle, ShieldCheck,
  Activity, RefreshCw, MessageSquarePlus, CheckCircle2,
  TrendingUp, Zap, Eye, ExternalLink, Bell, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/30",
  error:    "text-red-400 bg-red-400/10 border-red-400/30",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/30",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/30",
  warning:  "text-amber-400 bg-amber-400/10 border-amber-400/30",
  low:      "text-sky-400 bg-sky-400/10 border-sky-400/30",
  info:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

const SEV_AR: Record<string, string> = {
  critical: "حرج", error: "خطأ", high: "مرتفع",
  medium: "متوسط", warning: "تحذير", low: "منخفض", info: "معلومة",
};

const NEWS_CAT_AR: Record<string, string> = {
  breakthrough: "اختراق", warning: "تحذير", research: "بحث",
  "language-models": "نماذج اللغة", video: "فيديو",
  image: "صور", audio: "صوت", ai: "ذكاء اصطناعي",
};

export default function BilliePage() {
  const { data: status, isLoading: sLoad } = useGetBillieStatus();
  const { data: news,   isLoading: nLoad } = useGetBillieNews();
  const { data: alerts, isLoading: aLoad, refetch: refetchAlerts } = useGetBillieAlerts();
  const { data: complaints, isLoading: cLoad, refetch: refetchComplaints } = useListComplaints();
  const { data: agents } = useListAgents();
  const { data: metrics } = useGetSystemMetrics();

  const runAnalysis    = useRunBillieAnalysis();
  const submitComplaint= useSubmitComplaint();
  const resolveAlert   = useResolveAlert();
  const resolveComplaint = useResolveComplaint();
  const analyzeNews    = useAnalyzeBillieNews();
  const createAlert    = useCreateSystemAlert();
  const qc = useQueryClient();

  const [tab, setTab]  = useState<"overview" | "news" | "alerts" | "complaints" | "agents">("overview");
  const [complaintForm, setComplaintForm] = useState({ title: "", description: "", agent_id: "", severity: "medium" });
  const [complaintSent, setComplaintSent] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [newsAnalysis, setNewsAnalysis] = useState<string | null>(null);
  const [analyzingNews, setAnalyzingNews] = useState(false);
  const [newAlertForm, setNewAlertForm] = useState({ severity: "warning", title: "", message: "" });
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const healthScore = status?.system_health_score ?? 0;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  async function handleAnalyze() {
    setAnalyzing(true); setAnalysisResult(null);
    try {
      const result = await runAnalysis.mutateAsync({ data: { scope: "full" } });
      setAnalysisResult(result?.full_analysis || result?.findings?.map((f: any) => f.message).join("\n") || "تم اكتمال التحليل.");
      qc.invalidateQueries();
    } catch { setAnalysisResult("فشل التحليل — تحقق من اتصال الخادم."); }
    setAnalyzing(false);
  }

  async function handleComplaint(e: React.FormEvent) {
    e.preventDefault();
    await submitComplaint.mutateAsync({ data: complaintForm as any });
    setComplaintSent(true);
    setComplaintForm({ title: "", description: "", agent_id: "", severity: "medium" });
    qc.invalidateQueries();
    setTimeout(() => setComplaintSent(false), 4000);
  }

  async function handleResolveAlert(alertId: string) {
    setResolvingId(alertId);
    try {
      await resolveAlert.mutateAsync({ alertId });
      await refetchAlerts();
      qc.invalidateQueries();
    } catch {}
    setResolvingId(null);
  }

  async function handleResolveComplaint(id: string) {
    setResolvingId(id);
    try {
      await resolveComplaint.mutateAsync({ id });
      await refetchComplaints();
      qc.invalidateQueries();
    } catch {}
    setResolvingId(null);
  }

  async function handleAnalyzeNews() {
    setAnalyzingNews(true); setNewsAnalysis(null);
    try {
      const r = await analyzeNews.mutateAsync({ topic: "" });
      setNewsAnalysis(r?.analysis || "");
    } catch { setNewsAnalysis("فشل التحليل."); }
    setAnalyzingNews(false);
  }

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    await createAlert.mutateAsync(newAlertForm);
    setNewAlertForm({ severity: "warning", title: "", message: "" });
    setShowAlertForm(false);
    qc.invalidateQueries();
    await refetchAlerts();
  }

  const TABS = [
    { key: "overview",    label: "نظرة عامة",         icon: Eye },
    { key: "news",        label: "أخبار الذكاء الاصطناعي", icon: Newspaper },
    { key: "alerts",      label: `التنبيهات${alerts?.filter(a => !a.resolved).length ? ` (${alerts.filter(a => !a.resolved).length})` : ""}`, icon: AlertTriangle },
    { key: "complaints",  label: "الشكاوى",            icon: MessageSquarePlus },
    { key: "agents",      label: "تحكم الوكلاء",       icon: Zap },
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
            <BrainCircuit size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">بيليه</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">المشرف الأعلى</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">مراقب النظام الذكي · منسق الوكلاء · محرك التطور</p>
          </div>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing}
          className="gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20">
          {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
          {analyzing ? "جارٍ التحليل…" : "تشغيل التحليل الكامل"}
        </Button>
      </div>

      {analysisResult && (
        <div className="p-4 rounded border border-primary/30 bg-primary/5 font-mono text-sm whitespace-pre-wrap text-foreground/90 max-h-64 overflow-y-auto" dir="rtl">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAnalysisResult(null)} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
            <div className="text-primary text-xs uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={12} /> تقرير تحليل بيليه
            </div>
          </div>
          {analysisResult}
        </div>
      )}

      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 whitespace-nowrap ${tab === t.key ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="درجة الصحة"    value={sLoad ? null : `${healthScore}%`}       sub="الإجمالي"     className={healthColor} />
            <MetricCard label="الوكلاء النشطون" value={sLoad ? null : status?.agents_monitored} sub="متصل"        className="text-emerald-400" />
            <MetricCard label="مهام اليوم"      value={metrics?.total_executions_today ?? null} sub="تنفيذ"       className="text-sky-400" />
            <MetricCard label="معدل النجاح"     value={metrics ? `${metrics.success_rate}%` : null} sub="خط الأنابيب" className="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={12} /> مؤشرات النظام
              </div>
              {sLoad ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-5 w-full bg-secondary" />) : (
                <div className="space-y-2 font-mono text-sm">
                  {[
                    { k: "الوكلاء المتصلون", v: `${metrics?.agents_online ?? 0}/${metrics?.total_agents ?? 0}`, bar: metrics?.total_agents ? Math.round((metrics.agents_online ?? 0) / metrics.total_agents * 100) : 0 },
                    { k: "معدل النجاح",       v: `${metrics?.success_rate ?? 100}%`,   bar: metrics?.success_rate ?? 100 },
                    { k: "متوسط الاستجابة",  v: `${metrics?.avg_response_ms ?? 0}ms`,  bar: Math.max(0, 100 - Math.min((metrics?.avg_response_ms ?? 0) / 30, 100)) },
                    { k: "المشاريع النشطة",  v: `${metrics?.active_projects ?? 0} جارٍ`, bar: Math.min((metrics?.active_projects ?? 0) * 20, 100) },
                  ].map(row => (
                    <div key={row.k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={row.bar > 80 ? "text-emerald-400" : row.bar > 60 ? "text-amber-400" : "text-muted-foreground"}>{row.v}</span>
                        <span className="text-muted-foreground">{row.k}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${row.bar > 80 ? "bg-emerald-400" : row.bar > 60 ? "bg-amber-400" : "bg-primary"}`}
                          style={{ width: `${row.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setTab("alerts" as any)}
                  className="text-xs text-primary font-mono hover:underline">عرض الكل ←</button>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} /> آخر التنبيهات
                </div>
              </div>
              {aLoad ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 bg-secondary" />) : (
                <>
                  {alerts?.slice(0, 3).filter(a => !a.resolved).map(a => (
                    <div key={a.id} className={`p-2 rounded border text-xs ${SEV_COLOR[a.severity] ?? SEV_COLOR.info} flex items-start justify-between gap-2`}>
                      <button onClick={() => handleResolveAlert(a.id)}
                        disabled={resolvingId === a.id}
                        className="text-emerald-400 hover:text-emerald-300 shrink-0 mt-0.5 opacity-60 hover:opacity-100">
                        <CheckCircle2 size={12} />
                      </button>
                      <div className="flex-1 text-right">
                        <div className="font-bold">{a.title}</div>
                        <div className="opacity-75 mt-0.5">{a.message?.substring(0, 80)}</div>
                      </div>
                    </div>
                  ))}
                  {!alerts?.filter(a => !a.resolved).length && (
                    <div className="text-center text-muted-foreground text-sm py-4">✅ لا توجد تنبيهات نشطة</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "news" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button onClick={handleAnalyzeNews} disabled={analyzingNews}
              className="gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs h-8">
              {analyzingNews ? <RefreshCw size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
              {analyzingNews ? "بيليه يحلل…" : "تحليل ذكي للأخبار"}
            </Button>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">أحدث أخبار الذكاء الاصطناعي — 2026</div>
          </div>
          {newsAnalysis && (
            <div className="p-3 rounded border border-primary/20 bg-primary/5 text-xs font-mono whitespace-pre-wrap text-foreground/90 max-h-40 overflow-y-auto" dir="rtl">
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => setNewsAnalysis(null)} className="text-muted-foreground"><X size={10} /></button>
                <span className="text-primary font-bold">تحليل بيليه للأخبار:</span>
              </div>
              {newsAnalysis}
            </div>
          )}
          {nLoad ? (
            Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border border-border/50" />)
          ) : news?.map((item: any) => (
            <div key={item.id} className="p-4 rounded border border-border/50 bg-card hover:border-primary/30 transition-colors group">
              <div className="flex items-start justify-between gap-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-1">
                  <ExternalLink size={14} />
                </a>
                <div className="flex-1 text-right">
                  <div className="flex items-center gap-2 mb-1 justify-end">
                    <span className="text-xs text-muted-foreground font-mono">{new Date(item.published_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.source}</span>
                    <Badge className={`text-xs font-mono px-1.5 py-0 ${
                      item.category === "language-models" ? "bg-primary/10 text-primary border-primary/30" :
                      item.category === "video" ? "bg-purple-400/10 text-purple-400 border-purple-400/30" :
                      item.category === "audio" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" :
                      item.category === "image" ? "bg-sky-400/10 text-sky-400 border-sky-400/30" :
                      "bg-secondary text-muted-foreground border-border/50"
                    }`}>{NEWS_CAT_AR[item.category] || item.category}</Badge>
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{item.titleAr || item.title}</h3>
                  <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.summary}</p>
                </div>
              </div>
              {item.impact && (
                <div className="mt-2 text-xs font-mono bg-secondary/50 rounded px-2 py-1 text-muted-foreground text-right">
                  <span className="text-primary">بيليه: </span>{item.impact}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button onClick={() => setShowAlertForm(!showAlertForm)}
              className="gap-2 text-xs h-8 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20">
              <Bell size={12} /> {showAlertForm ? "إلغاء" : "تنبيه يدوي"}
            </Button>
            <div className="text-xs font-mono text-muted-foreground">
              {alerts?.filter(a => !a.resolved).length ?? 0} نشط · {alerts?.filter(a => a.resolved).length ?? 0} محلول
            </div>
          </div>

          {showAlertForm && (
            <form onSubmit={handleCreateAlert} className="p-4 bg-card border border-amber-500/20 rounded space-y-3">
              <div className="text-xs font-mono text-amber-400 text-right mb-1">إنشاء تنبيه يدوي</div>
              <select value={newAlertForm.severity} onChange={e => setNewAlertForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                {[["critical","حرج"],["error","خطأ"],["warning","تحذير"],["info","معلومة"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input required placeholder="عنوان التنبيه" value={newAlertForm.title}
                onChange={e => setNewAlertForm(f => ({ ...f, title: e.target.value }))} dir="rtl" className="text-right" />
              <Textarea required rows={2} placeholder="رسالة التنبيه" value={newAlertForm.message}
                onChange={e => setNewAlertForm(f => ({ ...f, message: e.target.value }))} dir="rtl" className="text-right" />
              <Button type="submit" disabled={createAlert.isPending}
                className="w-full gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs">
                <Bell size={12} /> {createAlert.isPending ? "جارٍ الإنشاء…" : "إنشاء التنبيه"}
              </Button>
            </form>
          )}

          {aLoad ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />) :
            !alerts?.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
                <p>جميع الأنظمة طبيعية — لا توجد تنبيهات نشطة</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={`p-4 rounded border ${a.resolved ? "opacity-50 border-border/30 bg-secondary/20" : (SEV_COLOR[a.severity] ?? SEV_COLOR.info)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {!a.resolved && (
                      <Button onClick={() => handleResolveAlert(a.id)}
                        disabled={resolvingId === a.id}
                        className="text-xs h-7 gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                        {resolvingId === a.id ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        حل
                      </Button>
                    )}
                    {a.resolved && <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/30 text-[10px] font-mono">محلول</Badge>}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1 justify-end">
                      {a.agent_id && <span className="text-xs font-mono opacity-70">{a.agent_id}</span>}
                      <Badge className={`text-xs uppercase font-mono ${SEV_COLOR[a.severity]}`}>{SEV_AR[a.severity] || a.severity}</Badge>
                    </div>
                    <h3 className="font-bold">{a.title}</h3>
                    <p className="text-sm opacity-80 mt-1">{a.message}</p>
                    <div className="text-xs font-mono opacity-40 mt-1">
                      {new Date(a.created_at).toLocaleString("ar-SA")}
                    </div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === "complaints" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">إرسال شكوى إلى بيليه</div>
            <form onSubmit={handleComplaint} className="space-y-3 p-4 bg-card border border-border/50 rounded">
              <Input placeholder="عنوان الشكوى" required value={complaintForm.title} dir="rtl" className="text-right"
                onChange={e => setComplaintForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="اشرح المشكلة بالتفصيل…" required rows={4} value={complaintForm.description} dir="rtl" className="text-right"
                onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))} />
              <select value={complaintForm.agent_id} onChange={e => setComplaintForm(f => ({ ...f, agent_id: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                <option value="">اختر وكيلاً (اختياري)</option>
                {agents?.map(a => <option key={a.id} value={a.id}>{a.nameAr || a.name}</option>)}
              </select>
              <select value={complaintForm.severity} onChange={e => setComplaintForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-foreground text-right" dir="rtl">
                {[{ v: "low", l: "منخفض" }, { v: "medium", l: "متوسط" }, { v: "high", l: "مرتفع" }, { v: "critical", l: "حرج" }].map(s => (
                  <option key={s.v} value={s.v}>{s.l}</option>
                ))}
              </select>
              <Button type="submit" disabled={submitComplaint.isPending} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageSquarePlus size={14} /> {submitComplaint.isPending ? "جارٍ الإرسال…" : "إرسال إلى بيليه"}
              </Button>
              {complaintSent && (
                <div className="text-center text-emerald-400 text-sm font-mono flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} /> تم استلام الشكوى — ستتلقى ردّاً من بيليه قريباً
                </div>
              )}
            </form>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                {complaints?.filter(c => c.status === "open" || c.status === "investigating").length ?? 0} مفتوحة
              </span>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">سجل الشكاوى</div>
            </div>
            {cLoad ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />) :
              !complaints?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 size={32} className="mx-auto mb-2 opacity-20" />
                  <p>لا توجد شكاوى مسجّلة</p>
                </div>
              ) : complaints.map(c => (
                <div key={c.id} className={`p-4 rounded border bg-card ${c.status === "resolved" ? "opacity-60 border-border/20" : (SEV_COLOR[c.severity] ?? SEV_COLOR.medium)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {c.status !== "resolved" && (
                        <Button onClick={() => handleResolveComplaint(c.id)}
                          disabled={resolvingId === c.id}
                          className="text-xs h-7 gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                          {resolvingId === c.id ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                          أغلق
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {c.agent_id && <span className="text-xs font-mono opacity-60">{c.agent_id}</span>}
                      <Badge className={`text-xs font-mono ${c.status === "resolved" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/30" : "bg-amber-400/10 text-amber-400 border-amber-400/30"}`}>
                        {c.status === "resolved" ? "محلول" : c.status === "investigating" ? "قيد التحقيق" : "مفتوح"}
                      </Badge>
                      <Badge className={`text-xs font-mono ${SEV_COLOR[c.severity]}`}>{SEV_AR[c.severity] || c.severity}</Badge>
                    </div>
                  </div>
                  <h4 className="font-semibold text-sm text-right">{c.title}</h4>
                  <p className="text-xs opacity-70 mt-1 text-right line-clamp-2">{c.description}</p>
                  {c.billie_response && (
                    <div className="mt-2 text-xs bg-primary/5 border border-primary/20 rounded p-2 font-mono text-right">
                      <span className="text-primary">بيليه: </span>{c.billie_response}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab === "agents" && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">لوحة تحكم الوكلاء — يديرها بيليه</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents?.map(agent => (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="font-mono text-xs bg-secondary border-border/50">{agent.system}</Badge>
                    <Badge className={`font-mono text-xs ${agent.status === "online" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : agent.status === "busy" ? "bg-primary/10 text-primary border-primary/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      {agent.status === "online" ? "متصل" : agent.status === "busy" ? "مشغول" : "غير متصل"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{agent.nameAr || agent.name}</span>
                    <div className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-primary animate-pulse" : "bg-red-500"}`} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2 text-right">{agent.descriptionAr || agent.description}</p>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{agent.executions_today ?? 0} تنفيذ اليوم</span>
                  <span className="text-muted-foreground">{agent.model}</span>
                </div>
                {(agent.capabilities as string[])?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-end">
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
    <div className="p-4 border border-border/50 bg-card rounded" dir="rtl">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3 text-right">{label}</div>
      {value == null ? (
        <Skeleton className="h-8 w-1/2 bg-secondary" />
      ) : (
        <div className={`text-3xl font-mono font-bold ${className}`}>{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1 text-right">{sub}</div>
    </div>
  );
}
