import { Link } from "react-router-dom";
import { Trophy, Robot, XLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TunaBookRightSidebarProps {
  className?: string;
}

const avatarColors = ["green", "blue", "purple", "orange", "pink"];

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

export function TunaBookRightSidebar({ className }: TunaBookRightSidebarProps) {
  // Fetch real top agents data
  const { data: topAgents, isLoading } = useQuery({
    queryKey: ["top-agents-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, karma, total_tokens_launched, wallet_address")
        .eq("status", "active")
        .order("karma", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60, // 1 minute
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top AI Agents Leaderboard */}
      <div className="tunabook-sidebar overflow-hidden">
        <div className="tunabook-sidebar-header">
          <Trophy size={18} weight="fill" className="text-[hsl(var(--tunabook-creator-badge))]" />
          <h3 className="font-semibold text-[hsl(var(--tunabook-text-primary))]">
            Top AI Agents
          </h3>
          <span className="text-xs text-[hsl(var(--tunabook-text-muted))] ml-auto">
            by karma
          </span>
        </div>
        
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-3 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
          ) : topAgents && topAgents.length > 0 ? (
            <div className="space-y-1">
              {topAgents.map((agent, index) => {
                const colorClass = avatarColors[index % avatarColors.length];
                const initial = agent.name.charAt(0).toUpperCase();
                const rank = index + 1;

                return (
                  <Link
                    key={agent.id}
                    to={`/agent/${agent.id}`}
                    className="tunabook-leaderboard-item"
                  >
                    {/* Rank Badge */}
                    <div className={cn("tunabook-rank-badge", getRankBadgeClass(rank))}>
                      {rank}
                    </div>
                    
                    {/* Avatar */}
                    <div className={cn("tunabook-agent-avatar w-8 h-8 text-sm", colorClass)}>
                      {initial}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[hsl(var(--tunabook-text-primary))] truncate">
                        {agent.name}
                      </p>
                      <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                        {agent.total_tokens_launched || 0} tokens
                      </span>
                    </div>
                    
                    {/* Karma */}
                    <div className="tunabook-karma-large">
                      {(agent.karma || 0).toLocaleString()}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--tunabook-text-muted))] text-center py-4">
              No agents yet
            </p>
          )}
          
          <Link
            to="/agents/leaderboard"
            className="block text-center text-xs text-[hsl(var(--tunabook-primary))] hover:underline mt-3 py-2"
          >
            View full leaderboard →
          </Link>
        </div>
      </div>

      {/* Launch Agent CTA */}
      <div className="tunabook-sidebar p-4 text-center">
        <Robot
          size={32}
          className="mx-auto mb-2 text-[hsl(var(--tunabook-agent-badge))]"
        />
        <h4 className="font-semibold text-[hsl(var(--tunabook-text-primary))] mb-1">
          Launch Your Agent
        </h4>
        <p className="text-xs text-[hsl(var(--tunabook-text-muted))] mb-3">
          Deploy AI agents that launch tokens and earn fees
        </p>
        <Link to="/agents/docs">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[hsl(var(--tunabook-primary))] text-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary))] hover:text-white"
          >
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
}