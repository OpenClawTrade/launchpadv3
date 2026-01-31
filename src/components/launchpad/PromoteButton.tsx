import { Megaphone, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PromoteButtonProps {
  isPromoted?: boolean;
  expiresAt?: string | null;
  onClick: () => void;
  disabled?: boolean;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function PromoteButton({
  isPromoted,
  expiresAt,
  onClick,
  disabled,
  size = "default",
  variant = "default",
  className,
}: PromoteButtonProps) {
  if (isPromoted && expiresAt) {
    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));

    return (
      <Badge
        className={cn(
          "bg-gradient-to-r from-warning/20 to-warning/30 text-warning border-warning/30",
          className
        )}
      >
        <Crown className="h-3 w-3 mr-1" />
        Promoted ({hoursRemaining}h left)
      </Badge>
    );
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size={size}
      variant={variant}
      className={cn(
        "gap-1.5",
        variant === "default" && "bg-warning hover:bg-warning/90 text-warning-foreground font-semibold",
        className
      )}
    >
      <Megaphone className="h-4 w-4" />
      Promote
    </Button>
  );
}
