import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { useConversation, Message } from "@/hooks/useMessages";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ChatViewProps {
  conversationId: string;
  otherUser: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified_type: string | null;
  };
  onBack: () => void;
}

export function ChatView({ conversationId, otherUser, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, isLoading, isSending, sendMessage, uploadImage } = useConversation(conversationId);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() && !selectedImage) return;

    let imageUrl: string | null = null;
    
    if (selectedImage) {
      setIsUploading(true);
      imageUrl = await uploadImage(selectedImage);
      setIsUploading(false);
    }

    const success = await sendMessage(newMessage, imageUrl || undefined);
    if (success) {
      setNewMessage("");
      removeImage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarImage src={otherUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {otherUser.display_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold truncate">{otherUser.display_name}</span>
              {otherUser.verified_type && (
                <VerifiedBadge type={otherUser.verified_type as "blue" | "gold"} className="h-4 w-4" />
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">@{otherUser.username}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Avatar className="h-16 w-16 mb-4">
              <AvatarImage src={otherUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {otherUser.display_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-bold text-lg">{otherUser.display_name}</h3>
            <p className="text-muted-foreground">@{otherUser.username}</p>
            <p className="text-muted-foreground mt-4">Start a conversation with {otherUser.display_name}</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === user?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-auto rounded-lg object-cover"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={removeImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isSending}
          >
            <Image className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start a new message"
            className="flex-1 rounded-full bg-secondary border-0"
            disabled={isSending || isUploading}
          />
          <Button
            variant="default"
            size="icon"
            className="rounded-full"
            onClick={handleSend}
            disabled={(!newMessage.trim() && !selectedImage) || isSending || isUploading}
          >
            {isSending || isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-secondary text-foreground rounded-bl-md"
        )}
      >
        {message.image_url && (
          <img
            src={message.image_url}
            alt="Shared image"
            className="rounded-lg mb-2 max-w-full"
          />
        )}
        {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
        <p
          className={cn(
            "text-xs mt-1",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
