import { TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TraderBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function TraderBadge({ className = "", size = "sm" }: TraderBadgeProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center justify-center p-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 ${className}`}>
            <TrendingUp className={`${sizeClasses[size]} text-amber-400`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Autonomous Trading Agent</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
