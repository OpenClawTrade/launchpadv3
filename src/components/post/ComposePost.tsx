import { useState, useRef } from "react";
import { Image, Smile, MapPin, Calendar, X, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ComposePostProps {
  user: {
    name: string;
    handle: string;
    avatar?: string;
  };
  onPost: (content: string, media?: File[]) => void | Promise<void>;
  placeholder?: string;
  maxLength?: number;
}

export function ComposePost({ 
  user, 
  onPost, 
  placeholder = "What's happening?",
  maxLength = 280
}: ComposePostProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || isOverLimit || isPosting) return;
    
    setIsPosting(true);
    try {
      await onPost(content, selectedImage ? [selectedImage] : undefined);
      setContent("");
      removeImage();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {user.name.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Audience selector (shows when focused) */}
          {isFocused && (
            <button className="text-primary text-sm font-bold border border-border rounded-full px-3 py-0.5 mb-2 hover:bg-primary/10 transition-colors">
              Everyone
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onFocus={() => setIsFocused(true)}
            placeholder={placeholder}
            className="w-full bg-transparent text-xl placeholder:text-muted-foreground resize-none outline-none min-h-[56px]"
            rows={1}
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative mt-3 inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 rounded-xl object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80"
                onClick={removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Reply settings (shows when focused) */}
          {isFocused && (
            <button className="text-primary text-sm font-bold flex items-center gap-1 mb-2 hover:bg-primary/10 rounded-full px-2 py-1 -ml-2 transition-colors">
              <span className="text-lg">🌍</span>
              Everyone can reply
            </button>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <div className="flex items-center gap-1 -ml-2">
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
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
              >
                <Smile className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
              >
                <MapPin className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 rounded-full text-primary hover:bg-primary/10"
              >
                <Calendar className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Character counter */}
              {content.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative h-5 w-5">
                    <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                      <circle
                        cx="10"
                        cy="10"
                        r="8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-border"
                      />
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
                          isOverLimit ? "text-destructive" : 
                          characterCount > maxLength * 0.9 ? "text-yellow-500" : "text-primary"
                        )}
                      />
                    </svg>
                    {characterCount > maxLength * 0.9 && (
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-[10px] font-bold",
                        isOverLimit ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {maxLength - characterCount}
                      </span>
                    )}
                  </div>
                  <div className="w-px h-6 bg-border" />
                </div>
              )}

              {/* Post button */}
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
        </div>
      </div>
    </div>
  );
}
