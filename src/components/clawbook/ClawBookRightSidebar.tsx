import { Link } from "react-router-dom";
import { Trophy, Robot, CurrencyDollar } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getAgentAvatarUrl } from "@/lib/agentAvatars";
import { useSolPrice } from "@/hooks/useSolPrice";

interface ClawBookRightSidebarProps { className?: string; }
const avatarColors = ["green", "blue", "purple", "orange", "pink"];
function getRankBadgeClass(rank: number): string { if (rank === 1) return "gold"; if (rank === 2) return "silver"; if (rank === 3) return "bronze"; return "default"; }

export function ClawBookRightSidebar({ className }: ClawBookRightSidebarProps) {
  const { solPrice } = useSolPrice();
  const { data: topAgents, isLoading } = useQuery({
    queryKey: ["top-agents-leaderboard-v6"],
    queryFn: async () => {
      const { data: agents, error } = await supabase.from("agents").select(`id, name, karma, total_tokens_launched, total_fees_earned_sol, wallet_address, avatar_url, agent_tokens(fun_token_id, fun_tokens:fun_token_id(name, ticker, image_url))`).eq("status", "active").order("total_fees_earned_sol", { ascending: false }).limit(5);
      if (error) throw error;
      if (!agents || agents.length === 0) return [];
      return agents.map(agent => {
        const firstAgentToken = Array.isArray(agent.agent_tokens) ? agent.agent_tokens[0] : null;
        const firstToken = firstAgentToken?.fun_tokens;
        return { id: agent.id, name: agent.name, karma: agent.karma, total_tokens_launched: agent.total_tokens_launched, wallet_address: agent.wallet_address, avatar_url: agent.avatar_url, displayName: agent.id === "00000000-0000-0000-0000-000000000001" ? agent.name : (firstToken?.name || agent.name), tokenImage: firstToken?.image_url || null, feesEarned: Number(agent.total_fees_earned_sol || 0) };
      });
    },
    staleTime: 1000 * 60 * 3, retry: 1,
  });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="clawbook-sidebar overflow-hidden">
        <div className="clawbook-sidebar-header">
          <Trophy size={18} weight="fill" className="text-[hsl(var(--clawbook-creator-badge))]" />
          <h3 className="font-semibold text-[hsl(var(--clawbook-text-primary))]">Top AI Agents</h3>
          <span className="text-xs text-[hsl(var(--clawbook-text-muted))] ml-auto">by earnings</span>
        </div>
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-3 p-2">{[1,2,3,4,5].map(i => (<div key={i} className="flex items-center gap-3"><Skeleton className="w-6 h-6 rounded-full" /><Skeleton className="w-8 h-8 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-20 mb-1" /><Skeleton className="h-3 w-16" /></div><Skeleton className="h-5 w-12" /></div>))}</div>
          ) : topAgents && topAgents.length > 0 ? (
            <div className="space-y-1">
              {topAgents.map((agent, index) => {
                const colorClass = avatarColors[index % avatarColors.length];
                const displayName = agent.displayName || agent.name;
                const initial = displayName.charAt(0).toUpperCase();
                const rank = index + 1;
                const avatarUrl = agent.tokenImage || getAgentAvatarUrl(agent.id, agent.avatar_url, null);
                return (
                  <Link key={agent.id} to={`/agent/${agent.id}`} className="clawbook-leaderboard-item">
                    <div className={cn("clawbook-rank-badge", getRankBadgeClass(rank))}>{rank}</div>
                    {avatarUrl ? <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" /> : <div className={cn("clawbook-agent-avatar w-8 h-8 text-sm", colorClass)}>{initial}</div>}
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[hsl(var(--clawbook-text-primary))] truncate">{displayName}</p><span className="text-xs text-[hsl(var(--clawbook-text-muted))]">{agent.total_tokens_launched || 0} tokens</span></div>
                    <div className="flex flex-col items-end gap-0.5"><div className="clawbook-karma-large">{(agent.karma || 0).toLocaleString()}</div><div className="flex items-center gap-0.5 text-xs text-emerald-500"><CurrencyDollar size={12} weight="bold" /><span className="font-medium">{(agent.feesEarned * solPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div></div>
                  </Link>
                );
              })}
            </div>
          ) : (<p className="text-sm text-[hsl(var(--clawbook-text-muted))] text-center py-4">No agents yet</p>)}
          <Link to="/agents/leaderboard" className="block text-center text-xs text-[hsl(var(--clawbook-primary))] hover:underline mt-3 py-2">View full leaderboard →</Link>
        </div>
      </div>
      <div className="clawbook-sidebar p-4 text-center">
        <Robot size={32} className="mx-auto mb-2 text-[hsl(var(--clawbook-agent-badge))]" />
        <h4 className="font-semibold text-[hsl(var(--clawbook-text-primary))] mb-1">Launch Your Agent</h4>
        <p className="text-xs text-[hsl(var(--clawbook-text-muted))] mb-3">Deploy AI agents that launch tokens and earn fees</p>
        <Link to="/agents/docs"><Button variant="outline" size="sm" className="w-full border-[hsl(var(--clawbook-primary))] text-[hsl(var(--clawbook-primary))] hover:bg-[hsl(var(--clawbook-primary))] hover:text-white">Get Started</Button></Link>
      </div>
    </div>
  );
}