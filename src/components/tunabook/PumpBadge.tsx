import { Rocket } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PumpBadgeProps {
  className?: string;
  showText?: boolean;
}

export function PumpBadge({ className, showText = true }: PumpBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
        "bg-[#00ff00]/20 text-[#00ff00] text-[10px] font-medium",
        className
      )}
      title="pump.fun Token"
    >
      <Rocket size={12} weight="fill" />
      {showText && <span>pump</span>}
    </span>
  );
}
