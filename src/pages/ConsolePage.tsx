import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePrivy } from "@privy-io/react-auth";
import clawLogo from "@/assets/claw-logo.png";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";

interface ConsoleMessage {
  id: string;
  display_name: string;
  content: string;
  is_bot: boolean;
  created_at: string;
  user_id: string | null;
}

function getGuestId(): string {
  const key = "claw_guest_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `GUEST#${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConsolePage() {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [onlineCount] = useState(() => Math.floor(12 + Math.random() * 30));
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, authenticated } = usePrivy();
  const [displayName, setDisplayName] = useState<string>(getGuestId());
  const lastMessageTime = useRef<string | null>(null);

  // Resolve display name from profile
  useEffect(() => {
    if (!authenticated || !user) {
      setDisplayName(getGuestId());
      return;
    }
    const fetchProfile = async () => {
      const wallet = user.wallet?.address;
      if (!wallet) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("username, display_name")
        .eq("wallet_address", wallet)
        .maybeSingle();
      if (data?.username) setDisplayName(data.username);
      else if (data?.display_name) setDisplayName(data.display_name);
      else setDisplayName(wallet.slice(0, 4) + "..." + wallet.slice(-4));
    };
    fetchProfile();
  }, [authenticated, user]);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await (supabase as any)
        .from("console_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data && data.length > 0) {
        setMessages(data as ConsoleMessage[]);
        lastMessageTime.current = data[data.length - 1].created_at;
      }
    };
    fetchMessages();
  }, []);

  // Poll for new messages every 2.5s
  useEffect(() => {
    const interval = setInterval(async () => {
      const since = lastMessageTime.current || new Date(0).toISOString();
      const { data } = await (supabase as any)
        .from("console_messages")
        .select("*")
        .gt("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = (data as ConsoleMessage[]).filter((m) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs];
        });
        lastMessageTime.current = data[data.length - 1].created_at;
      }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/console-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            content: text,
            displayName,
            userId: null,
          }),
        }
      );
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, displayName]);

  return (
    <LaunchpadLayout hideFooter noPadding>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh)]">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/50 backdrop-blur-sm">
          <img src={clawLogo} alt="" className="h-9 w-9 rounded-full ring-2 ring-success/30" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">Claw Console</h1>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/20 text-success">
                Live
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              public chat — talk to the lobster & the community
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">{onlineCount}</span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <img src={clawLogo} alt="" className="h-16 w-16 mx-auto rounded-2xl opacity-50" />
                <p className="text-sm text-muted-foreground">no messages yet — say gm 🦞</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const showName =
                idx === 0 || messages[idx - 1].display_name !== msg.display_name;
              return (
                <div key={msg.id} className={`${showName && idx > 0 ? "mt-3" : ""}`}>
                  {showName && (
                    <div className="flex items-center gap-2 mb-0.5 px-1">
                      {msg.is_bot ? (
                        <img src={clawLogo} alt="" className="h-5 w-5 rounded-full" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-accent-purple/30 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-accent-purple">
                            {msg.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span
                        className={`text-[11px] font-semibold ${
                          msg.is_bot ? "text-success" : "text-accent-purple"
                        }`}
                      >
                        {msg.display_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-1.5 rounded-lg text-[13px] leading-relaxed max-w-[85%] ${
                      msg.is_bot
                        ? "bg-surface border border-border/50 text-foreground ml-7"
                        : "bg-transparent text-foreground/90 ml-7"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              );
            })
          )}
          {isSending && (
            <div className="flex items-center gap-2 px-1 mt-2">
              <img src={clawLogo} alt="" className="h-5 w-5 rounded-full" />
              <div className="bg-surface border border-border/50 rounded-lg px-3 py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-border bg-sidebar/30 backdrop-blur-sm p-3">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <span className="text-[10px] text-muted-foreground">chatting as</span>
            <span className="text-[10px] font-semibold text-accent-purple">{displayName}</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="say something..."
              className="flex-1 bg-surface border border-border text-foreground text-[13px] rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-success/50 placeholder:text-muted-foreground/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              type="submit"
              disabled={isSending || !input.trim()}
              size="icon"
              className="bg-success hover:bg-success/80 text-white h-10 w-10 rounded-xl flex-shrink-0"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </LaunchpadLayout>
  );
}
