/**
 * billie-float.tsx
 * أيقونة بيليه العائمة — تفتح نافذة محادثة سريعة من أي صفحة
 */
import { useState, useRef, useEffect } from "react";
import { BrainCircuit, X, Send, Loader2, Mic, Volume2 } from "lucide-react";
import { useLocation } from "wouter";

interface Message { role: "user" | "assistant"; text: string; model?: string }

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function BillieFloat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [location] = useLocation();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // لا تظهر في صفحة بيليه الرئيسية
  if (location === "/billie") return null;

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
      const res = await fetch(`${BASE}/api/billie/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      setMessages(prev => [...prev, { role: "assistant", text: data.reply, model: data.model }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${e.message || "خطأ في الاتصال"}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function playTts(text: string) {
    if (ttsPlaying) { audioRef.current?.pause(); setTtsPlaying(false); return; }
    setTtsPlaying(true);
    try {
      const res = await fetch(`${BASE}/api/billie/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.substring(0, 400) }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => setTtsPlaying(false);
      audio.play();
    } catch { setTtsPlaying(false); }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* الزر العائم */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border ${
          open
            ? "bg-primary/20 border-primary/60 text-primary scale-95"
            : "bg-card border-primary/40 text-primary hover:bg-primary/15 hover:scale-105 hover:border-primary/70"
        }`}
        title="بيليه — محادثة سريعة"
        style={{ boxShadow: open ? "0 0 30px rgba(0,220,255,0.25)" : "0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(0,220,255,0.1)" }}
      >
        {open ? <X size={20} /> : <BrainCircuit size={22} />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {Math.min(messages.filter(m => m.role === "assistant").length, 9)}
          </span>
        )}
      </button>

      {/* نافذة المحادثة */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ height: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,220,255,0.08)" }}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50 bg-secondary/20 shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
              <BrainCircuit size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">بيليه</div>
              <div className="text-[10px] font-mono text-primary/60">المشرفة العليا — ACIS</div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <BrainCircuit size={20} className="text-primary/60" />
                </div>
                <p className="text-xs text-muted-foreground">مرحباً، أنا بيليه<br />اسألني عن أي شيء في النظام</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                    <BrainCircuit size={11} className="text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary/20 text-foreground border border-primary/20 rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm"
                  }`}>
                    {m.text}
                  </div>
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1.5">
                      {m.model && <span className="text-[9px] font-mono text-muted-foreground/40">{m.model}</span>}
                      <button
                        onClick={() => playTts(m.text)}
                        className="text-muted-foreground/40 hover:text-primary transition-colors"
                        title="استماع"
                      >
                        {ttsPlaying ? <Loader2 size={11} className="animate-spin" /> : <Volume2 size={11} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <BrainCircuit size={11} className="text-primary" />
                </div>
                <div className="bg-secondary rounded-xl rounded-tl-sm px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-2.5 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="اسأل بيليه..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none bg-secondary/50 border border-border/40 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors min-h-[36px] max-h-[100px]"
                style={{ direction: "rtl" }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/40 flex items-center justify-center text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
