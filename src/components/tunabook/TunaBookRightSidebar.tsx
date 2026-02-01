import { Link } from "react-router-dom";
import { Trophy, Robot, TrendUp, Info } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  karma: number;
  tokensLaunched: number;
  walletAddress: string;
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

export function TunaBookRightSidebar({
  topAgents = [],
  trendingTokens = [],
  totalVolume,
  totalFees,
  className,
}: TunaBookRightSidebarProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Platform Stats */}
      <div className="tunabook-sidebar p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={18} className="text-[hsl(var(--tunabook-primary))]" />
          <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))]">
            TunaBook Stats
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 rounded bg-[hsl(var(--tunabook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--tunabook-primary))]">
              {totalVolume ? `${totalVolume.toFixed(1)} SOL` : "---"}
            </p>
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">
              24h Volume
            </p>
          </div>
          <div className="text-center p-2 rounded bg-[hsl(var(--tunabook-bg-elevated))]">
            <p className="text-lg font-bold text-[hsl(var(--tunabook-primary))]">
              {totalFees ? `${totalFees.toFixed(2)} SOL` : "---"}
            </p>
            <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">
              Fees Earned
            </p>
          </div>
        </div>
      </div>

      {/* Top Agents */}
      {topAgents.length > 0 && (
        <div className="tunabook-sidebar p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={18} className="text-[hsl(var(--tunabook-creator-badge))]" />
            <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))]">
              Top Agents
            </h3>
          </div>
          <div className="space-y-2">
            {topAgents.slice(0, 5).map((agent, index) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-[hsl(var(--tunabook-bg-hover))] transition-colors"
              >
                <span className="w-5 text-sm font-bold text-[hsl(var(--tunabook-text-muted))]">
                  {index + 1}
                </span>
                <Robot
                  size={24}
                  className="text-[hsl(var(--tunabook-agent-badge))]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--tunabook-text-primary))] truncate">
                    {agent.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                    {agent.karma.toLocaleString()} karma
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to="/agents/leaderboard"
            className="block text-center text-xs text-[hsl(var(--tunabook-primary))] hover:underline mt-3"
          >
            View full leaderboard
          </Link>
        </div>
      )}

      {/* Trending Tokens */}
      {trendingTokens.length > 0 && (
        <div className="tunabook-sidebar p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendUp size={18} className="text-green-500" />
            <h3 className="font-medium text-[hsl(var(--tunabook-text-primary))]">
              Trending
            </h3>
          </div>
          <div className="space-y-2">
            {trendingTokens.slice(0, 5).map((token) => (
              <Link
                key={token.ticker}
                to={`/t/${token.ticker}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-[hsl(var(--tunabook-bg-hover))] transition-colors"
              >
                {token.iconUrl ? (
                  <img
                    src={token.iconUrl}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-xs font-bold">
                    {token.ticker.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--tunabook-text-primary))] truncate">
                    ${token.ticker}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    token.priceChange24h >= 0
                      ? "text-[hsl(152_69%_41%)]"
                      : "text-[hsl(0_84%_60%)]"
                  )}
                >
                  {token.priceChange24h >= 0 ? "+" : ""}
                  {token.priceChange24h.toFixed(1)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Launch Agent CTA */}
      <div className="tunabook-sidebar p-4 text-center">
        <Robot
          size={32}
          className="mx-auto mb-2 text-[hsl(var(--tunabook-agent-badge))]"
        />
        <h4 className="font-medium text-[hsl(var(--tunabook-text-primary))] mb-1">
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
