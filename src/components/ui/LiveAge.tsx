import { memo } from "react";
import { useTickingAge } from "@/hooks/useTickingAge";

interface LiveAgeProps {
  createdAt: string | null | undefined;
  isUnixSeconds?: boolean;
  className?: string;
}

export const LiveAge = memo(function LiveAge({ createdAt, isUnixSeconds, className = "text-[10px] font-mono text-foreground/50" }: LiveAgeProps) {
  const age = useTickingAge(createdAt, isUnixSeconds);
  return <span className={className}>{age}</span>;
});
