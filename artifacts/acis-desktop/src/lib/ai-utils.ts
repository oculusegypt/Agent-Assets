/**
 * ai-utils.ts — مكتبة الأدوات المشتركة لنظام ACIS
 * تجمع الثوابت والدوال المستخدمة عبر جميع الصفحات
 */

// ── Base URL ─────────────────────────────────────────────────────────────────
export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
export const API_BASE = `${BASE}/api`;

// ── ألوان الأنظمة الموحدة ────────────────────────────────────────────────────
export const SYSTEM_COLORS: Record<string, string> = {
  ACIS:               "text-primary border-primary/30 bg-primary/10",
  StoryboardToVision: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  "from-storyboard-to-vision": "text-purple-400 border-purple-400/30 bg-purple-400/10",
  NEXUS:              "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  CAEOS:              "text-orange-400 border-orange-400/30 bg-orange-400/10",
  BILLIE:             "text-pink-400 border-pink-400/30 bg-pink-400/10",
  SERVX:              "text-sky-400 border-sky-400/30 bg-sky-400/10",
  // lowercase variants used in conversations
  billie:             "text-pink-400 border-pink-500/30 bg-pink-500/10",
  acis:               "text-primary border-primary/30 bg-primary/10",
  nexus:              "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  caeos:              "text-orange-400 border-orange-500/30 bg-orange-500/10",
};

// ── ألوان حالات الوكلاء ──────────────────────────────────────────────────────
export const STATUS_DOT: Record<string, string> = {
  online:  "bg-emerald-500",
  busy:    "bg-primary animate-pulse",
  offline: "bg-red-500",
  idle:    "bg-muted-foreground",
  error:   "bg-red-500",
};

export const STATUS_BADGE: Record<string, string> = {
  online:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  busy:    "bg-primary/10 text-primary border-primary/30",
  offline: "bg-red-500/10 text-red-400 border-red-500/30",
  idle:    "bg-muted text-muted-foreground border-border",
  error:   "bg-red-500/10 text-red-400 border-red-500/30",
};

// ── ألوان مزودي الذكاء الاصطناعي ────────────────────────────────────────────
export const PROVIDER_COLORS: Record<string, { bar: string; text: string; badge: string }> = {
  Google:  { bar: "bg-primary",    text: "text-primary",    badge: "bg-primary/10 border-primary/30 text-primary" },
  Alibaba: { bar: "bg-orange-400", text: "text-orange-400", badge: "bg-orange-400/10 border-orange-400/30 text-orange-400" },
  أخرى:   { bar: "bg-muted",      text: "text-muted-foreground", badge: "bg-secondary border-border text-muted-foreground" },
};

// ── ألوان مراحل الإنتاج ──────────────────────────────────────────────────────
export const PHASE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  script:     { text: "text-purple-400",  bg: "bg-purple-500/5",  border: "border-purple-500/30" },
  storyboard: { text: "text-blue-400",    bg: "bg-blue-500/5",    border: "border-blue-500/30" },
  audio:      { text: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/30" },
  images:     { text: "text-pink-400",    bg: "bg-pink-500/5",    border: "border-pink-500/30" },
  video:      { text: "text-amber-400",   bg: "bg-amber-500/5",   border: "border-amber-500/30" },
  music:      { text: "text-indigo-400",  bg: "bg-indigo-500/5",  border: "border-indigo-500/30" },
  assembly:   { text: "text-primary",     bg: "bg-primary/5",     border: "border-primary/30" },
};

// ── دوال الكشف والتنسيق ──────────────────────────────────────────────────────

/** هل النص يحتوي على أحرف عربية؟ */
export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/** تنسيق المدة الزمنية بشكل ودّي */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}ث`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}د ${s}ث`;
}

/** تنسيق أعداد الرموز (tokens) */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** تنسيق الأعداد الكبيرة */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** وقت نسبي بالعربية */
export function formatRelativeTime(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60)  return "الآن";
  if (min < 60)  return `منذ ${min} دقيقة`;
  if (hr < 24)   return `منذ ${hr} ساعة`;
  if (day < 7)   return `منذ ${day} يوم`;
  return date.toLocaleDateString("ar-SA");
}

/** تقطيع نص AI إلى أقسام بالعناوين */
export function parseSections(text: string): Array<{ title: string; content: string }> {
  if (!text) return [];
  const lines = text.split("\n");
  const sections: Array<{ title: string; content: string }> = [];
  let current: { title: string; content: string } | null = null;

  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    } else if (line.trim()) {
      current = { title: "المحتوى", content: line + "\n" };
    }
  }
  if (current) sections.push(current);

  return sections.filter(s => s.content.trim().length > 0);
}

/** لون نص المرحلة */
export function phaseTextColor(phase: string): string {
  return PHASE_COLORS[phase]?.text || "text-primary";
}

/** لون خلفية المرحلة */
export function phaseBgColor(phase: string): string {
  return PHASE_COLORS[phase]?.bg || "bg-primary/5";
}

/** لون حدود المرحلة */
export function phaseBorderColor(phase: string): string {
  return PHASE_COLORS[phase]?.border || "border-primary/30";
}
