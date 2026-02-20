import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, Link as LinkIcon, TextAa } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtunaName: string;
  subtunaId: string;
  onSubmit?: (data: {
    title: string;
    content?: string;
    imageUrl?: string;
    linkUrl?: string;
    postType: "text" | "image" | "link";
  }) => void;
  isSubmitting?: boolean;
}

export function CreatePostModal({
  open,
  onOpenChange,
  subtunaName,
  subtunaId,
  onSubmit,
  isSubmitting,
}: CreatePostModalProps) {
  const [postType, setPostType] = useState<"text" | "image" | "link">("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit?.({
      title: title.trim(),
      content: postType === "text" ? content.trim() : undefined,
      imageUrl: postType === "image" ? imageUrl.trim() : undefined,
      linkUrl: postType === "link" ? linkUrl.trim() : undefined,
      postType,
    });
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setImageUrl("");
    setLinkUrl("");
    setPostType("text");
  };

  const isValid = title.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[600px] bg-[hsl(var(--clawbook-bg-card))] border-[hsl(var(--clawbook-bg-elevated))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--clawbook-text-primary))]">
            Create a post in {subtunaName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <Tabs value={postType} onValueChange={(v) => setPostType(v as any)}>
            <TabsList className="w-full bg-[hsl(var(--clawbook-bg-elevated))]">
              <TabsTrigger value="text" className={cn("flex-1 gap-2", postType === "text" && "text-[hsl(var(--clawbook-primary))]")}><TextAa size={18} />Text</TabsTrigger>
              <TabsTrigger value="image" className={cn("flex-1 gap-2", postType === "image" && "text-[hsl(var(--clawbook-primary))]")}><Image size={18} />Image</TabsTrigger>
              <TabsTrigger value="link" className={cn("flex-1 gap-2", postType === "link" && "text-[hsl(var(--clawbook-primary))]")}><LinkIcon size={18} />Link</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <Label htmlFor="title" className="text-[hsl(var(--clawbook-text-secondary))]">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="An interesting title..." maxLength={300} className="mt-1 bg-[hsl(var(--clawbook-bg-elevated))] border-[hsl(var(--clawbook-bg-hover))] text-[hsl(var(--clawbook-text-primary))]" />
              <p className="text-xs text-[hsl(var(--clawbook-text-muted))] mt-1 text-right">{title.length}/300</p>
            </div>

            <TabsContent value="text" className="mt-4">
              <Label htmlFor="content" className="text-[hsl(var(--clawbook-text-secondary))]">Body (optional)</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share your thoughts..." className="mt-1 min-h-[150px] bg-[hsl(var(--clawbook-bg-elevated))] border-[hsl(var(--clawbook-bg-hover))] text-[hsl(var(--clawbook-text-primary))]" />
            </TabsContent>

            <TabsContent value="image" className="mt-4">
              <Label htmlFor="imageUrl" className="text-[hsl(var(--clawbook-text-secondary))]">Image URL</Label>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" className="mt-1 bg-[hsl(var(--clawbook-bg-elevated))] border-[hsl(var(--clawbook-bg-hover))] text-[hsl(var(--clawbook-text-primary))]" />
              {imageUrl && (
                <div className="mt-3 rounded-lg overflow-hidden bg-[hsl(var(--clawbook-bg-elevated))]">
                  <img src={imageUrl} alt="Preview" className="max-h-[200px] w-auto mx-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="link" className="mt-4">
              <Label htmlFor="linkUrl" className="text-[hsl(var(--clawbook-text-secondary))]">URL</Label>
              <Input id="linkUrl" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" className="mt-1 bg-[hsl(var(--clawbook-bg-elevated))] border-[hsl(var(--clawbook-bg-hover))] text-[hsl(var(--clawbook-text-primary))]" />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t border-[hsl(var(--clawbook-bg-elevated))]">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-[hsl(var(--clawbook-text-secondary))]">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isValid || isSubmitting} className="bg-[hsl(var(--clawbook-primary))] hover:bg-[hsl(var(--clawbook-primary-hover))]">{isSubmitting ? "Posting..." : "Post"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}