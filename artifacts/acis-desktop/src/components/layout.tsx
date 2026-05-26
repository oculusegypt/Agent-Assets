import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, BrainCircuit, MonitorPlay, MessageSquare,
  Film, Building2, Shield, Cpu, ChevronRight,
} from "lucide-react";
import { useGetSystemMetrics } from "@workspace/api-client-react";

const NAV_SECTIONS = [
  {
    label: "Command",
    items: [
      { href: "/", label: "Operations", icon: Activity, sub: "Dashboard" },
      { href: "/billie", label: "Billie", icon: BrainCircuit, arabic: "بيليه", sub: "Supreme Supervisor" },
    ],
  },
  {
    label: "AI Systems",
    items: [
      { href: "/acis", label: "ACIS Cinematic", icon: MonitorPlay, sub: "Film Production" },
      { href: "/production", label: "Storyboard → Vision", icon: Film, sub: "Cinematic Pipeline" },
      { href: "/nexus", label: "NEXUS Office OS", icon: Building2, sub: "Enterprise AI" },
      { href: "/caeos", label: "CAEOS / SERVX", icon: Shield, sub: "Constitutional AI" },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/conversations", label: "Agent Comms", icon: MessageSquare, sub: "Live Chat" },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: metrics } = useGetSystemMetrics();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const healthScore = metrics?.health_score ?? 94;
  const healthColor = healthScore >= 90 ? "text-emerald-400" : healthScore >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <div className="w-60 border-r border-border/50 bg-card flex flex-col z-10 shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-border/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Cpu size={18} />
          </div>
          <div>
            <div className="font-bold text-sm tracking-widest uppercase text-foreground leading-none">ACIS</div>
            <div className="text-[9px] text-primary font-mono tracking-[0.3em] mt-0.5">COMMAND CENTER</div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-[0.25em] mb-1.5 px-2">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={`flex items-center gap-2.5 px-3 py-2 rounded cursor-pointer transition-all group border ${
                        active
                          ? "bg-primary/10 text-primary border-primary/25 shadow-sm shadow-primary/10"
                          : "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground hover:border-border/50"
                      }`}>
                        <item.icon size={14} className={active ? "text-primary" : "group-hover:text-foreground"} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">{item.label}</span>
                            {item.arabic && (
                              <span className="text-[10px] font-bold opacity-40 font-serif shrink-0">{item.arabic}</span>
                            )}
                          </div>
                          <div className={`text-[10px] font-mono truncate ${active ? "text-primary/60" : "text-muted-foreground/50"}`}>
                            {item.sub}
                          </div>
                        </div>
                        {active && <ChevronRight size={10} className="text-primary/50 shrink-0" />}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Status Footer */}
        <div className="p-3 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">HEALTH</span>
            <span className={healthColor}>{healthScore}%</span>
          </div>
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${healthScore >= 90 ? "bg-emerald-400" : healthScore >= 70 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${healthScore}%` }} />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>SYS NOMINAL</span>
            <span className="ml-auto opacity-40">v2.0</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,220,255,0.04),transparent)]" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 z-0 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
