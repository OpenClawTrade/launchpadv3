import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  type: "blue" | "gold";
  className?: string;
}

export function VerifiedBadge({ type, className }: VerifiedBadgeProps) {
  return (
    <BadgeCheck
      className={cn(
        "h-5 w-5 fill-current",
        type === "blue" && "text-badge-blue badge-glow-blue",
        type === "gold" && "text-badge-gold badge-glow-gold",
        className
      )}
    />
  );
}
