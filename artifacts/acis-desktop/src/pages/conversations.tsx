import { useState, useRef, useEffect } from "react";
import {
  useListConversations, useListMessages, useListAgents,
  useSendMessage, useCreateConversation,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare, Send, Plus, BrainCircuit,
  User, Zap, Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const SYSTEM_COLORS: Record<string, string> = {
  billie: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  acis: "text-primary border-primary/30 bg-primary/10",
  "from-storyboard-to-vision": "text-purple-400 border-purple-500/30 bg-purple-500/10",
  nexus: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  caeos: "text-orange-400 border-orange-500/30 bg-orange-500/10",
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
  const [showNew, setShowNew] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading: mLoad } = useListMessages(
    selectedConv!,
    { query: { enabled: !!selectedConv } }
  );

  const selectedConvData = conversations?.find(c => c.id === selectedConv);
  const selectedAgent = agents?.find(a => a.id === selectedConvData?.agent_id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConv || !input.trim()) return;
    setSending(true);
    const userInput = input;
    setInput("");
    try {
      await sendMsg.mutateAsync({ conversationId: selectedConv, content: userInput, role: "user" });
      qc.invalidateQueries();
    } catch {}
    setSending(false);
  }

  async function handleNewConversation() {
    if (!newAgentId) return;
    const agent = agents?.find(a => a.id === newAgentId);
    const res = await createConv.mutateAsync({ agent_id: newAgentId, agent_name: agent?.name ?? newAgentId });
    qc.invalidateQueries();
    setSelectedConv(res?.id ?? null);
    setShowNew(false);
    setNewAgentId("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Agent Comms</div>
          <Button size="sm" onClick={() => setShowNew(!showNew)}
            className="gap-1 h-7 px-2 text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20">
            <Plus size={12} /> New
          </Button>
        </div>

        {showNew && (
          <div className="p-3 bg-card border border-primary/30 rounded space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Select Agent</div>
            <select value={newAgentId} onChange={e => setNewAgentId(e.target.value)}
              className="w-full bg-input border border-border/50 rounded px-2 py-1.5 text-xs text-foreground">
              <option value="">Choose agent…</option>
              {agents?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNewConversation} disabled={!newAgentId || createConv.isPending}
                className="flex-1 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Start</Button>
              <Button size="sm" onClick={() => setShowNew(false)}
                className="h-7 text-xs bg-secondary text-muted-foreground hover:text-foreground">Cancel</Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {cLoad ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-card" />)
          ) : conversations?.map(conv => {
            const agent = agents?.find(a => a.id === conv.agent_id);
            const sysColor = SYSTEM_COLORS[agent?.system ?? ""] ?? "text-muted-foreground border-border/50 bg-secondary";
            return (
              <button key={conv.id} onClick={() => setSelectedConv(conv.id)}
                className={`w-full text-left p-3 rounded border transition-all ${
                  selectedConv === conv.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/50 bg-card hover:border-primary/20"
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${sysColor}`}>
                    {conv.agent_id === "billie" ? <BrainCircuit size={12} /> : <Zap size={12} />}
                  </div>
                  <span className="font-semibold text-xs truncate">{conv.agent_name}</span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground shrink-0">{conv.message_count}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate pl-8">{conv.title}</div>
              </button>
            );
          })}
          {!cLoad && !conversations?.length && (
            <div className="text-center text-muted-foreground text-xs py-8">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
              <p>No conversations yet</p>
              <p className="mt-1">Start one by clicking New</p>
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
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{selectedConvData.agent_name}</span>
                  {selectedAgent?.name_ar && (
                    <span className="text-xs opacity-60 font-serif" dir="rtl">{selectedAgent.name_ar}</span>
                  )}
                  {selectedAgent && (
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedAgent.status === "online" ? "bg-emerald-500" : selectedAgent.status === "busy" ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{selectedAgent?.model}</div>
              </div>
              <div className="ml-auto text-xs font-mono text-muted-foreground">{selectedConvData.message_count} messages</div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mLoad ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-secondary" />)
              ) : messages?.map(msg => {
                const arabic = isArabic(msg.content);
                return (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user"
                        ? "bg-secondary border border-border/50"
                        : "bg-primary/20 border border-primary/30 text-primary"
                    }`}>
                      {msg.role === "user" ? <User size={12} /> : <BrainCircuit size={12} />}
                    </div>
                    <div className={`max-w-[75%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`p-3 rounded text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary/10 border border-primary/20 text-foreground"
                          : "bg-secondary border border-border/50 text-foreground"
                      }`} dir={arabic ? "rtl" : "ltr"}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <Clock size={8} />
                        <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                        {msg.model_used && <span>· {msg.model_used}</span>}
                        {msg.tokens_used && <span>· {msg.tokens_used} tokens</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border/50 flex gap-3">
              <Textarea
                placeholder={`Message ${selectedConvData.agent_name}… (Arabic or English supported)`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
                rows={2}
                className="flex-1 resize-none text-sm"
                dir={isArabic(input) ? "rtl" : "ltr"}
              />
              <Button type="submit" disabled={sending || !input.trim()}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 self-end">
                {sending ? <Clock size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="font-semibold">Select a conversation</p>
            <p className="text-sm mt-1">or start a new one with any agent</p>
          </div>
        )}
      </div>
    </div>
  );
}
