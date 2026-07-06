import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getSessionId() {
  let id = sessionStorage.getItem("chat_session");
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("chat_session", id);
  }
  return id;
}

const SUGGESTIONS = [
  "What does PSI score mean?",
  "Why did the drift alert fire?",
  "How do I resolve a latency alert?",
  "What is the current model health?",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", loading: true }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(`${BASE}/api/chat/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId: getSessionId() }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              full += data.content;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: full, loading: false };
                return next;
              });
            }
            if (data.done || data.error) {
              if (data.error) setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: data.error, loading: false };
                return next;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "Something went wrong. Please try again.", loading: false };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [streaming]);

  const clearChat = async () => {
    const id = getSessionId();
    sessionStorage.removeItem("chat_session");
    await fetch(`${BASE}/api/chat/session/${id}`, { method: "DELETE" });
    setMessages([]);
  };

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
          "bg-primary text-primary-foreground hover:scale-105 active:scale-95",
          open && "rotate-90 opacity-0 pointer-events-none"
        )}
        aria-label="Open assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      {/* Panel */}
      <div className={cn(
        "fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl flex flex-col transition-all duration-200 origin-bottom-right",
        open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )} style={{ height: 480 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">ML Assistant</div>
              <div className="text-[10px] text-muted-foreground">Knows your models</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearChat} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Clear chat">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground text-center pt-2">Ask me anything about your models</div>
              <div className="grid grid-cols-1 gap-1.5">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
                msg.loading && "animate-pulse"
              )}>
                {msg.loading && !msg.content ? (
                  <span className="text-muted-foreground">Thinking...</span>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask about your models..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              disabled={streaming}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
