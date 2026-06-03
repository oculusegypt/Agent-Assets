import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, Zap, AlertTriangle, CheckCircle2, Brain, Activity, Cpu } from "lucide-react";

export interface Notification {
  id: string;
  type: "agent_executed" | "alert" | "job_complete" | "system" | "error";
  title: string;
  desc?: string;
  time: Date;
  read: boolean;
}

const TYPE_STYLES: Record<Notification["type"], { icon: any; color: string; bg: string }> = {
  agent_executed: { icon: Zap,           color: "text-primary",     bg: "bg-primary/10" },
  alert:          { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-400/10" },
  job_complete:   { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-400/10" },
  system:         { icon: Activity,      color: "text-sky-400",     bg: "bg-sky-400/10" },
  error:          { icon: AlertTriangle, color: "text-red-400",     bg: "bg-red-400/10" },
};

const WS_TO_NOTIF: Record<string, Notification["type"]> = {
  agent_executed: "agent_executed",
  new_alert:      "alert",
  job_complete:   "job_complete",
  system_health:  "system",
  broadcast:      "system",
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function getWsUrl() {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}${BASE}/ws`;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const addNotification = useCallback((n: Omit<Notification, "id" | "time" | "read">) => {
    const notif: Notification = {
      ...n,
      id: crypto.randomUUID(),
      time: new Date(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(getWsUrl());
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === "ping") return;

            const notifType = WS_TO_NOTIF[data.type] ?? "system";
            let title = "";
            let desc = "";

            switch (data.type) {
              case "agent_executed":
                title = `وكيل ${data.agent_name || data.agentId || "ذكاء اصطناعي"} نفّذ مهمة`;
                desc = data.tokens_used ? `${data.tokens_used} رمز · ${data.model || ""}` : undefined;
                break;
              case "new_alert":
                title = data.title || "تنبيه جديد";
                desc = data.message || data.description;
                break;
              case "job_complete":
                title = `اكتملت مهمة الإنتاج`;
                desc = data.phase ? `المرحلة: ${data.phase}` : undefined;
                break;
              case "system_health":
                if ((data.score ?? 100) < 70) {
                  title = `تحذير: صحة النظام ${data.score}%`;
                  desc = "يُنصح بالفحص الفوري";
                } else return;
                break;
              default:
                if (!data.type || data.type === "ping") return;
                title = data.title || data.message || `حدث: ${data.type}`;
                desc = data.description;
            }

            if (title) addNotification({ type: notifType, title, desc });
          } catch {}
        };

        ws.onclose = () => {
          reconnectRef.current = setTimeout(connect, 5000);
        };
        ws.onerror = () => {
          ws.close();
        };
      } catch {}
    }

    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [addNotification]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  return { notifications, unreadCount, markAllRead, dismiss, clearAll, addNotification };
}

interface Props {
  compact?: boolean;
}

export function NotificationsPanel({ compact }: Props) {
  const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function relativeTime(date: Date) {
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return "الآن";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} د`;
    return `${Math.floor(diff / 3_600_000)} س`;
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) setTimeout(markAllRead, 2000); }}
        title="الإشعارات"
        className={`relative flex items-center justify-center rounded transition-colors ${
          compact
            ? "w-9 h-9 hover:bg-secondary"
            : "w-full gap-2 px-2 py-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground"
        } ${open ? "bg-secondary text-foreground" : ""}`}
      >
        <Bell size={15} className={unreadCount > 0 ? "text-primary" : ""} />
        {!compact && <span className="text-xs flex-1 text-right">الإشعارات</span>}
        {unreadCount > 0 && (
          <span className={`${compact ? "absolute -top-0.5 -right-0.5" : ""} min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center leading-none`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/40 overflow-hidden"
          dir="rtl"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-secondary/30">
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[10px] font-mono text-muted-foreground/50 hover:text-red-400 transition-colors">
                  مسح الكل
                </button>
              )}
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] font-mono text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1">
                  <CheckCheck size={10} />
                  تعليم كمقروء
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">الإشعارات</span>
              <Bell size={13} className="text-primary" />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Bell size={16} className="text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground/50 font-mono">لا توجد إشعارات جديدة</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {notifications.map(n => {
                  const s = TYPE_STYLES[n.type];
                  const Icon = s.icon;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary/30 transition-colors group ${!n.read ? "bg-primary/3" : ""}`}
                    >
                      <button
                        onClick={() => dismiss(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 text-muted-foreground/30 shrink-0 mt-0.5"
                      >
                        <X size={10} />
                      </button>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 mt-0.5">
                            {relativeTime(n.time)}
                          </span>
                          <p className={`text-xs font-medium leading-snug ${!n.read ? "text-foreground" : "text-foreground/70"}`}>
                            {n.title}
                          </p>
                        </div>
                        {n.desc && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.desc}</p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-lg ${s.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon size={11} className={s.color} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-border/30 bg-secondary/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
              <Cpu size={8} />
              <span>WebSocket حي</span>
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>متصل</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
