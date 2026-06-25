import { useState, useRef, useEffect } from "react";
import { useAI, AIMessage } from "@/hooks/use-ai";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Bot, X, Send, Loader2, Trash2, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "What were today's total sales?",
  "Show top 5 items sold this week",
  "How many orders this month?",
  "Show sales from Jan 1 to Jan 31",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<AIMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const [location] = useLocation();

  const ai = useAI();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, ai.isPending]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!user || location === "/login") return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || ai.isPending) return;

    setInput("");

    const userMsg: AIMessage = { role: "user", content: text };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);

    try {
      const response = await ai.mutateAsync({ message: text, history });
      setHistory([...newHistory, { role: "assistant", content: response.answer } as AIMessage]);
    } catch {
      setHistory([
        ...newHistory,
        { role: "assistant", content: "Sorry, I couldn't process that. Please try again." },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* FLOATING BUTTON */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        aria-label="AI Assistant"
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* CHAT PANEL */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[400px] bg-card rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
          style={{ maxHeight: "calc(100vh - 160px)" }}
        >
          {/* HEADER */}
          <div className="bg-primary px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary-foreground">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold text-sm">KangPOS Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-primary-foreground/60 hover:text-primary-foreground transition"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-primary-foreground/60 hover:text-primary-foreground transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
            {history.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">Ask me anything about your business</p>
                <div className="text-xs space-y-1.5 text-left bg-muted/50 rounded-xl p-3">
                  <p className="text-muted-foreground font-medium mb-2">Try asking:</p>
                  {SUGGESTIONS.map((s) => (
                    <p
                      key={s}
                      className="text-primary cursor-pointer hover:underline flex items-start gap-1"
                      onClick={() => setInput(s)}
                    >
                      <span className="opacity-50">›</span> {s}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {ai.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="border-t bg-card p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none bg-background focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              disabled={ai.isPending}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || ai.isPending}
              className="px-3"
            >
              {ai.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
