import { useState, useEffect, useCallback } from "react";
import { useListAgents } from "@workspace/api-client-react";
import { useUI } from "@/contexts/ui-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Settings2, BrainCircuit, Bot, Cpu, Film, Database,
  Monitor, Save, RefreshCw, Trash2, CheckCircle2,
  AlertTriangle, Zap, Eye, EyeOff, TestTube2, Info,
  RotateCcw, Shield, Activity, MessageSquare, Building2,
  ChevronDown, ChevronUp, Loader2, Circle, X, Key,
  BarChart3, Sparkles, Code2, Languages, Lightbulb, Volume2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Setting = { key: string; value: string; category: string; description?: string; updated_at?: string };
type DbTable = { name: string; nameAr: string; count: number; icon: string };

const TABS = [
  { id: "api-keys",     label: "مفاتيح API",         icon: Key,          color: "text-yellow-400" },
  { id: "models",       label: "النماذج",             icon: BarChart3,    color: "text-emerald-400" },
  { id: "ai",           label: "الذكاء الاصطناعي", icon: BrainCircuit, color: "text-primary" },
  { id: "agents",       label: "الوكلاء",           icon: Bot,          color: "text-purple-400" },
  { id: "system",       label: "النظام",             icon: Cpu,          color: "text-amber-400" },
  { id: "production",   label: "الإنتاج",            icon: Film,         color: "text-pink-400" },
  { id: "nexus",        label: "نيكسوس",             icon: Building2,    color: "text-emerald-400" },
  { id: "conversations",label: "المحادثات",          icon: MessageSquare,color: "text-sky-400" },
  { id: "ui",           label: "الواجهة",            icon: Monitor,      color: "text-orange-400" },
  { id: "database",     label: "قاعدة البيانات",     icon: Database,     color: "text-red-400" },
];

const CLEARABLE_TABLES = [
  { name: "activity",          label: "سجل النشاط",      danger: false },
  { name: "agent_executions",  label: "تنفيذات الوكلاء", danger: false },
  { name: "system_alerts",     label: "التنبيهات",        danger: false },
  { name: "complaints",        label: "الشكاوى",          danger: true  },
  { name: "nexus_tasks",       label: "مهام NEXUS",       danger: false },
];

export default function SettingsPage() {
  const { theme, sidebarCompact, setTheme, setSidebarCompact } = useUI();
  const [tab, setTab] = useState("ai");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [changed, setChanged] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dbStats, setDbStats] = useState<{ tables: DbTable[]; total_records: number } | null>(null);
  const [aiTest, setAiTest] = useState<Record<string, any>>({});
  const [aiTesting, setAiTesting] = useState<string | null>(null);
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [agentEdits, setAgentEdits] = useState<Record<string, any>>({});
  const [agentSaving, setAgentSaving] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  type KeyStatus = { configured: boolean; source: "env" | "db" | null };
  const [keyStatus, setKeyStatus] = useState<{ gemini: KeyStatus; alibaba: KeyStatus } | null>(null);
  const [keyInputs, setKeyInputs] = useState<{ gemini: string; alibaba: string; alibaba_base: string }>({ gemini: "", alibaba: "", alibaba_base: "" });
  const [showKey, setShowKey] = useState<{ gemini: boolean; alibaba: boolean }>({ gemini: false, alibaba: false });
  const [keySaving, setKeySaving] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  type ModelStat = {
    id: string; provider: "qwen" | "gemini"; nameAr: string; category: string;
    quota: number; used: number; remaining: number; pctUsed: number;
    calls: number; tasks: string[]; agents: string[]; isPrimary: boolean;
  };
  const [modelStats, setModelStats] = useState<ModelStat[]>([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [seedingDashScope, setSeedingDashScope] = useState(false);

  const { data: agents, refetch: refetchAgents } = useListAgents();
  const qc = useQueryClient();

  const load = useCallback(async () => {
    const r = await fetch(`${BASE}/api/settings`);
    const d = await r.json();
    setSettings(d.settings || []);
  }, []);

  const loadDb = useCallback(async () => {
    const r = await fetch(`${BASE}/api/settings/db-stats`);
    const d = await r.json();
    setDbStats(d);
  }, []);

  const loadKeyStatus = useCallback(async () => {
    const r = await fetch(`${BASE}/api/settings/api-keys`);
    const d = await r.json();
    setKeyStatus(d);
  }, []);

  const loadModels = useCallback(async () => {
    setModelLoading(true);
    try {
      const r = await fetch(`${BASE}/api/settings/ai-models`);
      const d = await r.json();
      setModelStats(d.models || []);
    } finally {
      setModelLoading(false);
    }
  }, []);

  const seedDashScope = async () => {
    setSeedingDashScope(true);
    try {
      await fetch(`${BASE}/api/settings/ai-models/seed-quotas`, { method: "POST" });
      await loadModels();
    } finally {
      setSeedingDashScope(false);
    }
  };

  const saveApiKeys = async () => {
    setKeySaving(true);
    setKeyMsg(null);
    try {
      const body: Record<string, string> = {};
      if (keyInputs.gemini.trim()) body.gemini = keyInputs.gemini.trim();
      if (keyInputs.alibaba.trim()) body.alibaba = keyInputs.alibaba.trim();
      if (keyInputs.alibaba_base.trim()) body.alibaba_base = keyInputs.alibaba_base.trim();
      if (Object.keys(body).length === 0) {
        setKeyMsg({ type: "err", text: "أدخل مفتاحاً أو رابط endpoint واحداً على الأقل" });
        setKeySaving(false);
        return;
      }
      const r = await fetch(`${BASE}/api/settings/api-keys`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) {
        await loadKeyStatus();
        setKeyInputs({ gemini: "", alibaba: "", alibaba_base: "" });
        setKeyMsg({ type: "ok", text: "تم حفظ المفاتيح بنجاح في قاعدة البيانات" });
        setTimeout(() => setKeyMsg(null), 3500);
      } else {
        setKeyMsg({ type: "err", text: "فشل الحفظ — حاول مجدداً" });
      }
    } catch {
      setKeyMsg({ type: "err", text: "خطأ في الاتصال بالسيرفر" });
    }
    setKeySaving(false);
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "database") loadDb(); }, [tab, loadDb]);
  useEffect(() => { if (tab === "api-keys") loadKeyStatus(); }, [tab, loadKeyStatus]);
  useEffect(() => { if (tab === "models") loadModels(); }, [tab, loadModels]);

  const getSetting = (key: string) =>
    changed[key] !== undefined ? changed[key] : (settings.find(s => s.key === key)?.value ?? "");

  const setSetting = (key: string, value: string) =>
    setChanged(prev => ({ ...prev, [key]: value }));

  const setToggle = (key: string, val: boolean) => setSetting(key, val ? "true" : "false");
  const getToggle = (key: string) => getSetting(key) === "true";

  const save = async () => {
    if (Object.keys(changed).length === 0) return;
    setSaving(true);
    await fetch(`${BASE}/api/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changed) });
    await load();
    setChanged({});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const reset = async () => {
    await fetch(`${BASE}/api/settings/reset`, { method: "POST" });
    setChanged({});
    await load();
    setResetConfirm(false);
  };

  const testAi = async (provider: string) => {
    setAiTesting(provider);
    const r = await fetch(`${BASE}/api/settings/test-ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
    const d = await r.json();
    setAiTest(prev => ({ ...prev, [provider]: d }));
    setAiTesting(null);
  };

  const clearTable = async (table: string) => {
    setClearing(table);
    await fetch(`${BASE}/api/settings/db-clear/${table}`, { method: "DELETE" });
    await loadDb();
    setClearMsg(`تم مسح جدول "${table}" بنجاح`);
    setTimeout(() => setClearMsg(null), 3000);
    setClearing(null);
    qc.invalidateQueries();
  };

  const saveAgent = async (agentId: string) => {
    setAgentSaving(agentId);
    await fetch(`${BASE}/api/settings/agent/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentEdits[agentId] || {}),
    });
    await refetchAgents();
    setAgentSaving(null);
    setAgentEdits(prev => { const n = { ...prev }; delete n[agentId]; return n; });
  };

  const pendingCount = Object.keys(changed).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 size={24} className="text-primary" />
            الإعدادات الشاملة
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-mono">
            تحكم كامل في كل جزء من النظام
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded">
              {pendingCount} تغيير غير محفوظ
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setResetConfirm(true)} className="gap-1.5 text-muted-foreground">
            <RotateCcw size={14} /> إعادة ضبط
          </Button>
          <Button size="sm" onClick={save} disabled={saving || pendingCount === 0} className="gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? "تم الحفظ" : "حفظ التغييرات"}
          </Button>
        </div>
      </div>

      {/* Reset confirm */}
      {resetConfirm && (
        <div className="p-4 rounded border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4">
          <span className="text-sm text-amber-400">⚠️ سيتم إعادة جميع الإعدادات للقيم الافتراضية. هل أنت متأكد؟</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setResetConfirm(false)}>إلغاء</Button>
            <Button size="sm" onClick={reset} className="bg-amber-500 hover:bg-amber-600 text-black">تأكيد الإعادة</Button>
          </div>
        </div>
      )}

      {clearMsg && (
        <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={14} /> {clearMsg}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/50 pb-3">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all border ${
              tab === t.id
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}>
            <t.icon size={13} className={tab === t.id ? "text-primary" : t.color} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── API Keys Tab ── */}
      {tab === "api-keys" && (
        <div className="space-y-5">
          {/* Smart Routing Info — Qwen First */}
          <div className="p-4 rounded border border-orange-500/20 bg-orange-500/5 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-orange-400">
                <Zap size={15} /> استراتيجية النماذج — Qwen أساسي · Gemini للصوت فقط
              </div>
              <span className="text-[10px] font-mono bg-orange-500/10 border border-orange-500/20 text-orange-300 px-2 py-0.5 rounded">Qwen-First Strategy v2</span>
            </div>
            <div className="text-muted-foreground text-xs space-y-1.5">
              <p>• <span className="text-orange-300 font-medium">النص المعقد + الإبداعي</span> (بيليه، القصة، الإخراج، التنسيق): <span className="font-mono text-orange-400">qwen3-max-2026-01-23</span></p>
              <p>• <span className="text-orange-300 font-medium">البرمجة وهندسة البرومبت</span>: <span className="font-mono text-orange-400">qwen3-coder-480b-a35b-instruct</span></p>
              <p>• <span className="text-orange-300 font-medium">التدقيق والاستدلال العميق</span> (مدقق الصدق، الناقد، CAEOS): <span className="font-mono text-orange-400">qwq-plus</span></p>
              <p>• <span className="text-orange-300 font-medium">الرؤية البصرية</span> (اللوحة المصورة): <span className="font-mono text-orange-400">qwen3-vl-235b-a22b-instruct</span></p>
              <p>• <span className="text-orange-300 font-medium">الترجمة</span>: <span className="font-mono text-orange-400">qwen-mt-plus</span> · <span className="text-muted-foreground font-medium">الصوت العربي حصرياً →</span> <span className="font-mono text-primary">gemini-2.5-flash-preview-tts</span></p>
              <p className="text-primary/70">↳ Gemini كاحتياط أخير عند فشل Qwen — يُحافظ على رصيد Gemini</p>
            </div>
          </div>

          {/* Key Status */}
          <SectionCard icon={<Shield size={16} className="text-yellow-400" />} title="حالة المفاتيح الحالية">
            {!keyStatus ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> جاري الفحص...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { id: "gemini", label: "Gemini (Google)", envVar: "GEMINI_API_KEY", color: "text-primary", bg: "bg-primary/5 border-primary/20", models: "gemini-2.5-pro · gemini-2.5-flash" },
                  { id: "alibaba", label: "Qwen (Alibaba)", envVar: "ALIBABA_API_KEY", color: "text-orange-400", bg: "bg-orange-500/5 border-orange-500/20", models: "qwen-max · qwen-plus · qwen-turbo" },
                ] as const).map(p => {
                  const st = keyStatus[p.id];
                  return (
                    <div key={p.id} className={`p-4 rounded border ${st.configured ? p.bg : "bg-red-500/5 border-red-500/20"} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold text-sm ${st.configured ? p.color : "text-red-400"}`}>{p.label}</span>
                        {st.configured ? (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            st.source === "env"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-sky-500/10 border-sky-500/30 text-sky-400"
                          }`}>
                            {st.source === "env" ? "✓ متغير بيئة" : "✓ قاعدة بيانات"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-400">✗ غير مضبوط</span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">{p.envVar}</div>
                      <div className="text-[10px] text-muted-foreground">{p.models}</div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={loadKeyStatus} className="gap-1.5 text-xs text-muted-foreground mt-1">
              <RefreshCw size={11} /> تحديث الحالة
            </Button>
          </SectionCard>

          {/* Enter / Update Keys */}
          <SectionCard icon={<Key size={16} className="text-yellow-400" />} title="إدخال أو تحديث المفاتيح">
            <div className="p-3 rounded border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs flex gap-2 mb-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>المفاتيح المدخلة هنا تُحفظ في قاعدة البيانات كاحتياط. للأمان الأقصى استخدم متغيرات البيئة (Replit Secrets).</span>
            </div>

            {keyMsg && (
              <div className={`p-3 rounded border text-xs flex items-center gap-2 ${
                keyMsg.type === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : "border-red-500/30 bg-red-500/5 text-red-400"
              }`}>
                {keyMsg.type === "ok" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {keyMsg.text}
              </div>
            )}

            <div className="space-y-4">
              {([
                { id: "gemini" as const, label: "Gemini API Key", placeholder: "AIza...", hint: "من Google AI Studio → aistudio.google.com" },
                { id: "alibaba" as const, label: "Alibaba API Key", placeholder: "sk-...", hint: "من Alibaba DashScope أو MaaS endpoint" },
              ]).map(f => (
                <div key={f.id}>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{f.label}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey[f.id] ? "text" : "password"}
                        value={keyInputs[f.id]}
                        onChange={e => setKeyInputs(p => ({ ...p, [f.id]: e.target.value }))}
                        placeholder={keyStatus?.[f.id]?.configured ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : f.placeholder}
                        className="text-sm font-mono pr-10"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(p => ({ ...p, [f.id]: !p[f.id] }))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showKey[f.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{f.hint}</p>
                </div>
              ))}

              {/* Alibaba custom endpoint */}
              <div className="pt-2 border-t border-border/40">
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Alibaba Endpoint (MaaS) — <span className="text-orange-400">اتركه فارغاً لاستخدام DashScope الافتراضي</span>
                </label>
                <Input
                  type="text"
                  value={keyInputs.alibaba_base}
                  onChange={e => setKeyInputs(p => ({ ...p, alibaba_base: e.target.value }))}
                  placeholder="https://ws-xxxx.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1"
                  className="text-xs font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  استخدم هذا عند توفّر workspace خاص بـ MaaS بدلاً من DashScope العام
                </p>
              </div>
            </div>

            <Button onClick={saveApiKeys} disabled={keySaving} className="gap-1.5 w-full mt-2">
              {keySaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              حفظ المفاتيح في قاعدة البيانات
            </Button>
          </SectionCard>

          {/* Agent → Model Map */}
          <SectionCard icon={<Bot size={16} className="text-purple-400" />} title="خريطة الوكلاء ← النماذج (Qwen أساسي)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { label: "نص معقد + إبداعي + تنسيق", model: "qwen3-max-2026-01-23", agents: ["بيليه", "معمار القصة", "المخرج", "المخرج التقني", "السرد العاطفي", "ACIS Master", "StoryboardToVision", "NEXUS Master", "الصوت والموسيقى", "ما بعد الإنتاج", "تحليل المشاهد"], color: "border-orange-500/30 bg-orange-500/5 text-orange-400" },
                { label: "استدلال + تدقيق + أخلاقيات", model: "qwq-plus", agents: ["مدقق الصدق", "الناقد الفني", "CAEOS Master"], color: "border-violet-500/30 bg-violet-500/5 text-violet-400" },
                { label: "برمجة + هندسة البرومبت", model: "qwen3-coder-480b", agents: ["مخرج البرومبت", "منسق النماذج"], color: "border-sky-500/30 bg-sky-500/5 text-sky-400" },
                { label: "رؤية بصرية + اللوحة المصورة", model: "qwen3-vl-235b", agents: ["مصمم اللوحة المصورة"], color: "border-pink-500/30 bg-pink-500/5 text-pink-400" },
                { label: "مهام سريعة + مراقبة", model: "qwen3.5-flash", agents: ["وحدات التصيير", "منسق الجدول الزمني"], color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" },
                { label: "صوت عربي (Gemini حصرياً)", model: "gemini-2.5-flash-preview-tts", agents: ["TTS · التعليق الصوتي العربي"], color: "border-primary/30 bg-primary/5 text-primary" },
              ].map(g => (
                <div key={g.model} className={`p-3 rounded border ${g.color} space-y-2`}>
                  <div>
                    <div className="font-semibold text-[11px] mb-1">{g.label}</div>
                    <div className="font-mono text-[10px] opacity-80">{g.model}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.agents.map(a => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-background/40 border border-current/20">{a}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Models Tab ── */}
      {tab === "models" && (
        <div className="space-y-5">
          {/* Header Banner */}
          <div className="p-4 rounded border border-orange-500/20 bg-orange-500/5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-semibold text-orange-400 mb-1">
                <BarChart3 size={16} /> رصيد النماذج — Alibaba Qwen (أساسي) + Google Gemini (صوت فقط)
              </div>
              <p className="text-xs text-muted-foreground">
                الرصيد المعروض مبني على الاستهلاك المسجّل في قاعدة البيانات. الأرقام الأولية من تقرير الرصيد الأصلي.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={loadModels} disabled={modelLoading} className="gap-1.5 text-xs">
                {modelLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                تحديث
              </Button>
              <Button size="sm" onClick={seedDashScope} disabled={seedingDashScope} className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white">
                {seedingDashScope ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                تفعيل DashScope
              </Button>
            </div>
          </div>

          {modelLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 size={20} className="animate-spin" /> جاري تحميل إحصائيات النماذج...
            </div>
          ) : modelStats.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 size={32} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد بيانات — اضغط تحديث للتحميل</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {(() => {
                const primaryModels = modelStats.filter(m => m.isPrimary);
                const qwenModels = primaryModels.filter(m => m.provider === "qwen");
                const geminiModels = primaryModels.filter(m => m.provider === "gemini");
                const totalQwenQuota = qwenModels.reduce((s, m) => s + m.quota, 0);
                const totalQwenUsed = qwenModels.reduce((s, m) => s + m.used, 0);
                const totalCalls = modelStats.reduce((s, m) => s + m.calls, 0);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "نماذج Qwen النشطة", value: qwenModels.length, sub: "نموذج أساسي", color: "text-orange-400 border-orange-500/20 bg-orange-500/5" },
                      { label: "إجمالي رصيد Qwen", value: (totalQwenQuota / 1_000_000).toFixed(1) + "M", sub: "رمز متاح", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" },
                      { label: "رموز مستهلكة", value: totalQwenUsed.toLocaleString("ar"), sub: "من جميع النماذج", color: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
                      { label: "إجمالي الاستدعاءات", value: totalCalls.toLocaleString("ar"), sub: "مكالمة API", color: "text-primary border-primary/20 bg-primary/5" },
                    ].map(c => (
                      <div key={c.label} className={`p-3 rounded border ${c.color} text-center space-y-1`}>
                        <div className={`text-2xl font-bold font-mono ${c.color.split(" ")[0]}`}>{c.value}</div>
                        <div className="text-[10px] text-muted-foreground">{c.sub}</div>
                        <div className="text-[10px] font-medium">{c.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Qwen Primary Models */}
              {(() => {
                const groups: Record<string, typeof modelStats> = {};
                for (const m of modelStats.filter(m => m.provider === "qwen")) {
                  if (!groups[m.category]) groups[m.category] = [];
                  groups[m.category].push(m);
                }
                const catIcons: Record<string, React.ReactNode> = {
                  "نص سريع":   <Zap size={13} className="text-emerald-400" />,
                  "نص متقدم":  <Sparkles size={13} className="text-orange-400" />,
                  "إبداعي":    <Sparkles size={13} className="text-orange-400" />,
                  "برمجة":     <Code2 size={13} className="text-sky-400" />,
                  "برمجة سريع": <Code2 size={13} className="text-sky-400" />,
                  "رؤية":      <Activity size={13} className="text-pink-400" />,
                  "ترجمة":     <Languages size={13} className="text-violet-400" />,
                  "استدلال":   <Lightbulb size={13} className="text-amber-400" />,
                  "تنسيق":     <Cpu size={13} className="text-orange-400" />,
                };
                return (
                  <SectionCard icon={<span className="text-orange-400 font-bold text-sm">Q</span>} title="نماذج Qwen / Alibaba — الأساسي لكل المهام">
                    <div className="space-y-3">
                      {Object.entries(groups).map(([cat, models]) => (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                            {catIcons[cat] ?? <Circle size={10} />}
                            {cat}
                          </div>
                          <div className="space-y-2">
                            {models.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map(m => (
                              <ModelBar key={m.id} model={m} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                );
              })()}

              {/* Gemini Models */}
              {modelStats.filter(m => m.provider === "gemini").length > 0 && (
                <SectionCard icon={<Volume2 size={16} className="text-primary" />} title="نماذج Gemini — للصوت العربي + الاحتياط">
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-primary/5 border border-primary/10 text-xs text-primary/80 flex items-center gap-2">
                      <Info size={12} />
                      Gemini محجوز لـ TTS العربي (الجودة الأفضل) + احتياط أخير عند فشل Qwen كلياً
                    </div>
                    {modelStats.filter(m => m.provider === "gemini").map(m => (
                      <ModelBar key={m.id} model={m} />
                    ))}
                  </div>
                </SectionCard>
              )}
            </>
          )}
        </div>
      )}

      {/* ── AI Settings ── */}
      {tab === "ai" && (
        <div className="space-y-5">
          {/* Primary providers header */}
          <div className="flex items-center gap-3 p-3 rounded border border-primary/20 bg-primary/5">
            <div className="flex-1 text-xs text-muted-foreground text-right">
              <span className="text-primary font-semibold">Gemini (Google)</span> و <span className="text-orange-400 font-semibold">Qwen (Alibaba)</span> هما المزوّدان الأساسيان — جميع الوكلاء المهمة تستخدم أعلى نموذج متاح تلقائياً عبر التوجيه الذكي.
            </div>
            <div className="shrink-0 flex gap-1.5">
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary font-mono">gemini-2.5-pro</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-400/20 border border-orange-400/30 text-orange-400 font-mono">qwen-max</span>
            </div>
          </div>

          <SectionCard icon={<BrainCircuit size={16} className="text-primary" />} title="نماذج Google Gemini">
            <Row label="نموذج Pro (الأعلى جودة)" desc="للوكلاء المعقدة — بيليه، السيناريو، الإخراج، NEXUS، CAEOS">
              <select value={getSetting("ai.pro_model")} onChange={e => setSetting("ai.pro_model", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground min-w-[200px]">
                <optgroup label="── الأعلى (مُوصى به) ──">
                  <option value="gemini-2.5-pro">gemini-2.5-pro ⭐ الأقوى</option>
                </optgroup>
                <optgroup label="── سريع ──">
                  <option value="gemini-2.5-flash">gemini-2.5-flash ⚡</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                </optgroup>
                <optgroup label="── الجيل الأول ──">
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
                </optgroup>
              </select>
            </Row>
            <Row label="نموذج Flash (المهام اليومية)" desc="للمهام السريعة والتجميع والمراقبة">
              <select value={getSetting("ai.primary_model")} onChange={e => setSetting("ai.primary_model", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground min-w-[200px]">
                <optgroup label="── الأحدث (مُوصى به) ──">
                  <option value="gemini-2.5-flash">gemini-2.5-flash ⭐ الافتراضي</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </optgroup>
                <optgroup label="── اقتصادي ──">
                  <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
                </optgroup>
                <optgroup label="── Pro كاحتياط ──">
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                </optgroup>
              </select>
            </Row>
          </SectionCard>

          <SectionCard icon={<BrainCircuit size={16} className="text-orange-400" />} title="نماذج Qwen (Alibaba Cloud)">
            <Row label="نموذج Qwen الأساسي" desc="احتياط Gemini ومهام المحتوى العربي عبر DashScope">
              <select value={getSetting("ai.qwen_model")} onChange={e => setSetting("ai.qwen_model", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground min-w-[200px]">
                <optgroup label="── الأعلى (مُوصى به) ──">
                  <option value="qwen-max">qwen-max ⭐ الأقوى</option>
                  <option value="qwen-max-latest">qwen-max-latest</option>
                </optgroup>
                <optgroup label="── متوازن ──">
                  <option value="qwen-plus">qwen-plus ⚡</option>
                  <option value="qwen-plus-latest">qwen-plus-latest</option>
                </optgroup>
                <optgroup label="── سريع / اقتصادي ──">
                  <option value="qwen-turbo">qwen-turbo 🚀</option>
                  <option value="qwen-turbo-latest">qwen-turbo-latest</option>
                </optgroup>
                <optgroup label="── نماذج متخصصة ──">
                  <option value="qwen2.5-72b-instruct">qwen2.5-72b-instruct</option>
                  <option value="qwen2.5-32b-instruct">qwen2.5-32b-instruct</option>
                  <option value="qwen2.5-14b-instruct">qwen2.5-14b-instruct</option>
                  <option value="qwen2.5-7b-instruct">qwen2.5-7b-instruct</option>
                </optgroup>
              </select>
            </Row>
            <Row label="نموذج Flash الاحتياطي (Qwen)" desc="لمهام السرعة والتجميع عند استخدام Alibaba">
              <select value={getSetting("ai.qwen_flash_model")} onChange={e => setSetting("ai.qwen_flash_model", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground min-w-[200px]">
                <optgroup label="── مُوصى به ──">
                  <option value="qwen-plus">qwen-plus ⭐ الافتراضي</option>
                </optgroup>
                <optgroup label="── أسرع ──">
                  <option value="qwen-turbo">qwen-turbo 🚀</option>
                  <option value="qwen-turbo-latest">qwen-turbo-latest</option>
                </optgroup>
                <optgroup label="── أقوى ──">
                  <option value="qwen-max">qwen-max</option>
                </optgroup>
              </select>
            </Row>
          </SectionCard>

          <SectionCard icon={<Zap size={16} className="text-amber-400" />} title="معاملات التوليد">
            <Row label="الحد الأقصى للرموز" desc="أقصى عدد رموز في كل استجابة لنموذج الذكاء الاصطناعي">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseInt(getSetting("ai.max_tokens") || "8192")]}
                  onValueChange={([v]) => setSetting("ai.max_tokens", String(v))}
                  min={512} max={32768} step={512} className="flex-1" />
                <span className="text-xs font-mono text-primary w-14 text-left">{getSetting("ai.max_tokens")}</span>
              </div>
            </Row>
            <Row label="درجة الإبداع (Temperature)" desc="0 = دقيق، 1 = إبداعي أكثر">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseFloat(getSetting("ai.temperature") || "0.7") * 100]}
                  onValueChange={([v]) => setSetting("ai.temperature", String(v / 100))}
                  min={0} max={100} step={5} className="flex-1" />
                <span className="text-xs font-mono text-primary w-10 text-left">{getSetting("ai.temperature")}</span>
              </div>
            </Row>
          </SectionCard>

          <SectionCard icon={<Shield size={16} className="text-sky-400" />} title="توجيه اللغة والخطأ">
            <Row label="توجيه اللغة التلقائي" desc="العربية → Qwen | الإنجليزية → Gemini">
              <Switch checked={getToggle("ai.language_routing")} onCheckedChange={v => setToggle("ai.language_routing", v)} />
            </Row>
            <Row label="رسالة خطأ عربية عند الفشل" desc="استبدال خطأ تقني بنص عربي للمستخدم">
              <Switch checked={getToggle("ai.fallback_on_error")} onCheckedChange={v => setToggle("ai.fallback_on_error", v)} />
            </Row>
          </SectionCard>

          <SectionCard icon={<TestTube2 size={16} className="text-emerald-400" />} title="اختبار الاتصال بالنماذج">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: "gemini", label: "Gemini (Google)", color: "text-primary", env: "GEMINI_API_KEY" },
                { id: "qwen",   label: "Qwen (Alibaba)",  color: "text-orange-400", env: "ALIBABA_API_KEY" },
              ].map(p => {
                const result = aiTest[p.id];
                return (
                  <div key={p.id} className="p-4 rounded border border-border/50 bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm ${p.color}`}>{p.label}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{p.env}</span>
                    </div>
                    {result && (
                      <div className={`text-xs rounded p-2 font-mono border ${result.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
                        {result.success ? (
                          <>✅ متصل — {result.model} — {result.latency_ms}ms<br /><span className="opacity-70">{result.response}</span></>
                        ) : (
                          <>❌ {result.error}</>
                        )}
                      </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => testAi(p.id)} disabled={aiTesting === p.id} className="w-full gap-1.5">
                      {aiTesting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      اختبار الاتصال
                    </Button>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Agents Settings ── */}
      {tab === "agents" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            يمكنك تعديل حالة كل وكيل، نموذجه الافتراضي، اسمه العربي، وصفه، وبرومبت النظام الخاص به.
          </p>
          {agents?.map(agent => {
            const isOpen = expandedAgent === agent.id;
            const edits = agentEdits[agent.id] || {};
            const statusColor = agent.status === "online" ? "bg-emerald-500" : agent.status === "busy" ? "bg-primary" : "bg-red-500";
            return (
              <div key={agent.id} className="rounded border border-border/50 bg-card overflow-hidden">
                <button className="w-full flex items-center gap-3 p-4 text-right hover:bg-secondary/30 transition-colors"
                  onClick={() => {
                    setExpandedAgent(isOpen ? null : agent.id);
                    if (!agentEdits[agent.id]) setAgentEdits(prev => ({
                      ...prev,
                      [agent.id]: { status: agent.status, model: agent.model, nameAr: agent.nameAr || "", descriptionAr: agent.descriptionAr || "" }
                    }));
                  }}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor}`} />
                  <div className="flex-1 text-right">
                    <div className="font-semibold text-sm">{agent.nameAr || agent.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{agent.id} · {agent.system}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/70">{agent.model}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                      agent.status === "online" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" :
                      agent.status === "busy" ? "text-primary border-primary/30 bg-primary/5" :
                      "text-red-400 border-red-500/30 bg-red-500/5"
                    }`}>{agent.status}</span>
                    {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">الاسم العربي</label>
                        <Input value={edits.nameAr ?? ""} onChange={e => setAgentEdits(p => ({ ...p, [agent.id]: { ...p[agent.id], nameAr: e.target.value } }))}
                          placeholder="اسم الوكيل بالعربية" className="text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">الحالة</label>
                        <select value={edits.status ?? agent.status}
                          onChange={e => setAgentEdits(p => ({ ...p, [agent.id]: { ...p[agent.id], status: e.target.value } }))}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground">
                          <option value="online">online — متصل</option>
                          <option value="busy">busy — مشغول</option>
                          <option value="offline">offline — غير متصل</option>
                          <option value="error">error — خطأ</option>
                          <option value="idle">idle — خامل</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">النموذج</label>
                        <select value={edits.model ?? agent.model}
                          onChange={e => setAgentEdits(p => ({ ...p, [agent.id]: { ...p[agent.id], model: e.target.value } }))}
                          className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground">
                          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="qwen-turbo">qwen-turbo</option>
                          <option value="qwen-plus">qwen-plus</option>
                          <option value="qwen-max">qwen-max</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">الوصف العربي</label>
                        <Input value={edits.descriptionAr ?? ""} onChange={e => setAgentEdits(p => ({ ...p, [agent.id]: { ...p[agent.id], descriptionAr: e.target.value } }))}
                          placeholder="وصف مختصر بالعربية" className="text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">برومبت النظام المخصص (اتركه فارغاً للاستخدام الافتراضي)</label>
                      <Textarea value={edits.prompt ?? ""} onChange={e => setAgentEdits(p => ({ ...p, [agent.id]: { ...p[agent.id], prompt: e.target.value } }))}
                        rows={4} placeholder="أنت وكيل متخصص في..." className="text-sm font-mono resize-none" dir="auto" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveAgent(agent.id)} disabled={agentSaving === agent.id} className="gap-1.5">
                        {agentSaving === agent.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        حفظ تغييرات الوكيل
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAgentEdits(p => { const n = {...p}; delete n[agent.id]; return n; }); setExpandedAgent(null); }}>
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── System Settings ── */}
      {tab === "system" && (
        <div className="space-y-5">
          <SectionCard icon={<Activity size={16} className="text-amber-400" />} title="عتبات الصحة">
            <Row label="عتبة التحذير (%)" desc="تحت هذه النسبة يظهر مؤشر التحذير الأصفر">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseInt(getSetting("system.health_warning_threshold") || "70")]}
                  onValueChange={([v]) => setSetting("system.health_warning_threshold", String(v))}
                  min={40} max={90} step={5} className="flex-1" />
                <span className="text-xs font-mono text-amber-400 w-10">{getSetting("system.health_warning_threshold")}%</span>
              </div>
            </Row>
            <Row label="العتبة الحرجة (%)" desc="تحت هذه النسبة يظهر مؤشر الخطر الأحمر">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseInt(getSetting("system.health_critical_threshold") || "50")]}
                  onValueChange={([v]) => setSetting("system.health_critical_threshold", String(v))}
                  min={20} max={70} step={5} className="flex-1" />
                <span className="text-xs font-mono text-red-400 w-10">{getSetting("system.health_critical_threshold")}%</span>
              </div>
            </Row>
          </SectionCard>

          <SectionCard icon={<Cpu size={16} className="text-primary" />} title="حدود التنفيذ">
            <Row label="الوكلاء المتزامنون (حد أقصى)" desc="أقصى عدد وكلاء يعملون في وقت واحد">
              <Input type="number" value={getSetting("system.max_concurrent_agents")} min={1} max={50}
                onChange={e => setSetting("system.max_concurrent_agents", e.target.value)} className="w-24 text-sm" />
            </Row>
            <Row label="مهلة التنفيذ (ثانية)" desc="وقت انتهاء مهلة كل تنفيذ">
              <Input type="number" value={getSetting("system.execution_timeout_seconds")} min={10} max={600}
                onChange={e => setSetting("system.execution_timeout_seconds", e.target.value)} className="w-24 text-sm" />
            </Row>
            <Row label="الاحتفاظ بالنشاط (يوم)" desc="مدة الاحتفاظ بسجلات النشاط">
              <Input type="number" value={getSetting("system.activity_retention_days")} min={1} max={365}
                onChange={e => setSetting("system.activity_retention_days", e.target.value)} className="w-24 text-sm" />
            </Row>
          </SectionCard>
        </div>
      )}

      {/* ── Production Settings ── */}
      {tab === "production" && (
        <div className="space-y-5">
          <SectionCard icon={<Film size={16} className="text-pink-400" />} title="إعدادات الإنتاج الافتراضية">
            <Row label="لغة الإنتاج الافتراضية" desc="اللغة المستخدمة في المشاريع الجديدة">
              <select value={getSetting("production.default_language")} onChange={e => setSetting("production.default_language", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground">
                <option value="ar">العربية</option>
                <option value="en">English</option>
                <option value="mixed">مختلط</option>
              </select>
            </Row>
            <Row label="المدة الافتراضية (ثانية)" desc="مدة المشروع عند إنشائه">
              <select value={getSetting("production.default_duration_seconds")} onChange={e => setSetting("production.default_duration_seconds", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground">
                <option value="30">30 ثانية</option>
                <option value="60">60 ثانية</option>
                <option value="120">2 دقيقة</option>
                <option value="300">5 دقائق</option>
              </select>
            </Row>
            <Row label="توليد البرومبت تلقائياً" desc="توليد برومبت AI بعد كتابة السيناريو مباشرة">
              <Switch checked={getToggle("production.auto_generate_prompts")} onCheckedChange={v => setToggle("production.auto_generate_prompts", v)} />
            </Row>
            <Row label="حد الجودة المقبول (%)" desc="رفض المخرجات أقل من هذه النسبة">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseInt(getSetting("production.quality_threshold") || "85")]}
                  onValueChange={([v]) => setSetting("production.quality_threshold", String(v))}
                  min={50} max={100} step={5} className="flex-1" />
                <span className="text-xs font-mono text-pink-400 w-10">{getSetting("production.quality_threshold")}%</span>
              </div>
            </Row>
          </SectionCard>
        </div>
      )}

      {/* ── NEXUS Settings ── */}
      {tab === "nexus" && (
        <div className="space-y-5">
          <SectionCard icon={<Building2 size={16} className="text-emerald-400" />} title="إعدادات NEXUS المكتبي">
            <Row label="التعيين التلقائي للوكلاء" desc="NEXUS يختار الوكيل المناسب حسب نوع المهمة">
              <Switch checked={getToggle("nexus.auto_assign")} onCheckedChange={v => setToggle("nexus.auto_assign", v)} />
            </Row>
            <Row label="أقصى مدة للمهمة (دقيقة)" desc="بعد هذه المدة تُعلَّم المهمة متأخرة">
              <Input type="number" value={getSetting("nexus.max_task_duration_minutes")} min={5} max={480}
                onChange={e => setSetting("nexus.max_task_duration_minutes", e.target.value)} className="w-24 text-sm" />
            </Row>
            <Row label="رفع الأولوية للمتأخرات" desc="رفع أولوية المهام المتأخرة تلقائياً">
              <Switch checked={getToggle("nexus.priority_escalation")} onCheckedChange={v => setToggle("nexus.priority_escalation", v)} />
            </Row>
          </SectionCard>
        </div>
      )}

      {/* ── Conversations Settings ── */}
      {tab === "conversations" && (
        <div className="space-y-5">
          <SectionCard icon={<MessageSquare size={16} className="text-sky-400" />} title="إعدادات المحادثات">
            <Row label="أقصى سياق تاريخي (رسالة)" desc="عدد الرسائل السابقة المُرسلة لنموذج AI كسياق">
              <div className="flex items-center gap-3 w-64">
                <Slider value={[parseInt(getSetting("conversations.max_history") || "20")]}
                  onValueChange={([v]) => setSetting("conversations.max_history", String(v))}
                  min={2} max={50} step={2} className="flex-1" />
                <span className="text-xs font-mono text-sky-400 w-10">{getSetting("conversations.max_history")}</span>
              </div>
            </Row>
            <Row label="توليد العنوان تلقائياً" desc="عنوان المحادثة = محادثة مع [اسم الوكيل]">
              <Switch checked={getToggle("conversations.auto_title")} onCheckedChange={v => setToggle("conversations.auto_title", v)} />
            </Row>
          </SectionCard>
        </div>
      )}

      {/* ── UI Settings ── */}
      {tab === "ui" && (
        <div className="space-y-5">
          <SectionCard icon={<Monitor size={16} className="text-orange-400" />} title="تفضيلات الواجهة">
            <Row label="لغة الواجهة" desc="اللغة الافتراضية للعناوين والرسائل">
              <select value={getSetting("ui.language")} onChange={e => setSetting("ui.language", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground">
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Row>
            <Row label="المظهر" desc="يُطبَّق فوراً ويُحفَظ تلقائياً">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setTheme("dark"); setSetting("ui.theme", "dark"); }}
                  className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${theme === "dark" ? "bg-primary/20 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                  🌙 داكن
                </button>
                <button
                  onClick={() => { setTheme("light"); setSetting("ui.theme", "light"); }}
                  className={`px-3 py-1.5 rounded text-xs font-mono border transition-all ${theme === "light" ? "bg-amber-400/20 border-amber-400/50 text-amber-400" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                  ☀️ فاتح
                </button>
              </div>
            </Row>
            <Row label="الحركات والانتقالات" desc="تفعيل التأثيرات البصرية في الواجهة">
              <Switch checked={getToggle("ui.animations")} onCheckedChange={v => setToggle("ui.animations", v)} />
            </Row>
            <Row label="الشريط الجانبي المضغوط" desc="يُطبَّق فوراً — أيقونات فقط بدون نصوص">
              <Switch
                checked={sidebarCompact}
                onCheckedChange={v => { setSidebarCompact(v); setSetting("ui.sidebar_compact", v ? "true" : "false"); }}
              />
            </Row>
            <Row label="معدل التحديث التلقائي (ثانية)" desc="تحديث البيانات كل X ثانية">
              <select value={getSetting("ui.refresh_interval_seconds")} onChange={e => setSetting("ui.refresh_interval_seconds", e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-1.5 text-sm text-foreground">
                <option value="10">10 ثوانٍ</option>
                <option value="30">30 ثانية</option>
                <option value="60">دقيقة</option>
                <option value="300">5 دقائق</option>
                <option value="0">إيقاف</option>
              </select>
            </Row>
          </SectionCard>

          <SectionCard icon={<Info size={16} className="text-muted-foreground" />} title="معلومات النظام">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
              {[
                ["الإصدار", "v2.0.0"],
                ["المكدس", "React + Express + PostgreSQL"],
                ["النماذج", "Gemini 2.5 · Qwen Plus"],
                ["الوكلاء", `${agents?.length || 0} وكيل`],
                ["قاعدة البيانات", "PostgreSQL (Drizzle ORM)"],
                ["البنية", "pnpm Monorepo"],
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded bg-secondary/50 border border-border/30">
                  <div className="text-muted-foreground mb-1">{k}</div>
                  <div className="text-foreground font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Database Settings ── */}
      {tab === "database" && (
        <div className="space-y-5">
          <SectionCard icon={<Database size={16} className="text-red-400" />} title="إحصائيات قاعدة البيانات">
            {!dbStats ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> جاري التحميل...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  {dbStats.tables.map(t => (
                    <div key={t.name} className="p-3 rounded bg-secondary/50 border border-border/30 text-center">
                      <div className="text-lg mb-1">{t.icon}</div>
                      <div className="text-xl font-bold font-mono text-foreground">{t.count.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{t.nameAr}</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded bg-primary/5 border border-primary/20 text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">إجمالي السجلات</span>
                  <span className="font-mono font-bold text-primary">{dbStats.total_records.toLocaleString()}</span>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard icon={<Trash2 size={16} className="text-red-400" />} title="مسح البيانات">
            <div className="p-3 rounded border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs mb-4 flex gap-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>عمليات مسح البيانات لا يمكن التراجع عنها. استخدمها بحذر شديد.</span>
            </div>
            <div className="space-y-2">
              {CLEARABLE_TABLES.map(t => (
                <div key={t.name} className="flex items-center justify-between p-3 rounded border border-border/30 bg-secondary/30">
                  <div>
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground font-mono mr-2 opacity-50">{t.name}</span>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => clearTable(t.name)}
                    disabled={clearing === t.name}
                    className={`gap-1.5 text-xs ${t.danger ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                    {clearing === t.name ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    مسح
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={loadDb} className="gap-1.5 text-xs text-muted-foreground">
                <RefreshCw size={11} /> تحديث الإحصائيات
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Bottom Save Bar */}
      {pendingCount > 0 && tab !== "agents" && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-primary/30 rounded-full shadow-2xl shadow-primary/10 px-5 py-2.5 flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{pendingCount} تغيير في انتظار الحفظ</span>
          <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 rounded-full">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            حفظ الآن
          </Button>
          <button onClick={() => setChanged({})} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/20">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

type ModelStatItem = {
  id: string; provider: "qwen" | "gemini"; nameAr: string; category: string;
  quota: number; used: number; remaining: number; pctUsed: number;
  calls: number; tasks: string[]; agents: string[]; isPrimary: boolean;
};

function ModelBar({ model: m }: { model: ModelStatItem }) {
  const pct = m.pctUsed;
  const barColor = pct >= 80 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 80 ? "text-red-400" : pct >= 40 ? "text-amber-400" : "text-emerald-400";
  const remainingM = m.remaining >= 1_000_000 ? (m.remaining / 1_000_000).toFixed(2) + "M" :
    m.remaining >= 1_000 ? (m.remaining / 1_000).toFixed(0) + "K" : m.remaining.toString();
  const quotaM = m.quota >= 1_000_000 ? (m.quota / 1_000_000).toFixed(1) + "M" :
    m.quota >= 1_000 ? (m.quota / 1_000).toFixed(0) + "K" : m.quota.toString();

  return (
    <div className="p-3 rounded border border-border/40 bg-secondary/10 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-semibold text-foreground truncate">{m.id}</span>
            {m.isPrimary && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 shrink-0">أساسي</span>
            )}
            {m.provider === "gemini" && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary shrink-0">Gemini</span>
            )}
          </div>
          {m.agents.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {m.agents.slice(0, 4).join(" · ")}{m.agents.length > 4 ? ` +${m.agents.length - 4}` : ""}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-mono font-bold ${textColor}`}>{remainingM}</div>
          <div className="text-[10px] text-muted-foreground">/ {quotaM}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span className={pct > 0 ? textColor : ""}>{pct.toFixed(1)}% مُستهلك</span>
          <span>{m.calls > 0 ? `${m.calls.toLocaleString("ar")} استدعاء · ${m.used.toLocaleString("ar")} رمز` : "لم يُستخدم بعد"}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
