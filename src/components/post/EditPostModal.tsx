import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditPostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  initialContent: string;
  initialImageUrl?: string | null;
  onSave: (postId: string, content: string, removeImage: boolean) => Promise<boolean>;
}

export function EditPostModal({
  open,
  onOpenChange,
  postId,
  initialContent,
  initialImageUrl,
  onSave,
}: EditPostModalProps) {
  const [content, setContent] = useState(initialContent);
  const [removeImage, setRemoveImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Post cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSave(postId, content.trim(), removeImage);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setContent(initialContent);
      setRemoveImage(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className="min-h-[120px] resize-none"
            maxLength={500}
          />
          
          <div className="text-right text-sm text-muted-foreground">
            {content.length}/500
          </div>

          {initialImageUrl && !removeImage && (
            <div className="relative">
              <img
                src={initialImageUrl}
                alt="Post image"
                className="w-full max-h-48 object-cover rounded-lg"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setRemoveImage(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {removeImage && initialImageUrl && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              Image will be removed when you save.{" "}
              <button
                className="text-primary hover:underline"
                onClick={() => setRemoveImage(false)}
              >
                Undo
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !content.trim() || content === initialContent && !removeImage}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
