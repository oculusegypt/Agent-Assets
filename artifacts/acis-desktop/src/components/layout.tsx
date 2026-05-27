import { Link, useLocation } from "wouter";
import {
  Activity, BrainCircuit, MonitorPlay, MessageSquare,
  Film, Building2, Shield, Cpu, ChevronLeft, Settings2,
} from "lucide-react";
import { useGetSystemMetrics } from "@workspace/api-client-react";
import { useUI } from "../contexts/ui-settings";

const NAV_SECTIONS = [
  {
    label: "القيادة",
    labelEn: "COMMAND",
    items: [
      { href: "/", label: "العمليات", labelEn: "Operations", icon: Activity, sub: "لوحة التحكم" },
      { href: "/billie", label: "بيليه", labelEn: "Billie", icon: BrainCircuit, sub: "المشرف الأعلى" },
    ],
  },
  {
    label: "الأنظمة الذكية",
    labelEn: "AI SYSTEMS",
    items: [
      { href: "/acis", label: "ACIS السينمائي", labelEn: "ACIS Cinematic", icon: MonitorPlay, sub: "الإنتاج الفني" },
      { href: "/production", label: "من القصة للرؤية", labelEn: "Storyboard → Vision", icon: Film, sub: "خط الإنتاج" },
      { href: "/nexus", label: "نيكسوس المكتبي", labelEn: "NEXUS Office OS", icon: Building2, sub: "الذكاء المؤسسي" },
      { href: "/caeos", label: "كايوس / سيرفكس", labelEn: "CAEOS / SERVX", icon: Shield, sub: "الذكاء الدستوري" },
    ],
  },
  {
    label: "التواصل",
    labelEn: "COMMS",
    items: [
      { href: "/conversations", label: "تواصل الوكلاء", labelEn: "Agent Comms", icon: MessageSquare, sub: "محادثة مباشرة" },
    ],
  },
  {
    label: "الإدارة",
    labelEn: "ADMIN",
    items: [
      { href: "/settings", label: "الإعدادات", labelEn: "Settings", icon: Settings2, sub: "تحكم شامل بالنظام" },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: metrics } = useGetSystemMetrics();
  const { sidebarCompact } = useUI();

  const healthScore = metrics?.system_health ?? 94;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden selection:bg-primary/30" dir="rtl">
      {/* Sidebar — يمين في RTL */}
      <div className={`${sidebarCompact ? "w-14" : "w-60"} border-l border-border/50 bg-card flex flex-col z-10 shrink-0 order-last transition-all duration-200`}>
        {/* Logo */}
        <div className="p-3 border-b border-border/50 flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-lg shadow-primary/10 shrink-0">
            <Cpu size={18} />
          </div>
          {!sidebarCompact && (
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-wider text-foreground leading-none">ACIS</div>
              <div className="text-[9px] text-primary font-mono tracking-[0.2em] mt-0.5">مركز القيادة</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!sidebarCompact && (
                <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-[0.15em] mb-1.5 px-2 text-right">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        title={sidebarCompact ? item.label : undefined}
                        className={`flex items-center gap-2.5 px-2 py-2 rounded cursor-pointer transition-all group border ${
                          sidebarCompact ? "justify-center" : ""
                        } ${
                          active
                            ? "bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/10"
                            : "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground hover:border-border/50"
                        }`}
                      >
                        <item.icon size={15} className={`shrink-0 ${active ? "text-primary" : "group-hover:text-foreground"}`} />
                        {!sidebarCompact && (
                          <>
                            {active && <ChevronLeft size={10} className="text-primary/50 shrink-0 -mr-1" />}
                            <div className="flex-1 min-w-0 text-right">
                              <div className="text-xs font-semibold truncate">{item.label}</div>
                              <div className={`text-[10px] font-mono truncate ${active ? "text-primary/60" : "text-muted-foreground/50"}`}>
                                {item.sub}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Status Footer */}
        <div className={`p-3 border-t border-border/50 space-y-2 ${sidebarCompact ? "flex flex-col items-center" : ""}`}>
          {sidebarCompact ? (
            <div className={`w-2 h-2 rounded-full ${healthScore >= 90 ? "bg-emerald-400" : healthScore >= 70 ? "bg-amber-400" : "bg-red-400"} animate-pulse`} title={`الصحة: ${healthScore}%`} />
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={healthColor}>{healthScore}%</span>
                <span className="text-muted-foreground">الصحة</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${healthScore >= 90 ? "bg-emerald-400" : healthScore >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground justify-end">
                <span className="opacity-40">v2.0</span>
                <span className="ml-auto">النظام سليم</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,220,255,0.04),transparent)]" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 z-0 relative" dir="rtl">
          {children}
        </main>
      </div>
    </div>
  );
}
