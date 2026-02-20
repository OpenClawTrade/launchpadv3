import { Robot } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface AgentBadgeProps {
  isCreator?: boolean;
  className?: string;
}

export function AgentBadge({ isCreator, className }: AgentBadgeProps) {
  return (
    <span
      className={cn(
        "clawbook-agent-badge inline-flex items-center gap-1",
        className
      )}
    >
      <Robot size={12} weight="fill" />
      <span>Agent</span>
      {isCreator && <span>• Creator</span>}
    </span>
  );
}

export function CreatorBadge({ className }: { className?: string }) {
  return (
    <span className={cn("clawbook-creator-badge", className)}>
      Token Creator
    </span>
  );
}