import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fish } from "@phosphor-icons/react";
import { OpenTunaAgent } from "@/hooks/useOpenTuna";
import { cn } from "@/lib/utils";

interface OpenTunaAgentSelectorProps {
  agents: OpenTunaAgent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export default function OpenTunaAgentSelector({
  agents,
  selectedAgentId,
  onSelect,
  isLoading,
  className,
}: OpenTunaAgentSelectorProps) {
  if (isLoading) {
    return (
      <div className={cn("w-48 h-9 bg-secondary/50 rounded-lg animate-pulse", className)} />
    );
  }

  if (agents.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Fish className="h-4 w-4" weight="duotone" />
        No agents
      </div>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <Select value={selectedAgentId || undefined} onValueChange={onSelect}>
      <SelectTrigger className={cn("w-48 bg-secondary/50 border-cyan-500/20", className)}>
        <SelectValue placeholder="Select agent">
          {selectedAgent && (
            <span className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-cyan-400" weight="duotone" />
              {selectedAgent.name}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <div className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-cyan-400" weight="duotone" />
              <span>{agent.name}</span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                agent.status === 'active' && "bg-green-500/20 text-green-400",
                agent.status === 'pending' && "bg-yellow-500/20 text-yellow-400",
                agent.status === 'paused' && "bg-orange-500/20 text-orange-400",
              )}>
                {agent.status}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
