import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REPORT_REASONS = [
  { id: "spam", label: "Spam or misleading" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate speech" },
  { id: "scam", label: "Scam or fraud" },
  { id: "nsfw", label: "Inappropriate content" },
  { id: "other", label: "Other" },
];

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentType: "post" | "comment";
  contentId: string;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
}

export function ReportModal({
  open,
  onOpenChange,
  contentType,
  contentId,
  onSubmit,
  isSubmitting,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const handleSubmit = () => {
    const reason = selectedReason === "other" ? otherReason : selectedReason;
    if (!reason.trim()) return;
    onSubmit(reason);
  };

  const resetForm = () => {
    setSelectedReason("");
    setOtherReason("");
  };

  const isValid = selectedReason && (selectedReason !== "other" || otherReason.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) resetForm();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--tunabook-bg-card))] border-[hsl(var(--tunabook-bg-elevated))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--tunabook-text-primary))]">
            Report {contentType}
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--tunabook-text-muted))]">
            Help us understand what's wrong with this {contentType}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {REPORT_REASONS.map((reason) => (
              <div key={reason.id} className="flex items-center space-x-2 py-2">
                <RadioGroupItem
                  value={reason.id}
                  id={reason.id}
                  className="border-[hsl(var(--tunabook-text-muted))]"
                />
                <Label
                  htmlFor={reason.id}
                  className="text-[hsl(var(--tunabook-text-primary))] cursor-pointer"
                >
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === "other" && (
            <Textarea
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Please describe the issue..."
              className="mt-3 bg-[hsl(var(--tunabook-bg-elevated))] border-[hsl(var(--tunabook-bg-hover))] text-[hsl(var(--tunabook-text-primary))]"
              maxLength={500}
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[hsl(var(--tunabook-text-secondary))]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-[hsl(var(--tunabook-downvote))] hover:bg-[hsl(var(--tunabook-downvote))]/80"
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
