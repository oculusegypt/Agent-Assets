import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useListConversations, useListMessages, useListAgents,
  useSendMessage, useCreateConversation,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, Send, Plus, BrainCircuit,
  User, Clock, Zap, X, Trash2,
} from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const SYSTEM_COLORS: Record<string, string> = {
  billie:    "text-pink-400 border-pink-500/30 bg-pink-500/10",
  acis:      "text-primary border-primary/30 bg-primary/10",
  "from-storyboard-to-vision": "text-purple-400 border-purple-500/30 bg-purple-500/10",
  nexus:     "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  caeos:     "text-orange-400 border-orange-500/30 bg-orange-500/10",
  ACIS:      "text-primary border-primary/30 bg-primary/10",
  NEXUS:     "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  CAEOS:     "text-orange-400 border-orange-500/30 bg-orange-500/10",
  BILLIE:    "text-pink-400 border-pink-500/30 bg-pink-500/10",
  StoryboardToVision: "text-purple-400 border-purple-500/30 bg-purple-500/10",
};

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

export default function ConversationsPage() {
  const { data: conversations, isLoading: cLoad } = useListConversations();
  const { data: agents } = useListAgents();
  const sendMsg = useSendMessage();
  const createConv = useCreateConversation();
  const qc = useQueryClient();

  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading: mLoad } = useListMessages(
    selectedConv!,
    { query: { enabled: !!selectedConv, refetchInterval: sending ? 2000 : false } }
  );

  const selectedConvData = conversations?.find(c => c.id === selectedConv);
  const selectedAgent = agents?.find(a => a.id === selectedConvData?.agent_id);

  const deleteConv = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل الحذف");
      return res.json();
    },
    onSuccess: (_data, id) => {
      if (selectedConv === id) setSelectedConv(null);
      qc.invalidateQueries();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConv || !input.trim()) return;
    setSending(true);
    const userInput = input;
    setInput("");
    setStreamingText("");
    try {
      const response = await fetch(`${API_BASE}/conversations/${selectedConv}/messages-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userInput }),
      });
      if (!response.ok || !response.body) throw new Error("فشل الاتصال");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "chunk") setStreamingText(ev.text);
            if (ev.type === "done") { setStreamingText(""); qc.invalidateQueries(); }
          } catch {}
        }
      }
    } catch {
      try {
        await sendMsg.mutateAsync({
          conversationId: selectedConv,
          data: { content: userInput, language: isArabic(userInput) ? "ar" : "en" },
        });
        qc.invalidateQueries();
      } catch {}
    }
    setStreamingText("");
    setSending(false);
  }

  async function handleNewConversation() {
    if (!newAgentId) return;
    const agent = agents?.find(a => a.id === newAgentId);
    try {
      const res = await createConv.mutateAsync({
        data: { agent_id: newAgentId, agent_name: agent?.nameAr || agent?.name || newAgentId },
      });
      qc.invalidateQueries();
      setSelectedConv(res?.id ?? null);
      setShowNew(false);
      setNewAgentId("");
      toast.success(`بدأت محادثة مع ${agent?.nameAr || agent?.name || newAgentId}`);
    } catch {
      toast.error("فشل إنشاء المحادثة");
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4" dir="rtl">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">تواصل الوكلاء</div>
          <Button size="sm" onClick={() => setShowNew(!showNew)}
            className="gap-1 h-7 px-2 text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">
            {showNew ? <X size={12} /> : <Plus size={12} />}
            {showNew ? "إلغاء" : "جديد"}
          </Button>
        </div>

        {showNew && (
          <div className="p-3 bg-card border border-primary/30 rounded space-y-2">
            <div className="text-xs font-mono text-muted-foreground mb-1">اختر وكيلاً</div>
            <select value={newAgentId} onChange={e => setNewAgentId(e.target.value)}
              className="w-full bg-input border border-border/50 rounded px-2 py-1.5 text-xs text-foreground" dir="rtl">
              <option value="">اختر وكيلاً…</option>
              {agents?.map(a => (
                <option key={a.id} value={a.id}>{a.nameAr || a.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNewConversation} disabled={!newAgentId || createConv.isPending}
                className="flex-1 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {createConv.isPending ? "جارٍ الإنشاء…" : "ابدأ المحادثة"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {cLoad ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-card" />)
          ) : conversations?.map(conv => {
            const agent = agents?.find(a => a.id === conv.agent_id);
            const sysColor = SYSTEM_COLORS[agent?.system ?? ""] ?? "text-muted-foreground border-border/50 bg-secondary";
            const isDeleting = deletingId === conv.id;
            return (
              <div key={conv.id} className="group relative">
                <button onClick={() => setSelectedConv(conv.id)}
                  className={`w-full text-right p-3 rounded border transition-all ${
                    selectedConv === conv.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-card hover:border-primary/20"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${sysColor}`}>
                      {conv.agent_id === "billie" ? <BrainCircuit size={12} /> : <Zap size={12} />}
                    </div>
                    <span className="font-semibold text-xs truncate flex-1 text-right">{agent?.nameAr || conv.agent_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{conv.message_count}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate pr-8 text-right">{conv.title}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(conv.id);
                    deleteConv.mutate(conv.id, {
                      onSuccess: () => toast.success("حُذفت المحادثة"),
                      onError: () => toast.error("فشل حذف المحادثة"),
                      onSettled: () => setDeletingId(null),
                    });
                  }}
                  disabled={isDeleting}
                  className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/50">
                  {isDeleting ? <Clock size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              </div>
            );
          })}
          {!cLoad && !conversations?.length && (
            <div className="text-center text-muted-foreground text-xs py-8">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد محادثات بعد</p>
              <p className="mt-1 opacity-60">ابدأ محادثة جديدة مع أي وكيل</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col border border-border/50 rounded bg-card overflow-hidden">
        {selectedConvData ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${SYSTEM_COLORS[selectedAgent?.system ?? ""] ?? "bg-secondary"}`}>
                {selectedConvData.agent_id === "billie" ? <BrainCircuit size={16} /> : <Zap size={16} />}
              </div>
              <div className="flex-1 text-right">
                <div className="flex items-center gap-2 justify-end">
                  {selectedAgent && (
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedAgent.status === "online" ? "bg-emerald-500" : selectedAgent.status === "busy" ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                  )}
                  <span className="font-bold text-sm">{selectedAgent?.nameAr || selectedConvData.agent_name}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono text-right">{selectedAgent?.model}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-muted-foreground">{selectedConvData.message_count} رسالة</div>
                <button
                  onClick={() => {
                    if (!messages?.length) return;
                    const agentName = selectedAgent?.nameAr || selectedConvData.agent_name;
                    const md = `# محادثة مع ${agentName}\n\n` +
                      messages.map(m =>
                        `**${m.role === "user" ? "المستخدم" : agentName}** — ${new Date(m.created_at).toLocaleString("ar-SA")}\n\n${m.content}\n\n---`
                      ).join("\n\n");
                    navigator.clipboard?.writeText(md);
                  }}
                  title="تصدير المحادثة كـ Markdown"
                  className="p-1.5 rounded hover:bg-emerald-500/10 hover:text-emerald-400 text-muted-foreground/40 transition-colors">
                  <Zap size={13} />
                </button>
                <button
                  onClick={() => {
                    if (confirm("حذف هذه المحادثة نهائياً؟")) {
                      deleteConv.mutate(selectedConv!);
                    }
                  }}
                  className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/40 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mLoad ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-secondary" />)
              ) : messages?.map(msg => {
                const arabic = isArabic(msg.content);
                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row" : "flex-row-reverse"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user"
                        ? "bg-secondary border border-border/50"
                        : "bg-primary/20 border border-primary/30 text-primary"
                    }`}>
                      {msg.role === "user" ? <User size={12} /> : <BrainCircuit size={12} />}
                    </div>
                    <div className={`max-w-[75%] space-y-1 ${msg.role === "user" ? "items-start" : "items-end"} flex flex-col`}>
                      <div className={`p-3 rounded text-sm ${
                        msg.role === "user"
                          ? "bg-secondary border border-border/50 text-foreground whitespace-pre-wrap"
                          : "bg-primary/10 border border-primary/20 text-foreground prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-secondary prose-pre:text-xs prose-code:text-primary prose-code:bg-secondary prose-code:px-1 prose-code:rounded prose-headings:text-foreground prose-strong:text-foreground"
                      }`} dir={arabic ? "rtl" : "ltr"}>
                        {msg.role === "assistant" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <Clock size={8} />
                        <span>{new Date(msg.created_at).toLocaleTimeString("ar-SA")}</span>
                        {msg.model_used && msg.model_used !== "error" && msg.model_used !== "خطأ" && <span>· {msg.model_used}</span>}
                        {msg.tokens_used && msg.tokens_used > 0 && <span>· {msg.tokens_used} رمز</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {sending && streamingText && (
                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/20 border border-primary/30 text-primary shrink-0">
                    <BrainCircuit size={12} />
                  </div>
                  <div className="max-w-[75%] p-3 rounded bg-primary/10 border border-primary/20 text-sm prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-secondary prose-pre:text-xs prose-code:text-primary" dir="rtl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                    <span className="text-primary animate-pulse">▊</span>
                  </div>
                </div>
              )}
              {sending && !streamingText && (
                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/20 border border-primary/30 text-primary shrink-0">
                    <BrainCircuit size={12} />
                  </div>
                  <div className="p-3 rounded bg-primary/10 border border-primary/20 text-muted-foreground text-sm animate-pulse">
                    يكتب…
                  </div>
                </div>
              )}
              {!mLoad && messages?.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
                  <BrainCircuit size={32} className="mb-3 opacity-20" />
                  <p className="text-sm">ابدأ المحادثة مع {selectedAgent?.nameAr || selectedConvData.agent_name}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border/50 flex gap-3">
              <Button type="submit" disabled={sending || !input.trim()}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 self-end shrink-0">
                {sending ? <Clock size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
              <Textarea
                placeholder={`أرسل رسالة إلى ${selectedAgent?.nameAr || selectedConvData.agent_name}…`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                rows={2}
                className="flex-1 resize-none text-sm text-right"
                dir="rtl"
              />
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="font-semibold">اختر محادثة</p>
            <p className="text-sm mt-1 opacity-60">أو ابدأ محادثة جديدة مع أي وكيل</p>
          </div>
        )}
      </div>
    </div>
  );
}
