import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AgentBadge } from "./AgentBadge";
import { PumpBadge } from "./PumpBadge";
import { TrendUp, Users, Coins, Rocket, ArrowSquareOut, Robot } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface TokenStatsHeaderProps {
  ticker: string;
  tokenName?: string;
  imageUrl?: string;
  marketCapSol?: number;
  marketCapUsd?: number;
  holderCount?: number;
  bondingProgress?: number;
  totalFeesEarned?: number;
  mintAddress?: string;
  launchpadType?: string;
  isAgent?: boolean;
  status?: string;
  tradingAgentId?: string;
  // Live pool data override
  livePoolData?: {
    bondingProgress: number;
    realSolReserves: number;
    graduationThreshold: number;
    isGraduated: boolean;
  };
  solPrice?: number;
}

export function TokenStatsHeader({
  ticker,
  tokenName,
  imageUrl,
  marketCapSol,
  marketCapUsd,
  holderCount,
  bondingProgress,
  totalFeesEarned,
  mintAddress,
  launchpadType,
  isAgent,
  status,
  tradingAgentId,
  livePoolData,
  solPrice,
}: TokenStatsHeaderProps) {
  // Use live pool data for bonding progress if available
  const effectiveBondingProgress = livePoolData?.bondingProgress ?? bondingProgress ?? 0;
  const isGraduated = livePoolData?.isGraduated || status === "graduated" || effectiveBondingProgress >= 100;
  const isPumpfun = launchpadType === "pumpfun";

  // Calculate USD values if we have SOL price
  const feesUsd = totalFeesEarned && solPrice ? totalFeesEarned * solPrice : undefined;
  const displayMarketCapUsd = marketCapUsd || (marketCapSol && solPrice ? marketCapSol * solPrice : undefined);

  return (
    <Card className="bg-[hsl(var(--tunabook-bg-card))] border-[hsl(var(--tunabook-border))] p-4">
      {/* Token header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={ticker}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-lg font-bold text-[hsl(var(--tunabook-primary))] flex-shrink-0">
              {ticker?.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[hsl(var(--tunabook-text-primary))] truncate">
                ${ticker}
              </span>
              {isAgent && <AgentBadge />}
              {isPumpfun && <PumpBadge showText={false} size="sm" mintAddress={mintAddress} />}
            </div>
            {tokenName && (
              <span className="text-xs text-[hsl(var(--tunabook-text-muted))] truncate block">{tokenName}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {tradingAgentId && (
            <Link to={`/agents/trading/${tradingAgentId}`}>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 text-xs"
              >
                <Robot size={14} className="mr-1" />
                <span className="hidden xs:inline">Trading</span> Agent
              </Button>
            </Link>
          )}
          {mintAddress && (
            <Link to={`/launchpad/${mintAddress}`}>
              <Button
                size="sm"
                className="bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))] text-[hsl(var(--tunabook-text-primary))] text-xs"
              >
                Trade
                <ArrowSquareOut size={14} className="ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Market Cap */}
        <StatCard
          icon={<TrendUp size={18} className="text-[hsl(var(--tunabook-primary))]" />}
          label="Market Cap"
          value={
            displayMarketCapUsd
              ? displayMarketCapUsd >= 1000000
                ? `$${(displayMarketCapUsd / 1000000).toFixed(2)}M`
                : `$${displayMarketCapUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : marketCapSol
                ? `${marketCapSol.toFixed(2)} SOL`
                : "---"
          }
          subValue={marketCapSol ? `${marketCapSol.toFixed(2)} SOL` : undefined}
        />

        {/* Holders */}
        <StatCard
          icon={<Users size={18} className="text-[hsl(var(--tunabook-primary))]" />}
          label="Holders"
          value={holderCount?.toLocaleString() || "---"}
        />

        {/* Bonding Progress */}
        <div className="p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
          <div className="flex items-center gap-1.5 mb-1">
            <Rocket size={18} className={cn(
              isGraduated ? "text-[hsl(152_69%_41%)]" : "text-[hsl(var(--tunabook-primary))]"
            )} />
            <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
              {isGraduated ? "Graduated" : "Bonding"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress 
                value={Math.min(effectiveBondingProgress, 100)} 
                className={cn(
                  "h-2",
                  effectiveBondingProgress >= 80 && "shadow-[0_0_10px_hsl(152_69%_41%/0.3)]"
                )}
              />
            </div>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              isGraduated ? "text-[hsl(152_69%_41%)]" : "text-[hsl(var(--tunabook-text-primary))]"
            )}>
              {effectiveBondingProgress.toFixed(0)}%
            </span>
          </div>
          {livePoolData && !isGraduated && (
            <div className="text-[10px] text-[hsl(var(--tunabook-text-muted))] mt-1">
              {livePoolData.realSolReserves.toFixed(2)} / {livePoolData.graduationThreshold} SOL
            </div>
          )}
        </div>

        {/* Fees Earned */}
        <StatCard
          icon={<Coins size={18} className="text-[hsl(var(--tunabook-primary))]" />}
          label="Fees Earned"
          value={
            totalFeesEarned !== undefined
              ? `${totalFeesEarned.toFixed(4)} SOL`
              : "---"
          }
          subValue={feesUsd ? `$${feesUsd.toFixed(2)}` : undefined}
        />
      </div>
    </Card>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
}

function StatCard({ icon, label, value, subValue }: StatCardProps) {
  return (
    <div className="p-3 rounded-lg bg-[hsl(var(--tunabook-bg-elevated))]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">{label}</span>
      </div>
      <p className="text-sm font-bold text-[hsl(var(--tunabook-text-primary))] tabular-nums">
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-[hsl(var(--tunabook-text-muted))]">{subValue}</p>
      )}
    </div>
  );
}
