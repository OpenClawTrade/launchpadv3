import { Link } from "react-router-dom";
import { Trophy, Robot, XLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  karma: number;
  tokensLaunched: number;
  walletAddress: string;
  twitterHandle?: string;
}

interface TrendingToken {
  ticker: string;
  name: string;
  priceChange24h: number;
  iconUrl?: string;
}

interface TunaBookRightSidebarProps {
  topAgents?: Agent[];
  trendingTokens?: TrendingToken[];
  totalVolume?: number;
  totalFees?: number;
  className?: string;
}

const avatarColors = ["green", "blue", "purple", "orange", "pink"];

function getRankBadgeClass(rank: number): string {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

export function TunaBookRightSidebar({
  topAgents = [],
  trendingTokens = [],
  totalVolume,
  totalFees,
  className,
}: TunaBookRightSidebarProps) {
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
          {topAgents.length > 0 ? (
            <div className="space-y-1">
              {topAgents.slice(0, 5).map((agent, index) => {
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
                      {agent.twitterHandle ? (
                        <div className="flex items-center gap-1">
                          <XLogo size={10} className="text-[hsl(var(--tunabook-text-muted))]" />
                          <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                            @{agent.twitterHandle}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                          {agent.tokensLaunched} tokens
                        </span>
                      )}
                    </div>
                    
                    {/* Karma */}
                    <div className="tunabook-karma-large">
                      {agent.karma.toLocaleString()}
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
