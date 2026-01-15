import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SniperTrade {
  id: string;
  mint_address: string;
  pool_address: string;
  status: string;
  buy_amount_sol: number;
  tokens_received: number | null;
  sol_received: number | null;
  buy_signature: string | null;
  sell_signature: string | null;
  error_message: string | null;
  created_at: string;
  bought_at: string | null;
  sold_at: string | null;
}

export function SniperStatusPanel() {
  const [trades, setTrades] = useState<SniperTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchTrades = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sniper_trades")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("[SniperStatusPanel] Error fetching trades:", error);
      } else {
        setTrades(data || []);
      }
    } catch (err) {
      console.error("[SniperStatusPanel] Fetch error:", err);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    fetchTrades();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchTrades, 10000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("sniper_trades_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sniper_trades",
        },
        (payload) => {
          console.log("[SniperStatusPanel] Realtime update:", payload);
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "bought":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Bought
          </Badge>
        );
      case "sold":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sold
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-400">
            {status}
          </Badge>
        );
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const successCount = trades.filter(t => t.status === "sold").length;
  const failedCount = trades.filter(t => t.status === "failed").length;
  const pendingCount = trades.filter(t => t.status === "pending" || t.status === "bought").length;
  const totalProfit = trades
    .filter(t => t.status === "sold")
    .reduce((sum, t) => sum + (t.sol_received || 0) - t.buy_amount_sol, 0);

  return (
    <Card className="bg-[#12121a] border-[#1a1a1f] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Bot className="h-4 w-4 text-purple-400" />
          Sniper Status
          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
            ADMIN
          </Badge>
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTrades}
          disabled={isLoading}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-[#0d0d0f] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-lg font-bold text-white">{trades.length}</div>
        </div>
        <div className="bg-[#0d0d0f] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Success</div>
          <div className="text-lg font-bold text-green-400">{successCount}</div>
        </div>
        <div className="bg-[#0d0d0f] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Failed</div>
          <div className="text-lg font-bold text-red-400">{failedCount}</div>
        </div>
        <div className="bg-[#0d0d0f] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">P/L SOL</div>
          <div className={`text-lg font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoading && trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading trades...
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No sniper trades yet
          </div>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.id}
              className="bg-[#0d0d0f] rounded-lg p-3 border border-[#1a1a1f]"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusBadge(trade.status)}
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {trade.buy_amount_sol} SOL
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Mint: </span>
                  <a
                    href={`https://solscan.io/token/${trade.mint_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    {shortenAddress(trade.mint_address)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <span className="text-gray-500">Pool: </span>
                  <a
                    href={`https://solscan.io/account/${trade.pool_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    {shortenAddress(trade.pool_address)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {trade.buy_signature && (
                <div className="text-xs mt-1">
                  <span className="text-gray-500">Buy TX: </span>
                  <a
                    href={`https://solscan.io/tx/${trade.buy_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:underline inline-flex items-center gap-1"
                  >
                    {shortenAddress(trade.buy_signature)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {trade.tokens_received && (
                    <span className="text-gray-400 ml-2">
                      ({trade.tokens_received.toLocaleString()} tokens)
                    </span>
                  )}
                </div>
              )}

              {trade.sell_signature && (
                <div className="text-xs mt-1">
                  <span className="text-gray-500">Sell TX: </span>
                  <a
                    href={`https://solscan.io/tx/${trade.sell_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:underline inline-flex items-center gap-1"
                  >
                    {shortenAddress(trade.sell_signature)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {trade.sol_received && (
                    <span className="text-gray-400 ml-2">
                      ({trade.sol_received.toFixed(4)} SOL)
                    </span>
                  )}
                </div>
              )}

              {trade.error_message && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="break-all">{trade.error_message}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="text-xs text-gray-500 text-center mt-3">
        Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
      </div>
    </Card>
  );
}
