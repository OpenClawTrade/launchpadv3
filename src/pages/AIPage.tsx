import { MainLayout } from "@/components/layout";
import { Sparkles, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import fautraLogo from "@/assets/fautra-logo.png";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm FAUTRA AI, your intelligent assistant. I can help you with questions about FAUTRA, Solana, Web3, or just have a conversation. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(input),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <div className="p-2 rounded-full bg-gradient-to-br from-primary to-fautra-blue-hover">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">FAUTRA AI</h1>
            <p className="text-xs text-muted-foreground">Powered by advanced AI</p>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[calc(100vh-180px)]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fadeIn ${
              message.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              {message.role === "assistant" ? (
                <img src={fautraLogo} alt="AI" className="h-full w-full object-contain p-1" />
              ) : (
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  U
                </AvatarFallback>
              )}
            </Avatar>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 animate-fadeIn">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <img src={fautraLogo} alt="AI" className="h-full w-full object-contain p-1" />
            </Avatar>
            <div className="bg-secondary rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask FAUTRA AI anything..."
            className="h-12 rounded-full bg-secondary border-0"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-full flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  
  if (lower.includes("solana")) {
    return "Solana is a high-performance blockchain platform designed for decentralized applications and crypto-currencies. It's known for its incredible speed (65,000+ TPS) and low transaction costs. FAUTRA is built on Solana to provide a fast, seamless social experience!";
  }
  
  if (lower.includes("verification") || lower.includes("checkmark") || lower.includes("verified")) {
    return "FAUTRA offers two types of verification:\n\n💙 Blue Checkmark - For verified individuals and creators\n💛 Gold Checkmark - For premium members and organizations\n\nVerification helps establish authenticity and unlocks exclusive features. You can apply through your profile settings!";
  }
  
  if (lower.includes("fautra")) {
    return "FAUTRA is the next generation of social media! Built on Solana, we offer:\n\n• Lightning-fast posts and interactions\n• True ownership of your content\n• Decentralized verification\n• Community-driven features\n• Integrated crypto payments\n\nWe're bringing the best of classic social media with Web3 superpowers!";
  }
  
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! 👋 Great to meet you! I'm here to help you get the most out of FAUTRA. Feel free to ask me anything about the platform, Solana, Web3, or just chat!";
  }
  
  return "That's an interesting question! While I'm continuously learning, I can help you with information about FAUTRA, Solana, Web3 technology, and general assistance. Is there something specific about the platform you'd like to know?";
}
