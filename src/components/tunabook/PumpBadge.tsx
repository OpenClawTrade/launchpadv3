import { cn } from "@/lib/utils";
import pumpfunPill from "@/assets/pumpfun-pill.webp";

interface PumpBadgeProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  mintAddress?: string;
}

export function PumpBadge({ className, showText = true, size = "md", mintAddress }: PumpBadgeProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full",
        "bg-primary/20 text-primary text-[10px] font-medium",
        "hover:bg-primary/30 transition-colors",
        className
      )}
      title="pump.fun Token"
    >
      <img src={pumpfunPill} alt="" className={cn(sizeClasses[size], "object-contain")} />
      {showText && <span>pump</span>}
    </span>
  );

  if (mintAddress) {
    return (
      <a
        href={`https://pump.fun/${mintAddress}`}
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
