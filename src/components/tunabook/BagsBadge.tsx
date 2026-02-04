import { cn } from "@/lib/utils";
import { Briefcase } from "lucide-react";

interface BagsBadgeProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  mintAddress?: string;
}

export function BagsBadge({ className, showText = true, size = "md", mintAddress }: BagsBadgeProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full",
        "bg-blue-500/20 text-blue-400 text-[10px] font-medium",
        "hover:bg-blue-500/30 transition-colors",
        className
      )}
      title="bags.fm Token"
    >
      <Briefcase className={cn(sizeClasses[size])} />
      {showText && <span>bags</span>}
    </span>
  );

  if (mintAddress) {
    return (
      <a
        href={`https://bags.fm/coin/${mintAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex"
      >
        {content}
      </a>
    );
  }

  return content;
}
