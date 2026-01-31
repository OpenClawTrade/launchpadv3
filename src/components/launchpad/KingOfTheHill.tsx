import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Crown, Copy, CheckCircle, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSolPrice } from "@/hooks/useSolPrice";

interface KingToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  dbc_pool_address: string | null;
  real_sol_reserves: number;
  graduation_threshold_sol: number;
  bonding_curve_progress: number;
  holder_count: number;
  market_cap_sol: number;
  created_at: string;
}

function useKingOfTheHill() {
  return useQuery({
    queryKey: ["king-of-the-hill"],
    queryFn: async (): Promise<KingToken[]> => {
      // Get top 3 active tokens with highest bonding progress (closest to graduation)
      const { data, error } = await supabase
        .from("fun_tokens")
        .select(`
          id,
          name,
          ticker,
          image_url,
          mint_address,
          dbc_pool_address,
          bonding_progress,
          holder_count,
          market_cap_sol,
          created_at
        `)
        .eq("status", "active")
        .order("bonding_progress", { ascending: false })
        .limit(3);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const graduationThreshold = 85; // Default threshold in SOL
      
      // Map to our interface
      const tokens: KingToken[] = data.map((token) => {
        // bonding_progress in DB is stored as a decimal (0-1 range representing percentage/100)
        // Convert to percentage for display
        const progressPercent = (token.bonding_progress || 0) * 100;
        
        // Calculate real SOL reserves from progress
        const realSolReserves = (token.bonding_progress || 0) * graduationThreshold;

        return {
          id: token.id,
          name: token.name,
          ticker: token.ticker,
          image_url: token.image_url,
          mint_address: token.mint_address,
          dbc_pool_address: token.dbc_pool_address,
          real_sol_reserves: realSolReserves,
          graduation_threshold_sol: graduationThreshold,
          bonding_curve_progress: progressPercent,
          holder_count: token.holder_count || 0,
          market_cap_sol: token.market_cap_sol || 0,
          created_at: token.created_at || new Date().toISOString(),
        };
      });

      return tokens;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  });
}

function TokenCard({ token, rank }: { token: KingToken; rank: number }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { solPrice } = useSolPrice();

  const copyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (token.mint_address) {
      navigator.clipboard.writeText(token.mint_address);
      setCopied(true);
      toast({ title: "Copied!", description: "Contract address copied" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const progress = token.bonding_curve_progress;
  const marketCapUsd = token.market_cap_sol * (solPrice || 0);

  const getRankStyles = (r: number) => {
    if (r === 1) return "border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/10";
    if (r === 2) return "border-border/50 bg-card/80";
    return "border-border/50 bg-card/80";
  };

  const getRankBadgeStyles = (r: number) => {
    if (r === 1) return "bg-primary text-primary-foreground";
    if (r === 2) return "bg-muted-foreground/80 text-background";
    return "bg-amber-700 text-white";
  };

  return (
    <Link
      to={`/launchpad/${token.mint_address || token.dbc_pool_address || token.id}`}
      className={cn(
        "relative flex flex-col p-2 sm:p-4 rounded-lg sm:rounded-xl border transition-all duration-200 hover:scale-[1.02] hover:shadow-xl group",
        getRankStyles(rank)
      )}
    >
      {/* Rank Badge - positioned top-left to avoid CA button overlap */}
      <div 
        className={cn(
          "absolute -top-1.5 -left-1.5 sm:-top-2 sm:-left-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold shadow-md z-10",
          getRankBadgeStyles(rank)
        )}
      >
        #{rank}
      </div>

      {/* Header: Image + Name + CA */}
      <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
        <div className="relative flex-shrink-0">
          {token.image_url ? (
            <img
              src={token.image_url}
              alt={token.name}
              className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg object-cover border border-border/50"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          ) : (
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg bg-primary/20 flex items-center justify-center text-xs sm:text-sm font-bold text-primary">
              {token.ticker?.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {token.name}
          </h3>
          <span className="text-[10px] sm:text-xs text-muted-foreground">${token.ticker}</span>
        </div>

        {/* Copy CA Button - hidden on very small screens */}
        <button
          onClick={copyAddress}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/80 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title="Copy contract address"
        >
          {copied ? (
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>CA</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mb-2 sm:mb-3 text-[10px] sm:text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">MC:</span>
          <span className="font-semibold text-primary">
            ${marketCapUsd >= 1000 ? `${(marketCapUsd / 1000).toFixed(1)}K` : marketCapUsd.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-semibold">{token.holder_count}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-2 sm:mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] sm:text-xs text-muted-foreground">Progress</span>
          <span className={cn(
            "text-[10px] sm:text-sm font-bold",
            progress >= 50 ? "text-primary" : "text-foreground"
          )}>
            {progress.toFixed(1)}%
          </span>
        </div>
        <Progress 
          value={Math.min(progress, 100)} 
          className={cn(
            "h-1.5 sm:h-2",
            progress >= 80 && "shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
          )}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] sm:text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          <span className="truncate">{formatDistanceToNow(new Date(token.created_at), { addSuffix: true })}</span>
        </div>
        <span className="font-medium tabular-nums hidden sm:inline">
          {token.real_sol_reserves.toFixed(2)} / {token.graduation_threshold_sol} SOL
        </span>
      </div>
    </Link>
  );
}

export function KingOfTheHill() {
  const { data: tokens, isLoading, error } = useKingOfTheHill();

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold">King of the Hill</h2>
          <span className="text-sm text-muted-foreground hidden sm:inline">— Soon to Graduate</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 sm:p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                <Skeleton className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
                  <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
                  <Skeleton className="h-2 sm:h-3 w-10 sm:w-16" />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <Skeleton className="h-3 sm:h-4 w-full" />
                <Skeleton className="h-1.5 sm:h-2 w-full" />
                <Skeleton className="h-2 sm:h-3 w-20 sm:w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!tokens || tokens.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-yellow-500" />
        <h2 className="text-lg font-bold">King of the Hill</h2>
        <span className="text-sm text-muted-foreground hidden sm:inline">— Soon to Graduate</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tokens.map((token, index) => (
          <TokenCard key={token.id} token={token} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}
