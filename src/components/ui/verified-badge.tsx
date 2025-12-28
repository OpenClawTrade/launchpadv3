import * as React from "react";
import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

export type VerifiedBadgeProps = React.ComponentPropsWithoutRef<typeof BadgeCheck> & {
  type: "blue" | "gold";
};

export const VerifiedBadge = React.forwardRef<SVGSVGElement, VerifiedBadgeProps>(
  ({ type, className, ...props }, ref) => {
    return (
      <BadgeCheck
        ref={ref}
        {...props}
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

