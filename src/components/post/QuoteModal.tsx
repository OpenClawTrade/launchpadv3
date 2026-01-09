import { useState, useRef } from "react";
import { Loader2, Image, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { PostContent } from "./PostContent";
import { formatDistanceToNow } from "date-fns";

interface QuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotedPost: {
    id: string;
    content: string;
    author: {
      name: string;
      handle: string;
      avatar?: string;
    };
    createdAt: Date;
  };
  onSubmit: (content: string, imageFile?: File) => Promise<void>;
}

export function QuoteModal({ open, onOpenChange, quotedPost, onSubmit }: QuoteModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxLength = 280;

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const characterPercentage = Math.min((characterCount / maxLength) * 100, 100);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!content.trim() || isOverLimit || isPosting) return;

    setIsPosting(true);
    try {
      await onSubmit(content, selectedImage || undefined);
      setContent("");
      removeImage();
      onOpenChange(false);
    } finally {
      setIsPosting(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "User";
  const avatarUrl = user.avatarUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="text-lg font-bold">Quote Post</DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 bg-primary">
              <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                placeholder="Add a comment..."
                className="w-full bg-transparent text-lg placeholder:text-muted-foreground resize-none outline-none min-h-[80px]"
                rows={1}
                autoFocus
              />

              {imagePreview && (
                <div className="relative mt-3 inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-32 rounded-xl object-cover" />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Quoted Post Preview */}
              <div className="mt-3 border border-border rounded-xl p-3 bg-secondary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-5 w-5 bg-primary">
                    <AvatarImage src={quotedPost.author.avatar} className="object-cover" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {quotedPost.author.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{quotedPost.author.name}</span>
                  <span className="text-muted-foreground text-sm">@{quotedPost.author.handle}</span>
                  <span className="text-muted-foreground text-sm">·</span>
                  <span className="text-muted-foreground text-sm">
                    {formatDistanceToNow(quotedPost.createdAt, { addSuffix: false })}
                  </span>
                </div>
                <div className="text-sm line-clamp-3">
                  <PostContent content={quotedPost.content} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex items-center gap-1">
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
              className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image className="h-5 w-5" />
            </Button>
            <EmojiPicker
              onEmojiSelect={(emoji) => {
                setContent(prev => prev + emoji);
                textareaRef.current?.focus();
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            {content.length > 0 && (
              <div className="relative h-5 w-5">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={50.27}
                    strokeDashoffset={50.27 - (50.27 * characterPercentage) / 100}
                    className={cn(
                      "transition-all duration-200",
                      isOverLimit ? "text-destructive" : characterCount > maxLength * 0.9 ? "text-yellow-500" : "text-primary"
                    )}
                  />
                </svg>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isOverLimit || isPosting}
              className="rounded-full font-bold px-5"
            >
              {isPosting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
