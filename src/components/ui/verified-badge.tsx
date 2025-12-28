import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  type: "blue" | "gold";
  className?: string;
}

export const VerifiedBadge = forwardRef<SVGSVGElement, VerifiedBadgeProps>(
  ({ type, className }, ref) => {
    return (
      <BadgeCheck
        ref={ref}
        className={cn(
          "h-5 w-5 fill-current",
          type === "blue" && "text-badge-blue badge-glow-blue",
          type === "gold" && "text-badge-gold badge-glow-gold",
          className
        )}
      />
    );
  }
);

VerifiedBadge.displayName = "VerifiedBadge";
