import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fish, Spinner } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ClawAgent {
  id: string;
  name: string;
  status: string;
  agent_type: string;
}

interface ClawSDKAgentSelectorProps {
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
  className?: string;
}

export default function ClawSDKAgentSelector({
  selectedAgentId,
  onSelect,
  className,
}: ClawSDKAgentSelectorProps) {
  const [agents, setAgents] = useState<ClawAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("opentuna_agents")
        .select("id, name, status, agent_type")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setAgents(data);
        // Auto-select first agent if none selected
        if (!selectedAgentId && data.length > 0) {
          onSelect(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Spinner className="h-4 w-4 animate-spin" />
        Loading agents...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Fish className="h-4 w-4" weight="duotone" />
        No agents found
      </div>
    );
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <Select value={selectedAgentId || undefined} onValueChange={onSelect}>
      <SelectTrigger className={cn("w-48 bg-secondary/50 border-primary/20", className)}>
        <SelectValue placeholder="Select agent">
          {selectedAgent && (
            <span className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-primary" weight="duotone" />
              {selectedAgent.name}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <div className="flex items-center gap-2">
              <Fish className="h-4 w-4 text-primary" weight="duotone" />
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
