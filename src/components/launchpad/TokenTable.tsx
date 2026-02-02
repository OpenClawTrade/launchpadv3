import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  BarChart3,
  ExternalLink,
  Copy,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Users,
  Flame,
  Megaphone,
  Crown,
  Gem,
  Bot,
} from "lucide-react";

interface Token {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  mint_address: string | null;
  market_cap_sol?: number | null;
  price_sol?: number;
  price_change_24h?: number | null;
  volume_24h_sol?: number;
  holder_count?: number | null;
  bonding_progress?: number | null;
  created_at?: string | null;
  fee_mode?: string | null; // 'standard' or 'holders'
  agent_id?: string | null;
}

interface TokenTableProps {
  tokens: Token[];
  isLoading: boolean;
  solPrice: number | null;
  promotedTokenIds?: Set<string>;
  onPromote?: (tokenId: string, name: string, ticker: string) => void;
}

export function TokenTable({ tokens, isLoading, solPrice, promotedTokenIds, onPromote }: TokenTableProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const pageSize = 15;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatUsdMarketCap = (mcapSol: number | null | undefined) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const totalPages = Math.ceil(tokens.length / pageSize);
  const paginatedTokens = tokens.slice((page - 1) * pageSize, page * pageSize);

  const MobileTokenCard = ({ token, index }: { token: Token; index: number }) => {
    const isNearGraduation = (token.bonding_progress ?? 0) >= 80;
    const isPromoted = promotedTokenIds?.has(token.id) || false;
    const isHolderRewards = token.fee_mode === 'holders';

    return (
      <Link
        to={token.agent_id ? `/t/${token.ticker}` : `/launchpad/${token.mint_address}`}
        className={`block p-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors ${isPromoted ? "ring-2 ring-warning/50 ring-inset bg-warning/5" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className={`gate-token-avatar flex-shrink-0 ${isPromoted ? "ring-2 ring-warning" : ""}`}>
            {token.image_url ? (
              <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                {token.ticker?.slice(0, 2)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground truncate flex items-center gap-1">
                {token.name}
                {isNearGraduation && <Flame className="h-3 w-3 text-orange-500 flex-shrink-0" />}
                {isPromoted && <Crown className="h-3 w-3 text-warning flex-shrink-0" />}
                                {(token.fee_mode === "holder_rewards" || token.fee_mode === "holders") && (
                                  <span title="Holder Rewards" aria-label="Holder Rewards">
                                    <Gem className="h-3 w-3 text-accent flex-shrink-0" />
                                  </span>
                                )}
                                {token.agent_id && (
                                  <Link 
                                    to={`/t/${token.ticker}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="AI Agent Token"
                                    className="flex-shrink-0"
                                  >
                                    <Bot className="h-3 w-3 text-purple-400 hover:text-purple-300" />
                                  </Link>
                                )}
                              </span>
              <span className="text-xs text-muted-foreground">${token.ticker}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{token.created_at ? formatDistanceToNow(new Date(token.created_at), { addSuffix: false }) : "-"}</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {token.holder_count ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={token.bonding_progress ?? 0} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground w-10 text-right">{(token.bonding_progress ?? 0).toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="font-semibold text-sm">{formatUsdMarketCap(token.market_cap_sol)}</span>
            {token.price_change_24h != null ? (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${token.price_change_24h > 0 ? "text-primary" : token.price_change_24h < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {token.price_change_24h > 0 && <TrendingUp className="h-3 w-3" />}
                {token.price_change_24h < 0 && <TrendingDown className="h-3 w-3" />}
                {token.price_change_24h === 0 ? "0%" : `${token.price_change_24h > 0 ? "+" : ""}${token.price_change_24h.toFixed(1)}%`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">0%</span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  const MobileLoadingSkeleton = () => (
    <div className="p-3 border-b border-border">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );

  return (
    <Card className="gate-card">
      <div className="gate-card-header">
        <h2 className="gate-card-title">
          <BarChart3 className="h-5 w-5 text-primary" />
          Live Tokens
        </h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Real-time</span>
        </div>
      </div>

      {isMobile ? (
        <div className="divide-y divide-border">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => <MobileLoadingSkeleton key={i} />)
          ) : paginatedTokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No tokens launched yet. Be the first!</div>
          ) : (
            paginatedTokens.map((token, index) => <MobileTokenCard key={token.id} token={token} index={(page - 1) * pageSize + index} />)
          )}
        </div>
      ) : (
        <div className="gate-table-wrapper">
          <table className="gate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Token</th>
                <th>Age</th>
                <th>24h</th>
                <th>Market Cap</th>
                <th>Holders</th>
                <th>Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td><Skeleton className="h-4 w-6" /></td>
                    <td><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-4 w-24" /></div></td>
                    <td><Skeleton className="h-4 w-10" /></td>
                    <td><Skeleton className="h-4 w-12" /></td>
                    <td><Skeleton className="h-4 w-16" /></td>
                    <td><Skeleton className="h-4 w-10" /></td>
                    <td><Skeleton className="h-2 w-24" /></td>
                    <td><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : paginatedTokens.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No tokens launched yet. Be the first!</td></tr>
              ) : (
                paginatedTokens.map((token, index) => {
                  const isNearGraduation = (token.bonding_progress ?? 0) >= 80;
                  const isPromoted = promotedTokenIds?.has(token.id) || false;
                  const isHolderRewards = token.fee_mode === 'holders';
                  return (
                    <tr key={token.id} className={isPromoted ? "ring-2 ring-warning/30 ring-inset bg-warning/5" : ""}>
                      <td className="text-muted-foreground font-medium">{(page - 1) * pageSize + index + 1}</td>
                      <td>
                        <Link to={token.agent_id ? `/t/${token.ticker}` : `/launchpad/${token.mint_address}`} className="gate-token-row hover:opacity-80 transition-opacity">
                          <div className={`gate-token-avatar ${isPromoted ? "ring-2 ring-warning" : ""}`}>
                            {token.image_url ? <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{token.ticker?.slice(0, 2)}</div>}
                          </div>
                          <div className="gate-token-info">
                            <span className="gate-token-name flex items-center gap-1">
                              {token.name}
                              {isNearGraduation && <Flame className="h-3 w-3 text-orange-500" />}
                              {isPromoted && <Crown className="h-3 w-3 text-warning" />}
                              {(token.fee_mode === "holder_rewards" || token.fee_mode === "holders") && (
                                <span title="Holder Rewards" aria-label="Holder Rewards">
                                  <Gem className="h-3 w-3 text-accent" />
                                </span>
                              )}
                              {token.agent_id && (
                                <Link 
                                  to={`/t/${token.ticker}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="AI Agent Token"
                                >
                                  <Bot className="h-3 w-3 text-purple-400 hover:text-purple-300" />
                                </Link>
                              )}
                            </span>
                            <span className="gate-token-ticker">${token.ticker}</span>
                          </div>
                        </Link>
                      </td>
                      <td><span className="text-muted-foreground text-xs">{token.created_at ? formatDistanceToNow(new Date(token.created_at), { addSuffix: false }) : "-"}</span></td>
                      <td>{token.price_change_24h != null ? <span className={`flex items-center gap-1 font-medium ${token.price_change_24h > 0 ? "text-primary" : token.price_change_24h < 0 ? "text-destructive" : "text-muted-foreground"}`}>{token.price_change_24h > 0 && <TrendingUp className="h-3 w-3" />}{token.price_change_24h < 0 && <TrendingDown className="h-3 w-3" />}{token.price_change_24h === 0 ? "0.0%" : `${token.price_change_24h > 0 ? "+" : ""}${token.price_change_24h.toFixed(1)}%`}</span> : <span className="text-muted-foreground">0.0%</span>}</td>
                      <td><span className="font-semibold text-foreground">{formatUsdMarketCap(token.market_cap_sol)}</span></td>
                      <td><span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" />{token.holder_count ?? 0}</span></td>
                      <td><div className="flex items-center gap-2 min-w-[100px]"><Progress value={token.bonding_progress ?? 0} className="h-1.5 flex-1" /><span className="text-xs text-muted-foreground w-10 text-right">{(token.bonding_progress ?? 0).toFixed(0)}%</span></div></td>
                      <td>
                        <div className="flex items-center gap-1">
                          {token.mint_address && (
                            <>
                              <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); copyToClipboard(token.mint_address!); }} className="gate-copy-btn h-7 w-7 p-0">{copiedAddress === token.mint_address ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                              <a href={`https://solscan.io/token/${token.mint_address}`} target="_blank" rel="noopener noreferrer" className="gate-copy-btn p-1 rounded" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" /></a>
                              {!isPromoted && onPromote && <Button variant="ghost" size="sm" onClick={(e) => { e.preventDefault(); onPromote(token.id, token.name, token.ticker); }} className="gate-copy-btn h-7 w-7 p-0 text-warning hover:text-warning hover:bg-warning/10" title="Promote"><Megaphone className="h-3.5 w-3.5" /></Button>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="gate-pagination flex-wrap gap-2">
          <span className="gate-pagination-info text-xs sm:text-sm">Page {page} of {totalPages} ({tokens.length} tokens)</span>
          <div className="gate-pagination-buttons">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gate-page-btn"><ChevronLeft className="h-4 w-4" /> Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="gate-page-btn">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </Card>
  );
}
