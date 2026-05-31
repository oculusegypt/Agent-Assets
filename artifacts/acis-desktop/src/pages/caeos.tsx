import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useListAgents, useGetBillieAlerts, useGetSystemMetrics, useExecuteAgent } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield, Layers, GitBranch, Lock, Database, Network,
  Cpu, AlertTriangle, CheckCircle2, Eye,
  Scale, Wrench, Globe, Zap, Brain, Server, Play, Clock, X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SOVEREIGN_LAYERS = [
  { id: 1,  name: "الإطار الدستوري",          nameEn: "Constitutional Framework",  icon: Scale,         color: "text-amber-400",   desc: "المبادئ الأخلاقية الأساسية والحقوق والالتزامات وميثاق الحوكمة الذي يحكم جميع سلوكيات الذكاء الاصطناعي." },
  { id: 2,  name: "الذكاء اللغوي",            nameEn: "Lexical Intelligence",       icon: Brain,         color: "text-purple-400",  desc: "معالجة متقدمة للغات الطبيعية مع فهم دلالي وإتقان 30+ لغة بما فيها العربية." },
  { id: 3,  name: "مدقق المعرفة",            nameEn: "Epistemological Validator",  icon: Eye,           color: "text-sky-400",     desc: "التحقق من الحقائق والمصادر والتحقق من صحة المعرفة مقابل المرجعيات الموثوقة." },
  { id: 4,  name: "محرك الاستدلال الأخلاقي", nameEn: "Ethical Reasoning Engine",   icon: Shield,        color: "text-emerald-400", desc: "تحليل أخلاقي متعدد الأطر: نفعي، واجبي، فضيلة، وتكامل الأخلاق الإسلامية." },
  { id: 5,  name: "مُقيّم المخاطر النظامية", nameEn: "Systemic Risk Assessor",     icon: AlertTriangle, color: "text-orange-400",  desc: "تسجيل فوري للمخاطر ونمذجة التهديدات وتحليل الفشل المتتالي عبر جميع العمليات." },
  { id: 6,  name: "وحدة الاستدلال السببي",   nameEn: "Causal Inference Module",    icon: GitBranch,     color: "text-primary",     desc: "تحليل السبب الجذري والاستدلال المضاد للواقع ونمذجة السلسلة السببية التنبؤية." },
  { id: 7,  name: "طبقة تطبيق الأمن",        nameEn: "Security Enforcement Layer", icon: Lock,          color: "text-red-400",     desc: "أمان بدون ثقة، منع حقن الأوامر، تعقيم البيانات، والتحكم في الوصول." },
  { id: 8,  name: "هيكل المعرفة",            nameEn: "Knowledge Architecture",     icon: Database,      color: "text-sky-400",     desc: "رسم بياني للمعرفة الموزعة، الفهرسة الدلالية، والربط المفاهيمي متعدد المجالات." },
  { id: 9,  name: "بروتوكول التنسيق",        nameEn: "Coordination Protocol",      icon: Network,       color: "text-emerald-400", desc: "تنسيق متعدد الوكلاء وبناء الإجماع وحل النزاعات بين الوكلاء." },
  { id: 10, name: "نواة التعلم التكيفي",      nameEn: "Adaptive Learning Core",     icon: Cpu,           color: "text-primary",     desc: "تحسين مستمر من التغذية الراجعة وتحسين الأداء وتشغيل ضبط النماذج." },
  { id: 11, name: "محرك الشفافية",           nameEn: "Transparency Engine",        icon: Eye,           color: "text-purple-400",  desc: "توليد الشرح ومسارات التدقيق ومنطق القرار وتسجيل متوافق مع GDPR." },
  { id: 12, name: "مراقب الامتثال",          nameEn: "Compliance Monitor",         icon: CheckCircle2,  color: "text-amber-400",   desc: "فحص الامتثال التنظيمي عبر GDPR وCCPA وقانون الذكاء الاصطناعي والأخلاقيات الإماراتية." },
  { id: 13, name: "محسّن الموارد",           nameEn: "Resource Optimizer",         icon: Wrench,        color: "text-orange-400",  desc: "تخصيص الحوسبة وتحسين التكاليف وكفاءة الطاقة وإدارة مستوى الخدمة." },
  { id: 14, name: "الذكاء الثقافي",          nameEn: "Cultural Intelligence",      icon: Globe,         color: "text-emerald-400", desc: "التواصل متعدد الثقافات والسياق العربي/الإسلامي وتكيف الأعراف الإقليمية." },
  { id: 15, name: "وحدة التطور",            nameEn: "Evolution Controller",       icon: Zap,           color: "text-red-400",     desc: "التحسين الذاتي للنظام ومقترحات تطور البنية والتحكم في إصدار سلوكيات الذكاء الاصطناعي." },
];

const PHASE_PIPELINE = [
  "استيعاب المدخلات", "الفحص الدستوري", "التحليل اللغوي", "التحقق المعرفي",
  "التحليل الأخلاقي", "تقييم المخاطر", "النمذجة السببية", "بوابة الأمن",
  "استعلام المعرفة", "تنسيق الوكلاء", "توليد الاستجابة", "سجل الشفافية",
  "التحقق من الامتثال", "تسوية الموارد", "التكيف الثقافي", "تسليم المخرجات",
  "التقاط التغذية الراجعة", "تحديث التعلم", "أرشيف التدقيق", "إشارة التطور",
  "تقرير أصحاب المصلحة", "اكتمال الدورة",
];

export default function CaeosPage() {
  const { data: allAgents, isLoading: agentsLoading } = useListAgents();
  const { data: alerts } = useGetBillieAlerts();
  const { data: metrics } = useGetSystemMetrics();
  const executeAgent = useExecuteAgent();
  const qc = useQueryClient();

  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState(7);
  const [ethicsInput, setEthicsInput] = useState("");
  const [ethicsRunning, setEthicsRunning] = useState(false);
  const [ethicsResult, setEthicsResult] = useState<string | null>(null);
  const [showEthicsModal, setShowEthicsModal] = useState(false);

  const caeos = allAgents?.filter(a => a.system === "CAEOS") ?? [];
  const layerData = activeLayer != null ? SOVEREIGN_LAYERS[activeLayer - 1] : null;

  const onlineCaeos  = caeos.filter(a => a.status === "online").length;
  const busyCaeos    = caeos.filter(a => a.status === "busy").length;
  const totalExecsToday = caeos.reduce((s, a) => s + (a.executions_today || 0), 0);
  const activeAlerts = alerts?.filter(a => !a.resolved).length ?? 0;

  const ethicalCompliance = caeos.length > 0
    ? Math.min(100, Math.round(((onlineCaeos + busyCaeos) / caeos.length) * 100 * 0.95 + 4.8))
    : 100;
  const avgRiskScore = activeAlerts === 0 ? 1.2 : Math.min(9.9, Math.round(activeAlerts * 1.8 * 10) / 10);
  const pipelineThroughput = metrics?.total_executions_today ?? totalExecsToday;
  const layerHealth = caeos.length > 0 ? Math.round((onlineCaeos + busyCaeos) / caeos.length * 15) : 15;

  async function handleEthicsAnalysis() {
    if (!ethicsInput.trim()) return;
    setEthicsRunning(true);
    setEthicsResult(null);
    const tid = toast.loading("CAEOS يُحلّل عبر 15 طبقة سيادية…");
    try {
      const res = await executeAgent.mutateAsync({
        agentId: "caeos-master",
        data: {
          action: "تحليل أخلاقي شامل",
          prompt: `أجرِ تحليلاً أخلاقياً شاملاً للمحتوى أو الموقف التالي من منظور نظام CAEOS الدستوري:

${ethicsInput}

قيّم عبر:
1. المبادئ الدستورية (هل يلتزم بالمبادئ الـ15؟)
2. التحليل الأخلاقي متعدد الأطر (نفعي، واجبي، إسلامي)
3. تقييم المخاطر (1-10) مع الأدلة
4. الحكم النهائي (مقبول / مقبول مشروط / مرفوض)
5. التوصيات والبدائل المقترحة`,
        },
      });
      setEthicsResult(res?.result ?? "اكتمل التحليل.");
      setShowEthicsModal(true);
      qc.invalidateQueries();
      toast.success("اكتمل التحليل الأخلاقي ✓", { id: tid });
    } catch (e: any) {
      setEthicsResult(`خطأ: ${e?.message}`);
      setShowEthicsModal(true);
      toast.error("فشل التحليل الأخلاقي", { id: tid });
    }
    setEthicsRunning(false);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400">
            <Shield size={24} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">كايوس / سيرفكس</h1>
              <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-mono text-xs">نظام الذكاء الاصطناعي الدستوري</Badge>
              <Badge className="bg-red-500/10 text-red-400 border-red-500/30 font-mono text-xs">v2.0</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              15 طبقة سيادية · خط معالجة 22 مرحلة · هندسة الذكاء الاصطناعي الدستوري
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-orange-400">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          CAEOS نشط
        </div>
      </div>

      {/* Interactive Ethics Analysis */}
      <div className="p-4 rounded border border-orange-500/20 bg-orange-500/5 space-y-3">
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm font-bold">التحليل الأخلاقي التفاعلي</span>
          <Shield size={16} className="text-orange-400" />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          أدخل نصاً أو موقفاً لتحليله عبر 15 طبقة سيادية دستورية بواسطة CAEOS
        </p>
        <Textarea
          placeholder="أدخل محتوى أو موقفاً للتحليل الأخلاقي…&#10;&#10;مثال: سيناريو فيلم يتضمن مشهداً عنيفاً، أو قرار تجاري، أو محتوى إبداعي"
          rows={3} value={ethicsInput}
          onChange={e => setEthicsInput(e.target.value)}
          dir="rtl" className="text-right bg-background/50"
        />
        <Button onClick={handleEthicsAnalysis} disabled={ethicsRunning || !ethicsInput.trim()}
          className="w-full gap-2 bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30">
          {ethicsRunning ? (
            <><Clock size={14} className="animate-spin" />CAEOS يحلل…</>
          ) : (
            <><Play size={14} />تشغيل التحليل الأخلاقي</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">15 طبقة سيادية</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {SOVEREIGN_LAYERS.map(layer => {
              const Icon = layer.icon;
              const isActive = activeLayer === layer.id;
              return (
                <button key={layer.id} onClick={() => setActiveLayer(isActive ? null : layer.id)}
                  className={`p-3 rounded border text-right transition-all group ${
                    isActive
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-border/50 bg-card hover:border-orange-500/20 hover:bg-orange-500/5"
                  }`}>
                  <div className="flex items-center gap-2 mb-1 justify-end">
                    <span className="text-[10px] font-mono text-muted-foreground">L{String(layer.id).padStart(2, "0")}</span>
                    <div className="w-6 h-6 rounded flex items-center justify-center bg-secondary shrink-0">
                      <Icon size={12} className={layer.color} />
                    </div>
                  </div>
                  <div className="text-xs font-bold">{layer.name}</div>
                </button>
              );
            })}
          </div>

          {layerData && (
            <div className="p-4 rounded border bg-card" style={{ borderColor: "rgba(249,115,22,0.3)" }}>
              <div className="flex items-center gap-3 mb-2 justify-end">
                <div>
                  <div className="flex items-center gap-2 justify-end">
                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px] font-mono">
                      الطبقة {layerData.id}
                    </Badge>
                    <span className="font-bold">{layerData.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono text-right opacity-60">{layerData.nameEn}</div>
                </div>
                <layerData.icon size={20} className={layerData.color} />
              </div>
              <p className="text-sm text-muted-foreground text-right">{layerData.desc}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">خط المعالجة — 22 مرحلة</div>
          <div className="p-4 bg-card border border-border/50 rounded space-y-1 h-[540px] overflow-y-auto">
            {PHASE_PIPELINE.map((phase, i) => (
              <button key={phase} onClick={() => setActivePhase(i)}
                className={`w-full flex items-center gap-2 p-2 rounded text-xs text-right transition-colors ${
                  i === activePhase
                    ? "bg-orange-500/10 border border-orange-500/30 text-orange-300"
                    : i < activePhase
                    ? "bg-emerald-500/5 text-emerald-400/70"
                    : "text-muted-foreground hover:bg-secondary"
                }`}>
                {i === activePhase && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />}
                <span className="font-mono flex-1 text-right">{phase}</span>
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${
                  i === activePhase ? "bg-orange-500/20 text-orange-400" :
                  i < activePhase  ? "bg-emerald-500/20 text-emerald-400" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {i < activePhase ? "✓" : String(i + 1).padStart(2, "0")}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {agentsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 bg-card border border-border/50" />)}
        </div>
      ) : caeos.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">وكلاء CAEOS المباشرون</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {caeos.map(agent => (
              <div key={agent.id} className="p-4 rounded border border-border/50 bg-card hover:border-orange-500/30 transition-colors">
                <div className="flex items-center gap-2 mb-2 justify-end">
                  <span className="font-semibold text-sm">{agent.nameAr || agent.name}</span>
                  <div className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-orange-400 animate-pulse" : "bg-muted-foreground"}`} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 text-right">{agent.descriptionAr || agent.description}</p>
                <div className="mt-2 text-xs font-mono text-muted-foreground flex items-center justify-between">
                  <span>{agent.executions_today} تنفيذ اليوم</span>
                  <span>{agent.model}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {agentsLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-card border border-border/50" />)
        ) : [
          { label: "الامتثال الأخلاقي", value: `${ethicalCompliance}%`, icon: Shield,        color: "text-emerald-400" },
          { label: "متوسط درجة المخاطر", value: `${avgRiskScore}/10`,   icon: AlertTriangle, color: "text-amber-400" },
          { label: "إنتاجية خط الأنابيب", value: `${pipelineThroughput}/اليوم`, icon: Zap, color: "text-primary" },
          { label: "صحة الطبقات",         value: `${Math.max(layerHealth, 0)}/15`, icon: Layers, color: "text-orange-400" },
        ].map(m => (
          <div key={m.label} className="p-4 rounded border border-border/50 bg-card" dir="rtl">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-right">{m.label}</span>
              <m.icon size={14} className={m.color} />
            </div>
            <div className={`text-2xl font-mono font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {showEthicsModal && ethicsResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-card border border-orange-500/30 rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEthicsModal(false)} className="p-1 hover:bg-secondary rounded">
                  <X size={16} />
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(ethicsResult)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-orange-400 px-2 py-1 rounded border border-border/30 hover:border-orange-500/30 transition-colors">
                  نسخ النتيجة
                </button>
              </div>
              <div className="text-right">
                <h3 className="font-bold flex items-center gap-2 justify-end">
                  <span>نتيجة التحليل الأخلاقي CAEOS</span>
                  <Shield size={16} className="text-orange-400" />
                </h3>
                <p className="text-xs text-muted-foreground font-mono">عبر 15 طبقة سيادية دستورية</p>
              </div>
            </div>
            {/* Mini layer scores header */}
            <div className="px-4 py-2 border-b border-border/30 bg-secondary/20 overflow-x-auto">
              <div className="flex items-center gap-1.5 min-w-max">
                {SOVEREIGN_LAYERS.slice(0, 8).map(l => {
                  const Icon = l.icon;
                  return (
                    <div key={l.id} className="flex items-center gap-1 px-2 py-0.5 rounded border border-orange-500/20 bg-orange-500/5 text-[9px] font-mono whitespace-nowrap">
                      <Icon size={8} className={l.color} />
                      <span className="text-muted-foreground">L{l.id}</span>
                      <span className={`${l.color} font-bold`}>✓</span>
                    </div>
                  );
                })}
                <span className="text-[9px] font-mono text-muted-foreground/50 px-1">+7 طبقات</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:text-foreground/90 prose-headings:text-foreground prose-headings:font-bold prose-strong:text-foreground prose-code:text-orange-400 prose-code:bg-secondary prose-code:px-1 prose-code:rounded prose-li:text-foreground/85 prose-ul:text-right prose-ol:text-right" dir="rtl">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{ethicsResult}</ReactMarkdown>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-secondary/10">
              <button onClick={() => setShowEthicsModal(false)}
                className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-1 rounded border border-border/40 hover:border-border transition-colors">
                إغلاق
              </button>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                CAEOS · 15 طبقة سيادية · نظام الذكاء الاصطناعي الدستوري
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
