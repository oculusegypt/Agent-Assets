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
  Radio, Star, Clock, Hash, Scissors, FlaskConical, RotateCcw,
  ChevronRight, AlertCircle, Info, ArrowRight, GitCompare,
  Volume2, ImageIcon, Loader2, ThumbsUp, ThumbsDown, Copy,
  Music2, Sparkles, Mic,
  Code2, FolderOpen, FileCode2, FilePlus2, CheckCheck,
  Terminal, GitBranch, Play, ChevronLeft, Eye as EyeIcon,
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

type CodeStep = {
  type: "status" | "plan" | "reading" | "file_read" | "writing" | "file_written" | "write_error" | "done" | "error";
  message?: string;
  path?: string;
  lines?: number;
  is_new?: boolean;
  reason?: string;
  error?: string;
  preview?: string;
  plan?: string;
  files_to_read?: string[];
  scope?: string;
  summary?: string;
  modified_files?: string[];
  errors?: string[];
  content_preview?: string;
};

type ChatMsg = {
  role: "user" | "billie";
  text: string;
  model?: string;
  ts: string;
  loading?: boolean;
  mediaType?: "image" | "audio";
  mediaUrl?: string;
  mediaLoading?: boolean;
  suggestions?: string[];
  codeTask?: boolean;
  codeSteps?: CodeStep[];
  codeDone?: boolean;
};

function detectCodeIntent(text: string): boolean {
  return /(?:أنشئ|اصنع|أضف|اعمل|ابن|برمج|عدّل|عدل|غيّر|غير|اكتب|طوّر|طور|حسّن|حسن|أنشأ|أنشا)\s*(?:وكيل|صفحة|page|مسار|route|endpoint|api|دالة|function|مكون|component|agent|وكلاء|ملف|كود)/i.test(text) ||
    /(?:create|add|build|make|edit|update|generate|write|fix|implement)\s+(?:agent|page|route|api|function|component|file|class|hook)/i.test(text) ||
    /(?:اصلح|صحّح|صحح|حل)\s*(?:خطأ|بيج|bug|مشكلة|error)\s*(?:في\s*الكود|برمجي|في\s*الملف)/i.test(text) ||
    /(?:وكيل\s*(?:جديد|مساعد|فرعي)|subagent|sub-agent)/i.test(text) ||
    /افتح\s*(?:ملف|صفحة|كود)/i.test(text);
}

function getFileIcon(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return <FileCode2 size={10} className="text-sky-400" />;
  if (path.endsWith(".ts") || path.endsWith(".js")) return <FileCode2 size={10} className="text-amber-400" />;
  if (path.endsWith(".css")) return <FileCode2 size={10} className="text-pink-400" />;
  if (path.endsWith(".json")) return <FileCode2 size={10} className="text-emerald-400" />;
  return <FileText size={10} className="text-muted-foreground" />;
}

function getLangClass(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".jsx") || path.endsWith(".ts") || path.endsWith(".js")) return "text-sky-100";
  if (path.endsWith(".css")) return "text-pink-100";
  if (path.endsWith(".json")) return "text-emerald-100";
  return "text-foreground";
}

function detectImageIntent(text: string): boolean {
  return /(?:ولّد|ولد|اصنع|أنشئ|ارسم|أريد|اعطيني|صمّم|أنتج|عمل)\s*(?:لي\s*)?(?:صورة|صور|لوحة|رسمة|مشهد|صورة\s*لـ)/i.test(text) ||
    /(?:generate|create|draw|make|design|render)\s*(?:an?\s*)?(?:image|picture|photo|illustration)/i.test(text);
}
function detectAudioIntent(text: string): boolean {
  return /(?:ولّد|ولد|اقرأ|اسمعني|اعطيني|أريد|نطّق|تكلّم|اقرأ\s*لي)\s*(?:لي\s*)?(?:صوت|مقطع\s*صوت|تسجيل|الصوت|صوتياً)/i.test(text) ||
    /(?:ولّد|ولد|أنشئ|اصنع|اعمل|أنتج)\s*(?:لي\s*)?(?:موسيقى|موسيقا|مقطع\s*موسيق|لحن|نغمة|أغنية|تسجيل\s*صوتي|مؤثر\s*صوتي)/i.test(text) ||
    /(?:read|speak|voice|tts|say\s*this|generate\s*audio|narrate|music|soundtrack|bgm|sound\s*effect)/i.test(text);
}
function buildSuggestions(text: string): string[] {
  const chips: string[] = [];
  if (/توص|أنصح|أقترح|ينبغي|يجب/i.test(text)) { chips.push("كيف أنفّذ ذلك؟"); chips.push("عرض الأولويات"); }
  if (/مشكلة|خطأ|فشل|تنبيه|تحذير|أعطال/i.test(text)) { chips.push("السبب الجذري"); chips.push("الحل الفوري"); }
  if (/تحليل|تقرير|مؤشر|إحصاء/i.test(text)) { chips.push("تعمّق أكثر"); chips.push("خطة التحسين"); }
  if (/وكيل|agent/i.test(text) && !/مشكلة/.test(text)) chips.push("تفاصيل الوكلاء");
  if (/أخبار|تطور|إطلاق|نموذج/i.test(text)) { chips.push("تأثير على ACIS"); chips.push("هل نُحدّث النماذج؟"); }
  if (chips.length < 2) { chips.push("أخبريني المزيد"); chips.push("ما الخطوات التالية؟"); }
  return chips.slice(0, 4);
}
function hasRecommendation(text: string): boolean {
  return /توص|خطة\s*(?:عمل|تطوير)|أقترح\s*(?:أن|عليك)|أنصح\s*بـ|يمكنني\s*(?:تنفيذ|المساعدة)/i.test(text);
}
function renderInlineFmt(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-bold text-foreground">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}
function formatBillieText(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { elements.push(<div key={i} className="h-1" />); i++; continue; }
    if (/^[═─━]{3,}/.test(trimmed)) {
      const title = trimmed.replace(/^[═─━\s]+/, "").replace(/[═─━\s]+$/, "");
      if (title) elements.push(
        <div key={i} className="flex items-center gap-2 my-2">
          <div className="h-px flex-1 bg-primary/20" />
          <span className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">{title}</span>
          <div className="h-px flex-1 bg-primary/20" />
        </div>
      );
      i++; continue;
    }
    if (/^[•·▸▶\-]\s+/.test(trimmed)) {
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/70 mt-[7px] shrink-0" />
          <span className="text-sm leading-relaxed flex-1">{renderInlineFmt(trimmed.replace(/^[•·▸▶\-]\s+/, ""))}</span>
        </div>
      );
      i++; continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)/)?.[1] || "·";
      elements.push(
        <div key={i} className="flex items-start gap-2 my-1">
          <span className="min-w-[20px] h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">{num}</span>
          <span className="text-sm leading-relaxed flex-1">{renderInlineFmt(trimmed.replace(/^\d+[.)]\s+/, ""))}</span>
        </div>
      );
      i++; continue;
    }
    elements.push(<p key={i} className="text-sm leading-relaxed my-0.5 text-foreground/90">{renderInlineFmt(trimmed)}</p>);
    i++;
  }
  return <div className="space-y-0">{elements}</div>;
}

// ── CodeAgentPanel component ──
function CodeAgentPanel({ steps, loading, done }: { steps: CodeStep[]; loading: boolean; done: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [activeFile, setActiveFile] = useState<{ path: string; content: string; is_new?: boolean } | null>(null);

  const planStep   = steps.find(s => s.type === "plan");
  const doneStep   = steps.find(s => s.type === "done");
  const errorStep  = steps.find(s => s.type === "error");
  const readFiles  = steps.filter(s => s.type === "file_read");
  const writtenFiles = steps.filter(s => s.type === "file_written");
  const statusMsg  = [...steps].reverse().find(s => s.type === "status" || s.type === "reading" || s.type === "writing");

  const currentStatus = loading
    ? (statusMsg?.message || (statusMsg?.type === "reading" ? `قراءة ${statusMsg.path}` : statusMsg?.type === "writing" ? `كتابة ${statusMsg.path}` : "جارٍ التنفيذ…"))
    : done ? "✅ اكتملت العملية" : errorStep ? `❌ ${errorStep.message}` : "";

  return (
    <div className="w-full rounded-2xl border border-indigo-500/25 bg-[#0d1117] overflow-hidden text-left font-mono shadow-xl shadow-indigo-500/8">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 to-transparent">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <Terminal size={10} className="text-indigo-400/60" />
          <span className="text-[10px] text-indigo-300/60">billie — code-agent</span>
        </div>
        {loading && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {done && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        {errorStep && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
        <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-indigo-400/50 hover:text-indigo-300 transition-colors px-1">
          {expanded ? "−" : "+"}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-2">
          {/* Plan */}
          {planStep && (
            <div className="text-[11px]">
              <span className="text-indigo-400">→ </span>
              <span className="text-indigo-200/80">{planStep.plan}</span>
              {planStep.scope && <span className="mr-2 text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300/70">{planStep.scope}</span>}
            </div>
          )}

          {/* Status */}
          {(loading || (!done && !errorStep)) && currentStatus && (
            <div className="flex items-center gap-2 text-[11px]">
              <Loader2 size={10} className="animate-spin text-amber-400 shrink-0" />
              <span className="text-amber-200/70">{currentStatus}</span>
            </div>
          )}

          {/* Files Read */}
          {readFiles.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-indigo-400/50 uppercase tracking-widest">ملفات مقروءة</div>
              {readFiles.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] group">
                  <FolderOpen size={9} className="text-amber-400/70 shrink-0" />
                  <span className="text-amber-200/60 flex-1 truncate">{s.path}</span>
                  {s.lines != null && <span className="text-[9px] text-indigo-400/40">{s.lines}L</span>}
                  {s.preview && (
                    <button onClick={() => setActiveFile({ path: s.path || "", content: s.preview || "" })}
                      className="opacity-0 group-hover:opacity-100 text-[9px] text-indigo-400/60 hover:text-indigo-300 px-1 py-0.5 rounded transition-all border border-indigo-500/20 flex items-center gap-1">
                      <EyeIcon size={8} /> عرض
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Files Written */}
          {writtenFiles.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-emerald-400/50 uppercase tracking-widest">ملفات معدّلة</div>
              {writtenFiles.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] group">
                  {s.is_new ? <FilePlus2 size={9} className="text-emerald-400 shrink-0" /> : <FileCode2 size={9} className="text-sky-400 shrink-0" />}
                  <span className={`flex-1 truncate ${s.is_new ? "text-emerald-300/80" : "text-sky-300/80"}`}>{s.path}</span>
                  {s.lines != null && <span className="text-[9px] text-indigo-400/40">{s.lines}L</span>}
                  <CheckCheck size={9} className="text-emerald-400/70" />
                  {s.content_preview && (
                    <button onClick={() => setActiveFile({ path: s.path || "", content: s.content_preview || "", is_new: s.is_new })}
                      className="opacity-0 group-hover:opacity-100 text-[9px] text-indigo-400/60 hover:text-indigo-300 px-1 py-0.5 rounded transition-all border border-indigo-500/20 flex items-center gap-1">
                      <EyeIcon size={8} /> عرض
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {errorStep && (
            <div className="text-[10px] text-red-400/80 bg-red-500/8 border border-red-500/20 rounded-lg px-2.5 py-2">
              ✗ {errorStep.message}
            </div>
          )}

          {/* Done summary */}
          {doneStep?.summary && (
            <div className="text-[10px] text-emerald-300/80 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-2">
              ✓ {doneStep.summary}
            </div>
          )}
        </div>
      )}

      {/* Inline file viewer */}
      {activeFile && (
        <div className="border-t border-indigo-500/20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-950/30">
            {getFileIcon(activeFile.path)}
            <span className="text-[10px] text-indigo-300/70 flex-1 truncate">{activeFile.path}</span>
            {activeFile.is_new && <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">جديد</span>}
            <button onClick={() => setActiveFile(null)} className="text-[10px] text-indigo-400/50 hover:text-red-400 transition-colors">✕</button>
          </div>
          <pre className={`text-[10px] leading-relaxed p-3 overflow-x-auto max-h-52 overflow-y-auto ${getLangClass(activeFile.path)}`}
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: "transparent", tabSize: 2 }}>
            {activeFile.content}
          </pre>
        </div>
      )}
    </div>
  );
}

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
  { icon: Scissors,  name: "جراحة الكود",          desc: "تشخيص وتعديل إعدادات الوكلاء برمجياً مع سجل التراجع", tier: "pro" },
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

  const [tab, setTab] = useState<"chat" | "overview" | "news" | "alerts" | "complaints" | "surgery">("chat");
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

  // ── جراحة الكود state ──
  const [surgeryAgentId, setSurgeryAgentId] = useState("");
  const [surgeryIssue, setSurgeryIssue] = useState("");
  const [surgeryDiagnosis, setSurgeryDiagnosis] = useState<any>(null);
  const [surgeryDiagnosing, setSurgeryDiagnosing] = useState(false);
  const [surgeryAgentData, setSurgeryAgentData] = useState<any>(null);
  const [surgeryLoadingAgent, setSurgeryLoadingAgent] = useState(false);
  const [surgeryPatches, setSurgeryPatches] = useState<any[]>([]);
  const [surgeryPatchesLoading, setSurgeryPatchesLoading] = useState(false);
  const [applyingPatch, setApplyingPatch] = useState<string | null>(null);
  const [rollbackingPatch, setRollbackingPatch] = useState<string | null>(null);
  const [surgeryMsg, setSurgeryMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [manualPatch, setManualPatch] = useState({ field: "prompt", new_value: "", reason: "" });
  const [showManualPatch, setShowManualPatch] = useState(false);

  const healthScore = status?.system_health_score ?? 0;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const wantsCode  = detectCodeIntent(text);
    const wantsImage = !wantsCode && detectImageIntent(text);
    const wantsAudio = !wantsCode && detectAudioIntent(text);

    const userMsg: ChatMsg = { role: "user", text: text.trim(), ts: new Date().toISOString() };
    const streamingMsg: ChatMsg = {
      role: "billie", text: "", ts: new Date().toISOString(), loading: true,
      mediaType: wantsImage ? "image" : wantsAudio ? "audio" : undefined,
      mediaLoading: wantsImage || wantsAudio,
      codeTask: wantsCode,
      codeSteps: wantsCode ? [] : undefined,
    };
    setChatHistory(h => [...h, userMsg, streamingMsg]);
    setChatInput("");
    setChatLoading(true);

    const historyPayload = chatHistory
      .filter(m => !m.loading)
      .slice(-8)
      .map(m => ({ role: m.role === "user" ? "user" : "model", text: m.text }));

    // ── وكيل الكود (Code Agent SSE) ──
    if (wantsCode) {
      const appendStep = (step: CodeStep) => {
        setChatHistory(h => {
          const copy = [...h];
          const li = copy.length - 1;
          if (copy[li]?.role === "billie") {
            copy[li] = { ...copy[li], loading: false, codeSteps: [...(copy[li].codeSteps || []), step] };
          }
          return copy;
        });
      };
      try {
        const r = await fetch(`${BASE}/api/billie/code-agent/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: text.trim() }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const reader = r.body?.getReader();
        if (!reader) throw new Error("لا stream");
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev: CodeStep = JSON.parse(line.slice(6));
              appendStep(ev);
              if (ev.type === "done") {
                setChatHistory(h => {
                  const copy = [...h];
                  const li = copy.length - 1;
                  if (copy[li]?.role === "billie") {
                    const files = ev.modified_files || [];
                    copy[li] = {
                      ...copy[li], codeDone: true,
                      text: `✅ ${ev.summary || "تمت العملية"}${files.length ? `\n\nالملفات المعدّلة:\n${files.map(f => `• ${f}`).join("\n")}` : ""}`,
                      suggestions: files.length > 0 ? ["اعرض التغييرات", "شغّل واختبر", "أضف ميزة أخرى"] : ["اشرح ما تم", "اختبر الكود"],
                    };
                  }
                  return copy;
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: any) {
        appendStep({ type: "error", message: err?.message || "فشل وكيل الكود" });
        setChatHistory(h => {
          const copy = [...h];
          if (copy[copy.length - 1]?.role === "billie") {
            copy[copy.length - 1] = { ...copy[copy.length - 1], loading: false, text: `⚠️ فشل وكيل الكود: ${err?.message}` };
          }
          return copy;
        });
      }
      setChatLoading(false);
      return;
    }

    // ── Media generation (concurrent) ──
    if (wantsImage || wantsAudio) {
      const mediaEndpoint = wantsImage ? `${BASE}/api/billie/generate-image` : `${BASE}/api/billie/tts-chat`;
      const mediaBody = wantsImage
        ? { prompt: text.trim() }
        : { text: text.replace(/(?:ولّد|ولد|اقرأ|نطّق)\s*(?:لي\s*)?(?:صوت[:\s]*)?/i, "").trim().slice(0, 500) };

      fetch(mediaEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mediaBody),
      }).then(r => r.json()).then(result => {
        setChatHistory(h => {
          const copy = [...h];
          const li = copy.length - 1;
          if (copy[li]?.role === "billie") {
            copy[li] = { ...copy[li], mediaLoading: false, ...(result?.filename ? { mediaUrl: `${BASE}/api/media/${result.filename}` } : {}) };
          }
          return copy;
        });
      }).catch(() => {
        setChatHistory(h => {
          const copy = [...h];
          if (copy[copy.length - 1]?.role === "billie") copy[copy.length - 1] = { ...copy[copy.length - 1], mediaLoading: false };
          return copy;
        });
      });
    }

    // ── Text stream ──
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
              const suggs = buildSuggestions(ev.text || "");
              setChatHistory(h => {
                const copy = [...h];
                const prev = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  role: "billie", text: ev.text, model: ev.model,
                  ts: ev.timestamp || new Date().toISOString(),
                  suggestions: suggs,
                  mediaType: prev.mediaType, mediaUrl: prev.mediaUrl, mediaLoading: prev.mediaLoading,
                };
                return copy;
              });
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      try {
        const r2 = await fetch(`${BASE}/api/billie/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), history: historyPayload }),
        });
        const data = await r2.json();
        if (!r2.ok) throw new Error(data.error || "فشل الاتصال");
        const suggs = buildSuggestions(data.reply || "");
        setChatHistory(h => {
          const copy = [...h];
          const prev = copy[copy.length - 1];
          copy[copy.length - 1] = {
            role: "billie", text: data.reply, model: data.model,
            ts: data.timestamp || new Date().toISOString(),
            suggestions: suggs,
            mediaType: prev.mediaType, mediaUrl: prev.mediaUrl, mediaLoading: prev.mediaLoading,
          };
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

  // ── جراحة الكود — handlers ──
  async function loadSurgeryAgent(id: string) {
    if (!id) return;
    setSurgeryLoadingAgent(true); setSurgeryAgentData(null); setSurgeryDiagnosis(null);
    try {
      const r = await fetch(`${BASE}/api/billie/agent-code/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "فشل تحميل الوكيل");
      setSurgeryAgentData(d);
    } catch (err: any) { setSurgeryMsg({ type: "error", text: err.message }); }
    setSurgeryLoadingAgent(false);
  }

  async function handleDiagnose() {
    if (!surgeryAgentId) return;
    setSurgeryDiagnosing(true); setSurgeryDiagnosis(null); setSurgeryMsg(null);
    try {
      const r = await fetch(`${BASE}/api/billie/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: surgeryAgentId, issue_description: surgeryIssue }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "فشل التشخيص");
      setSurgeryDiagnosis(d);
    } catch (err: any) { setSurgeryMsg({ type: "error", text: err.message }); }
    setSurgeryDiagnosing(false);
  }

  async function handleApplyPatch(field: string, new_value: string, reason: string, patch_type = "fix") {
    setApplyingPatch(field); setSurgeryMsg(null);
    try {
      const r = await fetch(`${BASE}/api/billie/apply-patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: surgeryAgentId, field, new_value, reason, patch_type }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "فشل تطبيق التعديل");
      setSurgeryMsg({ type: "success", text: `✅ ${d.message}` });
      await loadSurgeryAgent(surgeryAgentId);
      await loadSurgeryPatches();
      qc.invalidateQueries();
    } catch (err: any) { setSurgeryMsg({ type: "error", text: err.message }); }
    setApplyingPatch(null);
  }

  async function handleRollback(patchId: string) {
    setRollbackingPatch(patchId); setSurgeryMsg(null);
    try {
      const r = await fetch(`${BASE}/api/billie/rollback-patch/${patchId}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "فشل التراجع");
      setSurgeryMsg({ type: "success", text: "↩️ تم التراجع عن التعديل بنجاح" });
      await loadSurgeryAgent(surgeryAgentId);
      await loadSurgeryPatches();
      qc.invalidateQueries();
    } catch (err: any) { setSurgeryMsg({ type: "error", text: err.message }); }
    setRollbackingPatch(null);
  }

  async function loadSurgeryPatches() {
    setSurgeryPatchesLoading(true);
    try {
      const url = surgeryAgentId
        ? `${BASE}/api/billie/patches?agent_id=${surgeryAgentId}`
        : `${BASE}/api/billie/patches`;
      const r = await fetch(url);
      const d = await r.json();
      setSurgeryPatches(Array.isArray(d) ? d : []);
    } catch {}
    setSurgeryPatchesLoading(false);
  }

  useEffect(() => {
    if (tab === "surgery") loadSurgeryPatches();
  }, [tab]);

  const TABS = [
    { key: "chat",       label: "شات مع بيليه",            icon: Bot },
    { key: "overview",   label: "نظرة عامة",               icon: Eye },
    { key: "news",       label: "أخبار الذكاء الاصطناعي",  icon: Newspaper },
    { key: "alerts",     label: `التنبيهات${alerts?.filter(a => !a.resolved).length ? ` (${alerts.filter(a => !a.resolved).length})` : ""}`, icon: AlertTriangle },
    { key: "complaints", label: "الشكاوى",                 icon: MessageSquarePlus },
    { key: "surgery",    label: "جراحة الكود",             icon: Scissors },
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

          {/* ── Chat Container ── */}
          <div className="relative rounded-2xl border border-primary/20 bg-card/90 overflow-hidden flex flex-col shadow-xl shadow-primary/5" style={{ height: "540px" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/15 bg-gradient-to-l from-primary/8 via-primary/4 to-transparent shrink-0">
              <div className="flex items-center gap-2">
                <button onClick={() => setChatHistory([{ role: "billie", text: "تم مسح المحادثة. كيف يمكنني مساعدتك اليوم؟", ts: new Date().toISOString() }])}
                  className="text-[10px] text-muted-foreground hover:text-rose-400 font-mono flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20">
                  <RotateCcw size={9} /> مسح
                </button>
                <div className="w-px h-4 bg-border/40" />
                <span className="text-[9px] font-mono text-muted-foreground/50 flex items-center gap-1">
                  <Code2 size={8} /> اطلب كوداً أو صورةً أو صوتاً مباشرةً
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                  <span className="text-primary/60 text-[9px]">gemini-2.5-pro</span>
                  <span className="text-border/60">·</span>
                  <span>بيليه</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center shadow-sm shadow-primary/20">
                  <Bot size={15} className="text-primary" />
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.15) transparent" }}>
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border shadow-sm ${
                    msg.role === "billie"
                      ? "bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 text-primary shadow-primary/15"
                      : "bg-secondary/80 border-border/40 text-muted-foreground"
                  }`}>
                    {msg.role === "billie" ? <Bot size={15} /> : <User size={14} />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 max-w-[83%] flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>

                    {/* Loading dots */}
                    {msg.loading && !msg.codeTask && (
                      <div className="flex gap-1.5 items-center px-4 py-3 rounded-2xl bg-primary/6 border border-primary/15 shadow-sm">
                        {[0,1,2].map(d => (
                          <div key={d} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d*0.18}s` }} />
                        ))}
                        <span className="text-[11px] text-muted-foreground/60 font-mono mr-1">بيليه تفكّر…</span>
                      </div>
                    )}

                    {/* ── Code Agent Panel ── */}
                    {msg.codeTask && (msg.codeSteps || []).length >= 0 && (
                      <CodeAgentPanel steps={msg.codeSteps || []} loading={!!msg.loading} done={!!msg.codeDone} />
                    )}

                    {/* Main bubble */}
                    {!msg.loading && msg.text && (
                      <div className={`w-full px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "billie"
                          ? "bg-gradient-to-br from-primary/8 via-primary/5 to-transparent border border-primary/15 shadow-sm shadow-primary/5 text-right"
                          : "bg-secondary/60 border border-border/40 text-right"
                      }`}>
                        {msg.role === "billie" ? formatBillieText(msg.text) : <p className="leading-relaxed">{msg.text}</p>}
                      </div>
                    )}

                    {/* Media: loading state */}
                    {msg.mediaLoading && (
                      <div className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-secondary/40 border border-border/30">
                        <Loader2 size={13} className="animate-spin text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {msg.mediaType === "image" ? "جارٍ توليد الصورة عبر Gemini…" : "جارٍ توليد المقطع الصوتي…"}
                        </span>
                        <div className="flex gap-0.5 mr-auto">
                          {[0,1,2,3].map(d => (
                            <div key={d} className="w-1 h-3 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: `${d*0.1}s` }} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Media: image preview */}
                    {msg.mediaUrl && msg.mediaType === "image" && (
                      <div className="w-full rounded-2xl overflow-hidden border border-primary/20 shadow-lg shadow-primary/8">
                        <img src={msg.mediaUrl} alt="صورة مولّدة" className="w-full max-h-72 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="px-3 py-2 bg-gradient-to-l from-primary/8 to-transparent border-t border-primary/10 flex items-center gap-1.5">
                          <ImageIcon size={10} className="text-primary/60" />
                          <span className="text-[10px] font-mono text-primary/50">صورة مولّدة • Gemini AI</span>
                          <a href={msg.mediaUrl} download target="_blank" rel="noopener noreferrer"
                            className="mr-auto text-[10px] font-mono text-primary/50 hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded hover:bg-primary/10 transition-colors">
                            <ExternalLink size={8} /> تحميل
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Media: audio player */}
                    {msg.mediaUrl && msg.mediaType === "audio" && (
                      <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/8 to-transparent p-3.5">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                            <Volume2 size={11} className="text-emerald-400" />
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400/80">مقطع صوتي • Gemini TTS</span>
                        </div>
                        <audio controls src={msg.mediaUrl} className="w-full h-9 rounded-lg" />
                      </div>
                    )}

                    {/* Meta: time + model */}
                    {!msg.loading && (
                      <div className={`flex items-center gap-2 text-[9px] font-mono text-muted-foreground/40 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        {msg.model && <span className="text-primary/35">{msg.model}</span>}
                        <span>{new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    )}

                    {/* Billie actions: approve/reject + copy */}
                    {msg.role === "billie" && msg.text && !msg.loading && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hasRecommendation(msg.text) && (
                          <>
                            <button onClick={() => sendChat("موافق، نفّذ هذه الخطة وأخبريني بالنتائج")} disabled={chatLoading}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-all font-mono disabled:opacity-40">
                              <ThumbsUp size={9} /> موافق
                            </button>
                            <button onClick={() => sendChat("لا أوافق على هذا المقترح، قدّمي بديلاً مختلفاً")} disabled={chatLoading}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all font-mono disabled:opacity-40">
                              <ThumbsDown size={9} /> رفض
                            </button>
                          </>
                        )}
                        <button onClick={() => navigator.clipboard.writeText(msg.text)}
                          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-secondary/50 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all font-mono">
                          <Copy size={9} /> نسخ
                        </button>
                      </div>
                    )}

                    {/* Suggestion chips */}
                    {msg.role === "billie" && (msg.suggestions?.length ?? 0) > 0 && !msg.loading && (
                      <div className="flex flex-wrap gap-1.5">
                        {(msg.suggestions || []).map((s, si) => (
                          <button key={si} onClick={() => sendChat(s)} disabled={chatLoading}
                            className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-full border border-border/35 text-muted-foreground bg-secondary/30 hover:text-foreground hover:border-primary/40 hover:bg-primary/8 transition-all font-mono disabled:opacity-40">
                            <Sparkles size={8} className="text-primary/50" />
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* ── Quick Actions (modern card grid) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => sendChat(a.prompt)} disabled={chatLoading}
                className={`group flex items-center gap-2 p-2.5 rounded-xl border text-xs text-right transition-all duration-200 disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] ${a.color}`}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-current/10 shrink-0 group-hover:scale-110 transition-transform">
                  <a.icon size={12} />
                </div>
                <span className="leading-tight font-medium flex-1">{a.label}</span>
              </button>
            ))}
          </div>

          {/* ── Media Quick Triggers ── */}
          <div className="flex gap-2">
            <button onClick={() => sendChat("ولّد لي صورة لمشهد سينمائي ليلي مع أضواء المدينة")} disabled={chatLoading}
              className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/8 text-purple-400 hover:bg-purple-500/15 transition-all font-mono disabled:opacity-40">
              <ImageIcon size={11} /> توليد صورة
            </button>
            <button onClick={() => sendChat("ولّد لي مقطع صوتي: مرحباً بكم في نظام ACIS للإنتاج السينمائي")} disabled={chatLoading}
              className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-all font-mono disabled:opacity-40">
              <Volume2 size={11} /> توليد صوت
            </button>
            <button onClick={() => sendChat("ولّد لي موسيقى تصويرية: أوركسترا دراماتيكية للأكشن")} disabled={chatLoading}
              className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/8 text-sky-400 hover:bg-sky-500/15 transition-all font-mono disabled:opacity-40">
              <Music2 size={11} /> موسيقى تصويرية
            </button>
          </div>

          {/* ── Input ── */}
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <button type="submit" disabled={chatLoading || !chatInput.trim()}
              className="shrink-0 w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/25">
              {chatLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
            <Textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
              placeholder="اكتب رسالتك لبيليه… اطلب منها تحليلاً أو ولّد صورة أو مقطع صوتي (Enter للإرسال)"
              dir="rtl"
              rows={2}
              className="flex-1 text-right resize-none text-sm rounded-xl border-primary/15 focus:border-primary/35 bg-secondary/20 placeholder:text-muted-foreground/40"
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

      {/* ── SURGERY TAB ── */}
      {tab === "surgery" && (
        <div className="space-y-5" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button onClick={loadSurgeryPatches} variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground">
                <RefreshCw size={11} className={surgeryPatchesLoading ? "animate-spin" : ""} /> تحديث السجل
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Scissors size={14} className="text-primary" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">جراحة الكود — تعديل الوكلاء برمجياً</span>
            </div>
          </div>

          {/* رسالة النتيجة */}
          {surgeryMsg && (
            <div className={`p-3 rounded border text-sm font-mono flex items-center justify-between gap-2 ${surgeryMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              <button onClick={() => setSurgeryMsg(null)}><X size={12} /></button>
              <span className="flex-1 text-right">{surgeryMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── لوحة التحكم اليسرى ── */}
            <div className="space-y-4">
              {/* اختيار الوكيل */}
              <div className="p-4 rounded border border-border/50 bg-card space-y-3">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 text-right">
                  <Cpu size={10} /> اختر الوكيل للفحص والتعديل
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => { if (surgeryAgentId) { loadSurgeryAgent(surgeryAgentId); loadSurgeryPatches(); } }}
                    disabled={!surgeryAgentId || surgeryLoadingAgent}
                    className="shrink-0 h-9 px-3 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs gap-1">
                    {surgeryLoadingAgent ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                    تحميل
                  </Button>
                  <select
                    value={surgeryAgentId}
                    onChange={e => { setSurgeryAgentId(e.target.value); setSurgeryAgentData(null); setSurgeryDiagnosis(null); }}
                    className="flex-1 bg-input border border-border/50 rounded px-3 py-2 text-sm text-right"
                    dir="rtl">
                    <option value="">اختر وكيلاً…</option>
                    {agents?.map(a => <option key={a.id} value={a.id}>{a.nameAr || a.name}</option>)}
                  </select>
                </div>

                {/* بيانات الوكيل */}
                {surgeryLoadingAgent && <Skeleton className="h-28 bg-secondary" />}
                {surgeryAgentData && !surgeryLoadingAgent && (
                  <div className="space-y-2 text-xs font-mono border border-border/30 rounded p-3 bg-secondary/20">
                    <div className="flex justify-between text-right">
                      <span className={surgeryAgentData.agent.status === "online" ? "text-emerald-400" : surgeryAgentData.agent.status === "busy" ? "text-amber-400" : "text-red-400"}>
                        {surgeryAgentData.agent.status}
                      </span>
                      <span className="text-muted-foreground">الحالة</span>
                    </div>
                    <div className="flex justify-between"><span className="text-primary">{surgeryAgentData.agent.model}</span><span className="text-muted-foreground">النموذج</span></div>
                    <div className="flex justify-between"><span className="text-amber-400">{surgeryAgentData.agent.success_rate}%</span><span className="text-muted-foreground">معدل النجاح</span></div>
                    <div className="flex justify-between"><span>{surgeryAgentData.agent.avg_response_ms}ms</span><span className="text-muted-foreground">متوسط الاستجابة</span></div>
                    <div className="flex justify-between"><span>{surgeryAgentData.recent_patches?.length ?? 0} تعديل</span><span className="text-muted-foreground">التعديلات السابقة</span></div>
                    <div className="pt-1 border-t border-border/20 text-right text-muted-foreground line-clamp-2">
                      {(surgeryAgentData.agent.prompt || "").substring(0, 120)}{(surgeryAgentData.agent.prompt || "").length > 120 ? "…" : ""}
                    </div>
                  </div>
                )}
              </div>

              {/* التشخيص الذكي */}
              <div className="p-4 rounded border border-primary/20 bg-card space-y-3">
                <div className="text-[10px] font-mono text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <FlaskConical size={10} /> التشخيص الذكي بواسطة بيليه
                </div>
                <Textarea
                  value={surgeryIssue}
                  onChange={e => setSurgeryIssue(e.target.value)}
                  placeholder="اشرح المشكلة (اختياري) — مثال: الوكيل يُعطي ردوداً بالإنجليزية بدلاً من العربية، أو معدل نجاحه منخفض…"
                  dir="rtl"
                  rows={3}
                  className="text-right text-xs resize-none"
                />
                <Button
                  onClick={handleDiagnose}
                  disabled={!surgeryAgentId || surgeryDiagnosing}
                  className="w-full gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs h-9">
                  {surgeryDiagnosing ? <><RefreshCw size={12} className="animate-spin" /> بيليه تشخّص الوكيل…</> : <><BrainCircuit size={12} /> تشغيل التشخيص الذكي</>}
                </Button>
              </div>

              {/* التعديل اليدوي */}
              <div className="p-4 rounded border border-amber-500/20 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setShowManualPatch(v => !v)} className="text-[10px] text-amber-400 font-mono hover:underline flex items-center gap-1">
                    {showManualPatch ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {showManualPatch ? "إخفاء" : "عرض"}
                  </button>
                  <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Wrench size={10} /> تعديل يدوي مباشر
                  </div>
                </div>
                {showManualPatch && (
                  <div className="space-y-2">
                    <select value={manualPatch.field} onChange={e => setManualPatch(p => ({ ...p, field: e.target.value }))}
                      className="w-full bg-input border border-border/50 rounded px-3 py-2 text-sm text-right" dir="rtl">
                      {["prompt","status","model","description","descriptionAr","capabilities","subagents"].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <Textarea value={manualPatch.new_value} onChange={e => setManualPatch(p => ({ ...p, new_value: e.target.value }))}
                      placeholder="القيمة الجديدة…" dir="rtl" rows={3} className="text-right text-xs resize-none" />
                    <Input value={manualPatch.reason} onChange={e => setManualPatch(p => ({ ...p, reason: e.target.value }))}
                      placeholder="سبب التعديل…" dir="rtl" className="text-right text-xs" />
                    <Button
                      onClick={() => handleApplyPatch(manualPatch.field, manualPatch.new_value, manualPatch.reason, "update")}
                      disabled={!surgeryAgentId || !manualPatch.new_value || !manualPatch.reason || applyingPatch !== null}
                      className="w-full gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs h-8">
                      {applyingPatch ? <RefreshCw size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                      تطبيق التعديل
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ── لوحة التشخيص اليمنى ── */}
            <div className="space-y-4">
              {/* نتيجة التشخيص */}
              {surgeryDiagnosing && (
                <div className="p-6 rounded border border-primary/20 bg-card flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={24} className="text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground font-mono">بيليه تحلّل الوكيل…</p>
                  <p className="text-xs text-muted-foreground/60">يُرجى الانتظار — قد يستغرق هذا 10-30 ثانية</p>
                </div>
              )}
              {surgeryDiagnosis && !surgeryDiagnosing && (
                <div className="space-y-3">
                  {/* ملخص التشخيص */}
                  <div className={`p-4 rounded border ${SEV_COLOR[surgeryDiagnosis.severity] ?? SEV_COLOR.info}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge className={`text-[10px] font-mono shrink-0 ${SEV_COLOR[surgeryDiagnosis.severity]}`}>
                        {SEV_AR[surgeryDiagnosis.severity] || surgeryDiagnosis.severity}
                      </Badge>
                      <div className="text-right">
                        <div className="font-bold text-sm">{surgeryDiagnosis.diagnosis}</div>
                        <div className="text-xs opacity-70 mt-0.5">{surgeryDiagnosis.root_cause}</div>
                      </div>
                    </div>
                    <div className="text-xs border-t border-current/20 pt-2 mt-2 opacity-80 text-right">
                      {surgeryDiagnosis.summary}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono opacity-50 justify-end">
                      <span>{surgeryDiagnosis.model_used}</span>
                      <span>·</span>
                      <span>{surgeryDiagnosis.tokens_used} رمز</span>
                    </div>
                  </div>

                  {/* التعديلات المقترحة */}
                  {surgeryDiagnosis.patches?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <GitCompare size={10} /> التعديلات المقترحة ({surgeryDiagnosis.patches.length})
                      </div>
                      {surgeryDiagnosis.patches.map((patch: any, i: number) => (
                        <div key={i} className="p-3 rounded border border-border/50 bg-secondary/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge className={`text-[10px] font-mono ${patch.priority === "high" ? "bg-red-400/10 text-red-400 border-red-400/30" : patch.priority === "medium" ? "bg-amber-400/10 text-amber-400 border-amber-400/30" : "bg-sky-400/10 text-sky-400 border-sky-400/30"}`}>
                              {patch.priority === "high" ? "أولوية عالية" : patch.priority === "medium" ? "متوسطة" : "منخفضة"}
                            </Badge>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-muted-foreground">{patch.patch_type}</span>
                              <span className="text-xs font-mono font-bold text-primary">{patch.field}</span>
                            </div>
                          </div>
                          <div className="text-xs text-right text-muted-foreground">{patch.reason}</div>
                          {patch.current_value && patch.proposed_value && (
                            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                              <div className="p-1.5 rounded bg-red-400/5 border border-red-400/20 text-right">
                                <div className="text-red-400/60 mb-0.5">الحالي</div>
                                <div className="text-red-400 line-clamp-2">{String(patch.current_value).substring(0, 80)}</div>
                              </div>
                              <div className="p-1.5 rounded bg-emerald-400/5 border border-emerald-400/20 text-right">
                                <div className="text-emerald-400/60 mb-0.5">المقترح</div>
                                <div className="text-emerald-400 line-clamp-2">{String(patch.proposed_value).substring(0, 80)}</div>
                              </div>
                            </div>
                          )}
                          <Button
                            onClick={() => handleApplyPatch(patch.field, patch.proposed_value, patch.reason, patch.patch_type || "fix")}
                            disabled={applyingPatch !== null}
                            className="w-full h-7 gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs">
                            {applyingPatch === patch.field ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            تطبيق هذا التعديل
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {surgeryDiagnosis.patches?.length === 0 && (
                    <div className="p-4 rounded border border-emerald-500/20 bg-emerald-500/5 text-center text-sm text-emerald-400">
                      <CheckCircle2 size={20} className="mx-auto mb-2" />
                      الوكيل يعمل بشكل مثالي — لا توجد تعديلات مقترحة
                    </div>
                  )}
                </div>
              )}
              {!surgeryDiagnosis && !surgeryDiagnosing && (
                <div className="p-8 rounded border border-dashed border-border/40 text-center space-y-2">
                  <FlaskConical size={28} className="mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">اختر وكيلاً ثم اضغط "تشغيل التشخيص الذكي"</p>
                  <p className="text-xs text-muted-foreground/60">ستقوم بيليه بتحليل الوكيل واقتراح تعديلات دقيقة لإصلاح المشاكل</p>
                </div>
              )}

              {/* سجل التعديلات */}
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={10} /> سجل التعديلات {surgeryPatches.length > 0 && `(${surgeryPatches.length})`}
                </div>
                {surgeryPatchesLoading ? <Skeleton className="h-16 bg-secondary" /> :
                  !surgeryPatches.length ? (
                    <div className="text-center text-xs text-muted-foreground py-4">لا توجد تعديلات مسجّلة</div>
                  ) : surgeryPatches.slice(0, 8).map(p => (
                    <div key={p.id} className={`p-3 rounded border text-xs ${p.status === "rolled_back" ? "opacity-50 border-border/20 bg-secondary/10" : "border-border/40 bg-card"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.status !== "rolled_back" && (
                            <Button onClick={() => handleRollback(p.id)} disabled={rollbackingPatch === p.id}
                              className="h-6 px-2 gap-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 text-[10px]">
                              {rollbackingPatch === p.id ? <RefreshCw size={9} className="animate-spin" /> : <RotateCcw size={9} />}
                              تراجع
                            </Button>
                          )}
                          {p.status === "rolled_back" && (
                            <Badge className="text-[9px] bg-orange-400/10 text-orange-400 border-orange-400/30">مُتراجَع</Badge>
                          )}
                        </div>
                        <div className="text-right flex-1">
                          <div className="flex items-center gap-1.5 justify-end mb-0.5">
                            <span className="text-[10px] font-mono text-muted-foreground">{new Date(p.created_at).toLocaleString("ar-SA", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}</span>
                            <Badge className="text-[9px] bg-primary/10 text-primary border-primary/30 font-mono">{p.patch_type}</Badge>
                            <span className="font-mono font-bold text-primary">{p.field}</span>
                          </div>
                          <div className="text-muted-foreground line-clamp-1">{p.reason}</div>
                          <div className="font-mono text-[10px] text-emerald-400/70 mt-0.5 line-clamp-1">→ {String(p.new_value).substring(0, 60)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
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
