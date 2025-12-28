import { MainLayout } from "@/components/layout";
import { Settings, Search, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  user: {
    name: string;
    handle: string;
    avatar?: string;
    verified?: "blue" | "gold";
  };
  lastMessage: string;
  time: string;
  unread: boolean;
}

const conversations: Conversation[] = [
  {
    id: "1",
    user: { name: "FAUTRA Support", handle: "fautrasupport", verified: "gold" },
    lastMessage: "Welcome to FAUTRA! Let us know if you need any help.",
    time: "2h",
    unread: true,
  },
  {
    id: "2",
    user: { name: "Solana Dev", handle: "solanadev", verified: "blue" },
    lastMessage: "That's a great idea! Let's discuss more.",
    time: "5h",
    unread: false,
  },
  {
    id: "3",
    user: { name: "Web3 Builder", handle: "web3builder" },
    lastMessage: "Thanks for the follow! 🙌",
    time: "1d",
    unread: false,
  },
];

export default function MessagesPage() {
  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Direct Messages"
              className="pl-10 h-10 rounded-full bg-secondary border-0 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Conversations List */}
      <div className="divide-y divide-border">
        {conversations.length > 0 ? (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={cn(
                "w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors",
                conversation.unread && "bg-primary/5"
              )}
            >
              <div className="flex gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conversation.user.avatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {conversation.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={cn("font-bold", conversation.unread && "text-foreground")}>
                      {conversation.user.name}
                    </span>
                    {conversation.user.verified && (
                      <VerifiedBadge type={conversation.user.verified} className="h-4 w-4" />
                    )}
                    <span className="text-muted-foreground text-sm">
                      @{conversation.user.handle}
                    </span>
                    <span className="text-muted-foreground text-sm">· {conversation.time}</span>
                  </div>
                  <p className={cn(
                    "text-sm truncate",
                    conversation.unread ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {conversation.lastMessage}
                  </p>
                </div>
                {conversation.unread && (
                  <div className="h-3 w-3 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome to your inbox!</h2>
            <p className="text-muted-foreground max-w-sm">
              Drop a line, share posts and more with private conversations between you and others on FAUTRA.
            </p>
            <Button className="mt-6 rounded-full font-bold">
              Write a message
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
