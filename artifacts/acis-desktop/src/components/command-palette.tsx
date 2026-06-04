import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Activity, BrainCircuit, MonitorPlay, Film, Building2,
  Shield, MessageSquare, Archive, Settings2, Bot, Search,
  CheckCircle2, Clapperboard,
} from "lucide-react";
import { useListAgents } from "@workspace/api-client-react";

const PAGES = [
  { href: "/",             label: "لوحة القيادة",     sub: "Operations Dashboard",     icon: Activity,       shortcut: "1" },
  { href: "/billie",       label: "بيليه",             sub: "Supervisory AI",           icon: BrainCircuit,   shortcut: "2" },
  { href: "/acis",         label: "ACIS السينمائي",    sub: "Pipeline Studio",          icon: MonitorPlay,    shortcut: "3" },
  { href: "/production",   label: "من القصة للرؤية",   sub: "Production Workflow",      icon: Film,           shortcut: "4" },
  { href: "/nexus",        label: "نيكسوس المكتبي",    sub: "Enterprise OS",            icon: Building2,      shortcut: "5" },
  { href: "/caeos",        label: "كايوس / سيرفكس",   sub: "Constitutional AI",        icon: Shield,         shortcut: "6" },
  { href: "/conversations",label: "تواصل الوكلاء",     sub: "Agent Conversations",      icon: MessageSquare,  shortcut: "7" },
  { href: "/archive",      label: "أرشيف النتائج",     sub: "Results Archive",          icon: Archive,        shortcut: "8" },
  { href: "/settings",     label: "الإعدادات",         sub: "System Settings",          icon: Settings2,      shortcut: "9" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { data: agents } = useListAgents();

  const toggle = useCallback(() => setOpen(o => !o), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") { e.preventDefault(); toggle(); return; }
      if (!open && meta) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          e.preventDefault();
          navigate(PAGES[n - 1].href);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle, navigate]);

  function go(href: string) { navigate(href); setOpen(false); }

  const agentList = agents?.slice(0, 8) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="ابحث عن صفحة، وكيل، أو أمر..." dir="rtl" className="text-right" />
      <CommandList dir="rtl" className="max-h-[400px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Search size={20} />
            <span className="text-sm">لا توجد نتائج</span>
          </div>
        </CommandEmpty>

        <CommandGroup heading="الصفحات">
          {PAGES.map(p => (
            <CommandItem key={p.href} value={`${p.label} ${p.sub}`} onSelect={() => go(p.href)}
              className="flex items-center gap-3 cursor-pointer">
              <p.icon size={15} className="text-muted-foreground shrink-0" />
              <div className="flex-1 text-right">
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground text-xs mr-2">{p.sub}</span>
              </div>
              <kbd className="text-[10px] font-mono bg-secondary border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground">
                ⌘{p.shortcut}
              </kbd>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {agentList.length > 0 && (
          <CommandGroup heading="الوكلاء">
            {agentList.map(agent => (
              <CommandItem key={agent.id}
                value={`${agent.nameAr || agent.name} ${agent.id} ${agent.system}`}
                onSelect={() => go("/conversations")}
                className="flex items-center gap-3 cursor-pointer">
                <Bot size={15} className="text-primary shrink-0" />
                <div className="flex-1 text-right">
                  <span className="font-medium">{agent.nameAr || agent.name}</span>
                  <span className="text-muted-foreground text-xs mr-2 font-mono">{agent.system}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                  agent.status === "online"
                    ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
                    : "text-muted-foreground border-border/30"
                }`}>{agent.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="أوامر سريعة">
          {[
            { label: "محادثة جديدة", sub: "ابدأ محادثة مع وكيل", href: "/conversations", icon: MessageSquare },
            { label: "مهمة NEXUS جديدة", sub: "إنشاء مهمة مؤسسية", href: "/nexus", icon: CheckCircle2 },
            { label: "مشروع إنتاج جديد", sub: "بدء خط إنتاج سينمائي", href: "/production", icon: Clapperboard },
          ].map(cmd => (
            <CommandItem key={cmd.label} value={`${cmd.label} ${cmd.sub}`}
              onSelect={() => go(cmd.href)} className="flex items-center gap-3 cursor-pointer">
              <cmd.icon size={15} className="text-amber-400 shrink-0" />
              <div className="flex-1 text-right">
                <span className="font-medium">{cmd.label}</span>
                <span className="text-muted-foreground text-xs mr-2">{cmd.sub}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      <div className="border-t border-border/50 px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>⌘K للفتح/الإغلاق</span>
        <span>⌘1-9 تنقّل سريع</span>
        <span>↑↓ للتنقل · ↵ للتأكيد · Esc للإغلاق</span>
      </div>
    </CommandDialog>
  );
}
