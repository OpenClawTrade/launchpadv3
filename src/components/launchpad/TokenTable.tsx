import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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
}

interface TokenTableProps {
  tokens: Token[];
  isLoading: boolean;
  solPrice: number | null;
}

export function TokenTable({ tokens, isLoading, solPrice }: TokenTableProps) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const pageSize = 15;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    toast({ title: "Copied!", description: "Address copied to clipboard" });
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const shortenAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const formatUsdMarketCap = (mcapSol: number | null) => {
    if (!mcapSol || !solPrice) return "$0";
    const usd = mcapSol * solPrice;
    if (usd >= 1000000) return `$${(usd / 1000000).toFixed(2)}M`;
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}K`;
    return `$${usd.toFixed(0)}`;
  };

  const totalPages = Math.ceil(tokens.length / pageSize);
  const paginatedTokens = tokens.slice((page - 1) * pageSize, page * pageSize);

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

      <div className="gate-table-wrapper">
        <table className="gate-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Token</th>
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
                  <td><Skeleton className="h-4 w-12" /></td>
                  <td><Skeleton className="h-4 w-16" /></td>
                  <td><Skeleton className="h-4 w-10" /></td>
                  <td><Skeleton className="h-2 w-24" /></td>
                  <td><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : paginatedTokens.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No tokens launched yet. Be the first!
                </td>
              </tr>
            ) : (
              paginatedTokens.map((token, index) => {
                const isNearGraduation = (token.bonding_progress ?? 0) >= 80;

                return (
                  <tr key={token.id}>
                    <td className="text-muted-foreground font-medium">{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <Link to={`/launchpad/${token.mint_address}`} className="gate-token-row hover:opacity-80 transition-opacity">
                        <div className="gate-token-avatar">
                          {token.image_url ? (
                            <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {token.ticker?.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        <div className="gate-token-info">
                          <span className="gate-token-name flex items-center gap-1">
                            {token.name}
                            {isNearGraduation && <Flame className="h-3 w-3 text-orange-500" />}
                          </span>
                          <span className="gate-token-ticker">${token.ticker}</span>
                        </div>
                      </Link>
                    </td>
                    <td>
                      {token.price_change_24h != null && token.price_change_24h !== 0 ? (
                        <span className={`flex items-center gap-1 font-medium ${token.price_change_24h > 0 ? "text-green-500" : "text-red-500"}`}>
                          {token.price_change_24h > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(token.price_change_24h).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold text-foreground">{formatUsdMarketCap(token.market_cap_sol)}</span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {token.holder_count ?? 0}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={token.bonding_progress ?? 0} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {(token.bonding_progress ?? 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        {token.mint_address && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(token.mint_address!)}
                              className="gate-copy-btn h-7 w-7 p-0"
                            >
                              {copiedAddress === token.mint_address ? (
                                <CheckCircle className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <a
                              href={`https://solscan.io/token/${token.mint_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="gate-copy-btn p-1 rounded"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="gate-pagination">
          <span className="gate-pagination-info">
            Page {page} of {totalPages} ({tokens.length} tokens)
          </span>
          <div className="gate-pagination-buttons">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="gate-page-btn"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="gate-page-btn"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
