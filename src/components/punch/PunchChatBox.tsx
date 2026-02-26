import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type Message = { role: "user" | "punch"; content: string; username?: string };

const USERNAME_KEY = "punch-chat-username";

export function PunchChatBox() {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (username) localStorage.setItem(USERNAME_KEY, username);
  }, [username]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: "user", content: msg, username };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("punch-chat", {
        body: { username, message: msg },
      });

      if (error) throw error;
      const reply = data?.reply || "Ooh... something went wrong 🐵";
      setMessages((prev) => [...prev, { role: "punch", content: reply }]);
    } catch (err: any) {
      console.error("[PunchChat]", err);
      setMessages((prev) => [
        ...prev,
        { role: "punch", content: "🐵 Punch couldn't respond right now. Try again!" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] mx-auto mb-4">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center gap-2">
          <span className="text-sm">🐵</span>
          <span className="text-xs font-bold text-foreground">Ask Punch anything</span>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[160px]">
          <div className="p-3 space-y-2.5">
            {messages.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">
                No messages yet — ask Punch something!
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-muted-foreground mb-0.5">
                  {m.role === "user" ? m.username || "anon" : "Punch 🐵"}
                </span>
                <div
                  className={`text-xs px-2.5 py-1.5 rounded-lg max-w-[85%] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] text-muted-foreground">Punch 🐵</span>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-0.5" />
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border p-2 space-y-1.5">
          {/* Username row */}
          <input
            type="text"
            placeholder="Your name (optional)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-[11px] px-2 py-1 rounded bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {/* Message row */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Ask Punch something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
