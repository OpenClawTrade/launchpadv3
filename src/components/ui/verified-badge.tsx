import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { cn } from "@/lib/utils";
import { BadgeCheck } from "lucide-react";

type BadgeCheckIcon = typeof BadgeCheck;

export type VerifiedBadgeProps = ComponentPropsWithoutRef<BadgeCheckIcon> & {
  type: "blue" | "gold";
};

export const VerifiedBadge = forwardRef<ElementRef<BadgeCheckIcon>, VerifiedBadgeProps>(
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

