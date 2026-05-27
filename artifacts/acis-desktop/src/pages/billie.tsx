import { useState, useRef, useEffect, useCallback } from "react";
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
  Send, Bot, User, Wrench, BookOpen, ChevronDown, ChevronUp,
  BarChart3, FileText, Cpu, Search, Lightbulb, Shield,
  Radio, Star, Clock, Hash,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

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
  "language-models": "نماذج اللغة", video: "فيديو",
  image: "صور", audio: "صوت", ai: "ذكاء اصطناعي",
};

type ChatMsg = { role: "user" | "billie"; text: string; model?: string; ts: string; loading?: boolean };

const QUICK_ACTIONS = [
  { icon: BarChart3,      label: "تحليل النظام الكامل",         prompt: "قومي بتحليل شامل للنظام الآن وأعطيني تقريراً مفصلاً بالحالة والتوصيات.", color: "text-primary border-primary/30 bg-primary/5 hover:bg-primary/15" },
  { icon: Shield,         label: "فحص صحة الوكلاء",            prompt: "افحصي حالة جميع الوكلاء وأخبريني من منهم يحتاج تدخلاً.", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/15" },
  { icon: AlertTriangle,  label: "مراجعة التنبيهات النشطة",    prompt: "ما هي التنبيهات النشطة الأهم حالياً وكيف تنصحين بمعالجتها؟", color: "text-amber-400 border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/15" },
  { icon: Newspaper,      label: "تحليل أخبار الذكاء الاصطناعي", prompt: "حلّلي أحدث تطورات الذكاء الاصطناعي وأثرها على مشاريع ACIS.", color: "text-purple-400 border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/15" },
  { icon: FileText,       label: "تقرير أداء أسبوعي",           prompt: "أعديّ تقريراً أسبوعياً مختصراً عن أداء النظام والإنجازات والتحديات.", color: "text-sky-400 border-sky-400/30 bg-sky-400/5 hover:bg-sky-400/15" },
  { icon: Lightbulb,      label: "توصيات التحسين",              prompt: "بناءً على الوضع الحالي، ما هي توصياتك الثلاث الأهم لتحسين النظام؟", color: "text-orange-400 border-orange-400/30 bg-orange-400/5 hover:bg-orange-400/15" },
  { icon: Search,         label: "تشخيص مشكلة محددة",          prompt: "أريد تشخيص سبب انخفاض معدل نجاح الوكلاء — ما الذي تعتقدين أنه يحدث؟", color: "text-rose-400 border-rose-400/30 bg-rose-400/5 hover:bg-rose-400/15" },
  { icon: TrendingUp,     label: "خطة تطوير المشاريع",          prompt: "ما أولويات تطوير مشاريع ACIS للمرحلة القادمة وكيف نسرّع الإنتاج؟", color: "text-teal-400 border-teal-400/30 bg-teal-400/5 hover:bg-teal-400/15" },
];

const BILLIE_TOOLS = [
  { icon: BarChart3, name: "محلل النظام",         desc: "تحليل شامل لأداء الوكلاء وصحة النظام", tier: "pro" },
  { icon: Shield,    name: "مراقب التنبيهات",     desc: "رصد وتصنيف جميع تنبيهات النظام وحلها", tier: "pro" },
  { icon: Radio,     name: "متابع أخبار الذكاء",  desc: "تحليل أحدث تطورات الذكاء الاصطناعي وتأثيرها", tier: "flash" },
  { icon: Wrench,    name: "محدّث الوكلاء",        desc: "تعديل حالة ونماذج الوكلاء مباشرةً", tier: "pro" },
  { icon: FileText,  name: "مولّد التقارير",       desc: "كتابة تقارير تنفيذية مفصلة ومختصرة", tier: "pro" },
  { icon: MessageSquarePlus, name: "معالج الشكاوى", desc: "استقبال الشكاوى والرد عليها بذكاء", tier: "flash" },
];

const BILLIE_SKILLS = [
  "التحليل الاستراتيجي متعدد الأبعاد",
  "إدارة الوكلاء وتنسيق العمل",
  "الكشف المبكر عن المخاطر",
  "معالجة اللغة العربية الفصحى",
  "توليد التقارير التنفيذية",
  "تصنيف الأولويات والتوصيات",
  "مراقبة مؤشرات الأداء",
  "التواصل الاحترافي مع القيادة",
];

export default function BilliePage() {
  const { data: status, isLoading: sLoad } = useGetBillieStatus();
  const { data: news,   isLoading: nLoad } = useGetBillieNews();
  const { data: alerts, isLoading: aLoad, refetch: refetchAlerts } = useGetBillieAlerts();
  const { data: complaints, isLoading: cLoad, refetch: refetchComplaints } = useListComplaints();
  const { data: agents } = useListAgents();
  const { data: metrics } = useGetSystemMetrics();

  const runAnalysis      = useRunBillieAnalysis();
  const submitComplaint  = useSubmitComplaint();
  const resolveAlert     = useResolveAlert();
  const resolveComplaint = useResolveComplaint();
  const analyzeNews      = useAnalyzeBillieNews();
  const createAlert      = useCreateSystemAlert();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"chat" | "overview" | "news" | "alerts" | "complaints">("chat");
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    { role: "billie", text: "مرحباً سيدي القائد 👋 — أنا بيليه، المشرفة العليا على منظومة ACIS. كيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن أي شيء أو استخدام الأزرار السريعة في الأسفل.", ts: new Date().toISOString() }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [complaintForm, setComplaintForm] = useState({ title: "", description: "", agent_id: "", severity: "medium" });
  const [complaintSent, setComplaintSent] = useState(false);
  const [newsAnalysis, setNewsAnalysis] = useState<string | null>(null);
  const [analyzingNews, setAnalyzingNews] = useState(false);
  const [newAlertForm, setNewAlertForm] = useState({ severity: "warning", title: "", message: "" });
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showCapabilities, setShowCapabilities] = useState(true);

  const healthScore = status?.system_health_score ?? 0;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", text: text.trim(), ts: new Date().toISOString() };
    const streamingMsg: ChatMsg = { role: "billie", text: "", ts: new Date().toISOString(), loading: true };
    setChatHistory(h => [...h, userMsg, streamingMsg]);
    setChatInput("");
    setChatLoading(true);

    const historyPayload = chatHistory
      .filter(m => !m.loading)
      .slice(-8)
      .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

    try {
      const r = await fetch(`${BASE}/api/billie/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history: historyPayload }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const reader = r.body?.getReader();
      if (!reader) throw new Error("لا يوجد stream");
      const dec = new TextDecoder();
      let buf = "";
      let finalModel = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "chunk") {
              setChatHistory(h => {
                const copy = [...h];
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: ev.text, loading: false };
                return copy;
              });
            } else if (ev.type === "done") {
              finalModel = ev.model;
              setChatHistory(h => {
                const copy = [...h];
                copy[copy.length - 1] = { role: "billie", text: ev.text, model: ev.model, ts: ev.timestamp || new Date().toISOString() };
                return copy;
              });
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      // Fallback to non-streaming chat
      try {
        const r2 = await fetch(`${BASE}/api/billie/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history: historyPayload }),
        });
        const data = await r2.json();
        if (!r2.ok) throw new Error(data.error || "فشل الاتصال");
        setChatHistory(h => {
          const copy = [...h];
          copy[copy.length - 1] = { role: "billie", text: data.reply, model: data.model, ts: data.timestamp || new Date().toISOString() };
          return copy;
        });
      } catch (err2: any) {
        setChatHistory(h => {
          const copy = [...h];
          copy[copy.length - 1] = { role: "billie", text: `⚠️ تعذّر الاتصال: ${err2?.message || "خطأ غير معروف"} — تحقق من مفاتيح API.`, ts: new Date().toISOString() };
          return copy;
        });
      }
    }
    setChatLoading(false);
  }, [chatHistory, chatLoading]);

  function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendChat(chatInput);
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
    try { await resolveAlert.mutateAsync({ alertId }); await refetchAlerts(); qc.invalidateQueries(); } catch {}
    setResolvingId(null);
  }

  async function handleResolveComplaint(id: string) {
    setResolvingId(id);
    try { await resolveComplaint.mutateAsync({ id }); await refetchComplaints(); qc.invalidateQueries(); } catch {}
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
    qc.invalidateQueries(); await refetchAlerts();
  }

  const TABS = [
    { key: "chat",       label: "شات مع بيليه",            icon: Bot },
    { key: "overview",   label: "نظرة عامة",               icon: Eye },
    { key: "news",       label: "أخبار الذكاء الاصطناعي",  icon: Newspaper },
    { key: "alerts",     label: `التنبيهات${alerts?.filter(a => !a.resolved).length ? ` (${alerts.filter(a => !a.resolved).length})` : ""}`, icon: AlertTriangle },
    { key: "complaints", label: "الشكاوى",                 icon: MessageSquarePlus },
  ] as const;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/50 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
              <BrainCircuit size={28} />
            </div>
            <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">بيليه</h1>
              <Badge className="bg-primary/10 text-primary border-primary/30 font-mono text-xs">Supreme Supervisor</Badge>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">نشطة</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">المشرفة العليا · منسقة الوكلاء · محرك تطور ACIS</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                <Cpu size={9} /> gemini-2.5-pro → qwen-max
              </span>
              <span className={`text-[10px] font-mono flex items-center gap-1 ${healthColor}`}>
                <Activity size={9} /> صحة النظام: {healthScore}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                <Hash size={9} /> {status?.agents_monitored ?? 0} وكيل تحت الإشراف
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowCapabilities(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/50 rounded px-2.5 py-1.5 hover:border-primary/30 hover:text-primary transition-colors">
            <BookOpen size={12} />
            {showCapabilities ? "إخفاء القدرات" : "عرض القدرات"}
            {showCapabilities ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* ── Capabilities Panel ── */}
      {showCapabilities && (
        <div className="rounded border border-primary/20 bg-primary/3 overflow-hidden">
          <div className="px-4 py-2 border-b border-primary/15 bg-primary/5 flex items-center gap-2">
            <Star size={12} className="text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-widest">قدرات بيليه وأدواتها</span>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Tools */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <Wrench size={10} /> الأدوات المتاحة
              </div>
              {BILLIE_TOOLS.map(t => (
                <div key={t.name} className="flex items-start gap-2 p-2 rounded bg-secondary/40 border border-border/30">
                  <t.icon size={13} className={t.tier === "pro" ? "text-primary shrink-0 mt-0.5" : "text-orange-400 shrink-0 mt-0.5"} />
                  <div className="text-right flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[9px] font-mono px-1 rounded ${t.tier === "pro" ? "bg-primary/10 text-primary" : "bg-orange-400/10 text-orange-400"}`}>{t.tier}</span>
                      <span className="text-xs font-semibold">{t.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <BookOpen size={10} /> المهارات والتخصصات
              </div>
              <div className="flex flex-wrap gap-1.5">
                {BILLIE_SKILLS.map(s => (
                  <span key={s} className="text-[10px] px-2 py-1 rounded-full bg-secondary/60 border border-border/30 text-foreground/80">{s}</span>
                ))}
              </div>
              <div className="mt-3 p-3 rounded bg-secondary/30 border border-border/20 space-y-1.5">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Clock size={9} /> حدود الاستخدام
                </div>
                {[
                  { k: "النموذج الأساسي", v: "gemini-2.5-pro", c: "text-primary" },
                  { k: "النموذج الاحتياطي", v: "qwen-max", c: "text-orange-400" },
                  { k: "الحد الأقصى للرموز", v: "8,192 رمز/استجابة", c: "text-foreground" },
                  { k: "الذاكرة السياقية", v: "آخر 6 رسائل", c: "text-foreground" },
                  { k: "وقت الاستجابة", v: "5–30 ثانية (pro)", c: "text-amber-400" },
                ].map(r => (
                  <div key={r.k} className="flex justify-between text-[10px] font-mono">
                    <span className={r.c}>{r.v}</span>
                    <span className="text-muted-foreground">{r.k}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions preview */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <Zap size={10} /> استخدامات سريعة
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {QUICK_ACTIONS.map(a => (
                  <button key={a.label} onClick={() => { setTab("chat"); sendChat(a.prompt); }}
                    className={`flex items-center gap-2 p-2 rounded border text-xs text-right transition-colors ${a.color}`}>
                    <a.icon size={12} className="shrink-0" />
                    <span className="flex-1">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 whitespace-nowrap ${tab === t.key ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div className="flex flex-col gap-3">
          {/* Messages */}
          <div className="bg-card border border-border/50 rounded overflow-hidden flex flex-col" style={{ height: "420px" }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-secondary/20">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                بيليه متصلة — gemini-2.5-pro
              </div>
              <button onClick={() => setChatHistory([{ role: "billie", text: "تم مسح المحادثة. كيف يمكنني مساعدتك؟", ts: new Date().toISOString() }])}
                className="text-[10px] text-muted-foreground hover:text-foreground font-mono flex items-center gap-1">
                <X size={10} /> مسح
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs border ${
                    msg.role === "billie"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-secondary border-border text-muted-foreground"
                  }`}>
                    {msg.role === "billie" ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[78%] ${msg.role === "user" ? "text-right" : "text-right"}`}>
                    {msg.loading ? (
                      <div className="flex gap-1 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        {[0,1,2].map(d => (
                          <div key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                            style={{ animationDelay: `${d * 0.15}s` }} />
                        ))}
                      </div>
                    ) : (
                      <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "billie"
                          ? "bg-primary/5 border border-primary/20 text-foreground"
                          : "bg-secondary border border-border text-foreground"
                      }`}>
                        {msg.text}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-muted-foreground/60"
                      style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      {msg.model && <span className="text-primary/50">{msg.model}</span>}
                      <span>{new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => sendChat(a.prompt)} disabled={chatLoading}
                className={`flex items-center gap-2 p-2.5 rounded border text-xs text-right transition-colors disabled:opacity-50 ${a.color}`}>
                <a.icon size={13} className="shrink-0" />
                <span className="leading-tight">{a.label}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <button type="submit" disabled={chatLoading || !chatInput.trim()}
              className="shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors">
              {chatLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
            <Textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
              placeholder="اكتب رسالتك لبيليه… (Enter للإرسال، Shift+Enter لسطر جديد)"
              dir="rtl"
              rows={2}
              className="flex-1 text-right resize-none text-sm"
              disabled={chatLoading}
            />
          </form>
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="درجة الصحة"    value={sLoad ? null : `${healthScore}%`}         sub="الإجمالي"     className={healthColor} />
            <MetricCard label="الوكلاء المراقبون" value={sLoad ? null : status?.agents_monitored} sub="متصل"        className="text-emerald-400" />
            <MetricCard label="مهام اليوم"    value={metrics?.total_executions_today ?? null}   sub="تنفيذ"       className="text-sky-400" />
            <MetricCard label="معدل النجاح"   value={metrics ? `${metrics.success_rate}%` : null} sub="خط الأنابيب" className="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={12} /> مؤشرات النظام
              </div>
              {sLoad ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-5 w-full bg-secondary" />) : (
                <div className="space-y-2 font-mono text-sm">
                  {[
                    { k: "الوكلاء المتصلون",  v: `${metrics?.agents_online ?? 0}/${metrics?.total_agents ?? 0}`, bar: metrics?.total_agents ? Math.round((metrics.agents_online ?? 0) / metrics.total_agents * 100) : 0 },
                    { k: "معدل النجاح",        v: `${metrics?.success_rate ?? 100}%`,  bar: metrics?.success_rate ?? 100 },
                    { k: "متوسط الاستجابة",   v: `${metrics?.avg_response_ms ?? 0}ms`, bar: Math.max(0, 100 - Math.min((metrics?.avg_response_ms ?? 0) / 30, 100)) },
                    { k: "المشاريع النشطة",   v: `${metrics?.active_projects ?? 0} جارٍ`, bar: Math.min((metrics?.active_projects ?? 0) * 20, 100) },
                  ].map(row => (
                    <div key={row.k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={row.bar > 80 ? "text-emerald-400" : row.bar > 60 ? "text-amber-400" : "text-muted-foreground"}>{row.v}</span>
                        <span className="text-muted-foreground">{row.k}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${row.bar > 80 ? "bg-emerald-400" : row.bar > 60 ? "bg-amber-400" : "bg-primary"}`} style={{ width: `${row.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded border border-border/50 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setTab("alerts" as any)} className="text-xs text-primary font-mono hover:underline">عرض الكل ←</button>
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} /> آخر التنبيهات
                </div>
              </div>
              {aLoad ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 bg-secondary" />) : (
                <>
                  {alerts?.slice(0, 4).filter(a => !a.resolved).map(a => (
                    <div key={a.id} className={`p-2 rounded border text-xs ${SEV_COLOR[a.severity] ?? SEV_COLOR.info} flex items-start justify-between gap-2`}>
                      <button onClick={() => handleResolveAlert(a.id)} disabled={resolvingId === a.id}
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

      {/* ── NEWS TAB ── */}
      {tab === "news" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button onClick={handleAnalyzeNews} disabled={analyzingNews}
              className="gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs h-8">
              {analyzingNews ? <RefreshCw size={12} className="animate-spin" /> : <BrainCircuit size={12} />}
              {analyzingNews ? "بيليه تحلل…" : "تحليل ذكي للأخبار"}
            </Button>
            <div className="text-xs font-mono text-muted-foreground">أحدث أخبار الذكاء الاصطناعي — 2026</div>
          </div>
          {newsAnalysis && (
            <div className="p-3 rounded border border-primary/20 bg-primary/5 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto" dir="rtl">
              <div className="flex items-center justify-between mb-1">
                <button onClick={() => setNewsAnalysis(null)} className="text-muted-foreground"><X size={10} /></button>
                <span className="text-primary font-bold">تحليل بيليه للأخبار:</span>
              </div>
              {newsAnalysis}
            </div>
          )}
          {nLoad ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card" />) :
            news?.map((item: any) => (
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
                      <Badge className={`text-[10px] font-mono px-1.5 py-0 ${
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
            ))
          }
        </div>
      )}

      {/* ── ALERTS TAB ── */}
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
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-right" dir="rtl">
                {[["critical","حرج"],["error","خطأ"],["warning","تحذير"],["info","معلومة"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <Input required placeholder="عنوان التنبيه" value={newAlertForm.title} onChange={e => setNewAlertForm(f => ({ ...f, title: e.target.value }))} dir="rtl" className="text-right" />
              <Textarea required rows={2} placeholder="رسالة التنبيه" value={newAlertForm.message} onChange={e => setNewAlertForm(f => ({ ...f, message: e.target.value }))} dir="rtl" className="text-right" />
              <Button type="submit" disabled={createAlert.isPending} className="w-full gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs">
                <Bell size={12} /> {createAlert.isPending ? "جارٍ الإنشاء…" : "إنشاء التنبيه"}
              </Button>
            </form>
          )}
          {aLoad ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />) :
            !alerts?.length ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
                <p>جميع الأنظمة طبيعية — لا توجد تنبيهات</p>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={`p-4 rounded border ${a.resolved ? "opacity-50 border-border/30 bg-secondary/20" : (SEV_COLOR[a.severity] ?? SEV_COLOR.info)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {!a.resolved && (
                      <Button onClick={() => handleResolveAlert(a.id)} disabled={resolvingId === a.id}
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
                    <div className="text-xs font-mono opacity-40 mt-1">{new Date(a.created_at).toLocaleString("ar-SA")}</div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── COMPLAINTS TAB ── */}
      {tab === "complaints" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">إرسال شكوى إلى بيليه</div>
            <form onSubmit={handleComplaint} className="space-y-3 p-4 bg-card border border-border/50 rounded">
              <Input placeholder="عنوان الشكوى" required value={complaintForm.title} dir="rtl" className="text-right" onChange={e => setComplaintForm(f => ({ ...f, title: e.target.value }))} />
              <Textarea placeholder="اشرح المشكلة بالتفصيل…" required rows={4} value={complaintForm.description} dir="rtl" className="text-right" onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))} />
              <select value={complaintForm.agent_id} onChange={e => setComplaintForm(f => ({ ...f, agent_id: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-right" dir="rtl">
                <option value="">اختر وكيلاً (اختياري)</option>
                {agents?.map(a => <option key={a.id} value={a.id}>{a.nameAr || a.name}</option>)}
              </select>
              <select value={complaintForm.severity} onChange={e => setComplaintForm(f => ({ ...f, severity: e.target.value }))}
                className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-right" dir="rtl">
                {[{ v: "low", l: "منخفض" }, { v: "medium", l: "متوسط" }, { v: "high", l: "مرتفع" }, { v: "critical", l: "حرج" }].map(s => (
                  <option key={s.v} value={s.v}>{s.l}</option>
                ))}
              </select>
              <Button type="submit" disabled={submitComplaint.isPending} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageSquarePlus size={14} /> {submitComplaint.isPending ? "جارٍ الإرسال…" : "إرسال إلى بيليه"}
              </Button>
              {complaintSent && (
                <div className="text-center text-emerald-400 text-sm font-mono flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} /> تم استلام الشكوى — ستتلقى ردّاً من بيليه
                </div>
              )}
            </form>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">{complaints?.filter(c => c.status === "open" || c.status === "investigating").length ?? 0} مفتوحة</span>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">سجل الشكاوى</div>
            </div>
            {cLoad ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 bg-card" />) :
              !complaints?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد شكاوى مسجّلة</div>
              ) : complaints.map(c => (
                <div key={c.id} className={`p-3 rounded border bg-card ${c.status === "resolved" ? "opacity-60 border-border/30" : "border-border/50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      {c.status !== "resolved" && (
                        <Button onClick={() => handleResolveComplaint(c.id)} disabled={resolvingId === c.id}
                          className="text-xs h-6 gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2">
                          {resolvingId === c.id ? <RefreshCw size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
                          حل
                        </Button>
                      )}
                      {c.status === "resolved" && <Badge className="text-[10px] bg-emerald-400/10 text-emerald-400 border-emerald-400/30">محلول</Badge>}
                    </div>
                    <div className="text-right flex-1">
                      <div className="flex items-center gap-2 justify-end mb-1">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${SEV_COLOR[c.severity] ?? SEV_COLOR.info}`}>{SEV_AR[c.severity] || c.severity}</span>
                        <span className="font-semibold text-sm">{c.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.description?.substring(0, 100)}</p>
                      {c.billie_response && (
                        <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/20 text-xs text-right">
                          <span className="text-primary font-mono text-[10px]">بيليه: </span>{c.billie_response}
                        </div>
                      )}
                      <div className="text-[10px] font-mono text-muted-foreground/50 mt-1">{new Date(c.created_at).toLocaleString("ar-SA")}</div>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, className = "" }: { label: string; value: string | number | null; sub: string; className?: string }) {
  return (
    <div className="p-4 rounded border border-border/50 bg-card">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-right mb-2">{label}</div>
      {value === null
        ? <Skeleton className="h-8 w-2/3 bg-secondary" />
        : <div className={`text-3xl font-bold font-mono ${className}`}>{value}</div>
      }
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}
