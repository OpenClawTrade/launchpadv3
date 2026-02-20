import { cn } from "@/lib/utils";

interface PhantomBadgeProps {
  mintAddress?: string;
  showText?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function PhantomBadge({ mintAddress, showText = false, size = "sm", className }: PhantomBadgeProps) {
  const sizeClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <span title="Phantom Launched" className={cn("flex items-center gap-1 flex-shrink-0", className)}>
      <img src="/phantom-logo.png" alt="Phantom" className={cn(sizeClass, "rounded-sm")} />
      {showText && <span className="text-[10px] font-medium text-purple-400">Phantom</span>}
    </span>
  );
}