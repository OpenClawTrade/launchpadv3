import { useState } from "react";
import { MainLayout } from "@/components/layout";
import { Settings, Search, MessageCircle, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { cn } from "@/lib/utils";
import { useMessages, Conversation } from "@/hooks/useMessages";
import { ChatView } from "@/components/chat/ChatView";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export default function MessagesPage() {
  const { isAuthenticated, login } = useAuth();
  const { conversations, totalUnread, isLoading } = useMessages();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = conversations.filter((conv) =>
    conv.other_user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedConversation) {
    return (
      <MainLayout hideRightSidebar>
        <ChatView
          conversationId={selectedConversation.id}
          otherUser={selectedConversation.other_user}
          onBack={() => setSelectedConversation(null)}
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Messages</h1>
            {totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-full bg-secondary border-0 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Conversations List */}
      <div className="divide-y divide-border">
        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Sign in to see your messages</h2>
            <p className="text-muted-foreground max-w-sm">
              Log in to start private conversations with others on TRENCHES.
            </p>
            <Button onClick={login} className="mt-6 rounded-full font-bold">
              Sign in
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onClick={() => setSelectedConversation(conversation)}
            />
          ))
        ) : conversations.length > 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="text-muted-foreground">No conversations match your search.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome to your inbox!</h2>
            <p className="text-muted-foreground max-w-sm">
              Drop a line, share posts and more with private conversations between you and others on TRENCHES.
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

function ConversationItem({
  conversation,
  onClick,
}: {
  conversation: Conversation;
  onClick: () => void;
}) {
  const hasUnread = conversation.unread_count > 0;
  const timeAgo = formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors",
        hasUnread && "bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={conversation.other_user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {conversation.other_user.display_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={cn("font-bold", hasUnread && "text-foreground")}>
              {conversation.other_user.display_name}
            </span>
            {conversation.other_user.verified_type && (
              <VerifiedBadge
                type={conversation.other_user.verified_type as "blue" | "gold"}
                className="h-4 w-4"
              />
            )}
            <span className="text-muted-foreground text-sm">
              @{conversation.other_user.username}
            </span>
            <span className="text-muted-foreground text-sm">· {timeAgo}</span>
          </div>
          <p
            className={cn(
              "text-sm truncate",
              hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {conversation.last_message_preview || "No messages yet"}
          </p>
        </div>
        {hasUnread && (
          <div className="h-3 w-3 rounded-full bg-primary flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}
