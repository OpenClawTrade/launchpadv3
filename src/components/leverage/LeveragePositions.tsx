import { cn } from "@/lib/utils";
import type { AsterPosition, AsterOpenOrder, AsterOrderHistory, AsterTradeHistory, AsterAccountInfo } from "@/hooks/useAsterAccount";
import { useState } from "react";
import { ExternalLink, RefreshCw, Settings } from "lucide-react";

type BottomTab = "positions" | "orders" | "order_history" | "trade_history" | "assets";

interface Props {
  positions: AsterPosition[];
  openOrders: AsterOpenOrder[];
  orderHistory: AsterOrderHistory[];
  tradeHistory: AsterTradeHistory[];
  account: AsterAccountInfo | null;
  onCancelOrder: (symbol: string, orderId: number) => void;
  onFetchOrderHistory: (symbol?: string) => void;
  onFetchTradeHistory: (symbol?: string) => void;
  onRefreshAccount: () => void;
  hasApiKey: boolean | null;
  symbol: string;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LeveragePositions({
  positions, openOrders, orderHistory, tradeHistory, account,
  onCancelOrder, onFetchOrderHistory, onFetchTradeHistory, onRefreshAccount,
  hasApiKey, symbol,
}: Props) {
  const [tab, setTab] = useState<BottomTab>("positions");

  const activePositions = positions.filter((p) => parseFloat(p.positionAmt) !== 0);

  if (!hasApiKey) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-6">
        Connect API key to view positions & account
      </div>
    );
  }

  const tabs: { key: BottomTab; label: string; count?: number }[] = [
    { key: "positions", label: "Positions", count: activePositions.length },
    { key: "orders", label: "Open Orders", count: openOrders.length },
    { key: "order_history", label: "Order History" },
    { key: "trade_history", label: "Trade History" },
    { key: "assets", label: "Assets" },
  ];

  return (
    <div className="flex h-full text-xs">
      {/* Left: Tabbed content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab header */}
        <div className="flex items-center gap-4 px-3 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === "order_history") onFetchOrderHistory(symbol);
                if (t.key === "trade_history") onFetchTradeHistory(symbol);
              }}
              className={cn(
                "py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {tab === "positions" && <PositionsTable positions={activePositions} />}
          {tab === "orders" && <OrdersTable orders={openOrders} onCancel={onCancelOrder} />}
          {tab === "order_history" && <OrderHistoryTable orders={orderHistory} />}
          {tab === "trade_history" && <TradeHistoryTable trades={tradeHistory} />}
          {tab === "assets" && <AssetsTable account={account} />}
        </div>
      </div>

      {/* Right: Account summary panel */}
      <div className="w-[240px] flex-shrink-0 border-l border-border bg-card/30 p-3 overflow-y-auto hidden lg:block">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-foreground">Account</span>
          <div className="flex items-center gap-1.5">
            <button onClick={onRefreshAccount} className="p-1 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" />
            </button>
            <a href="https://www.asterdex.com/en/futures/BTCUSDT" target="_blank" rel="noopener noreferrer"
              className="p-1 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Deposit/Withdraw/Transfer links */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          {["Deposit", "Withdraw", "Transfer"].map((label) => (
            <a
              key={label}
              href="https://www.asterdex.com/en/assets/overview"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "py-1.5 text-center text-[10px] font-medium rounded-sm transition-colors border border-border",
                label === "Deposit" ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              )}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Account Equity */}
        <div className="space-y-0.5 mb-3">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Account Equity</span>
          <AccountRow label="Wallet Balance" value={account?.totalWalletBalance} suffix=" USDT" />
          <AccountRow label="Unrealized PnL" value={account?.totalUnrealizedProfit} isPnl />
          <AccountRow label="Margin Balance" value={account?.totalMarginBalance} suffix=" USDT" />
          <AccountRow label="Available" value={account?.availableBalance} suffix=" USDT" highlight />
        </div>

        {/* Margin */}
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Margin</span>
          <AccountRow label="Initial Margin" value={account?.totalInitialMargin} suffix=" USDT" />
          <AccountRow label="Maint. Margin" value={account?.totalMaintMargin} suffix=" USDT" />
          {account?.totalMarginBalance && account?.totalMaintMargin && (
            <div className="flex justify-between text-[10px] py-0.5">
              <span className="text-muted-foreground">Margin Ratio</span>
              <span className={cn(
                "font-medium",
                parseFloat(account.totalMaintMargin) / parseFloat(account.totalMarginBalance) > 0.8 ? "text-red-400" : "text-green-400"
              )}>
                {((parseFloat(account.totalMaintMargin) / Math.max(parseFloat(account.totalMarginBalance), 0.001)) * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({ label, value, suffix, isPnl, highlight }: { label: string; value?: string; suffix?: string; isPnl?: boolean; highlight?: boolean }) {
  const num = parseFloat(value || "0");
  const display = value ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
  return (
    <div className="flex justify-between text-[10px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "tabular-nums",
        isPnl ? (num >= 0 ? "text-green-400" : "text-red-400") : highlight ? "text-primary font-medium" : "text-foreground"
      )}>
        {isPnl && num > 0 ? "+" : ""}{display}{suffix || ""}
      </span>
    </div>
  );
}

function PositionsTable({ positions }: { positions: AsterPosition[] }) {
  if (positions.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No open positions</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-right px-2 py-1.5">Size</th>
          <th className="text-right px-2 py-1.5">Entry</th>
          <th className="text-right px-2 py-1.5">Mark</th>
          <th className="text-right px-2 py-1.5">PnL</th>
          <th className="text-right px-2 py-1.5">Liq. Price</th>
          <th className="text-right px-3 py-1.5">Lev</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const pnl = parseFloat(p.unRealizedProfit);
          const amt = parseFloat(p.positionAmt);
          const isLong = amt > 0;
          return (
            <tr key={p.symbol + p.positionSide} className="border-b border-border/30 hover:bg-surface-hover/50">
              <td className="px-3 py-2">
                <span className="font-medium text-foreground">{p.symbol.replace("USDT", "")}</span>
                <span className={cn("ml-1 text-[10px] font-bold", isLong ? "text-green-400" : "text-red-400")}>
                  {isLong ? "LONG" : "SHORT"}
                </span>
              </td>
              <td className="text-right px-2 py-2 text-foreground tabular-nums">{Math.abs(amt)}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">${parseFloat(p.entryPrice).toLocaleString()}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">${parseFloat(p.markPrice).toLocaleString()}</td>
              <td className={cn("text-right px-2 py-2 font-medium tabular-nums", pnl >= 0 ? "text-green-400" : "text-red-400")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </td>
              <td className="text-right px-2 py-2 text-foreground/50 tabular-nums">${parseFloat(p.liquidationPrice).toLocaleString()}</td>
              <td className="text-right px-3 py-2 text-primary font-medium">{p.leverage}x</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OrdersTable({ orders, onCancel }: { orders: AsterOpenOrder[]; onCancel: (symbol: string, orderId: number) => void }) {
  if (orders.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No open orders</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-left px-2 py-1.5">Type</th>
          <th className="text-left px-2 py-1.5">Side</th>
          <th className="text-right px-2 py-1.5">Price</th>
          <th className="text-right px-2 py-1.5">Qty</th>
          <th className="text-right px-2 py-1.5">Time</th>
          <th className="text-right px-3 py-1.5"></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.orderId} className="border-b border-border/30 hover:bg-surface-hover/50">
            <td className="px-3 py-2 font-medium text-foreground">{o.symbol.replace("USDT", "")}</td>
            <td className="px-2 py-2 text-muted-foreground">{o.type}</td>
            <td className={cn("px-2 py-2 font-medium", o.side === "BUY" ? "text-green-400" : "text-red-400")}>{o.side}</td>
            <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(o.price).toLocaleString()}</td>
            <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{o.origQty}</td>
            <td className="text-right px-2 py-2 text-muted-foreground tabular-nums">{formatTime(o.time)}</td>
            <td className="text-right px-3 py-2">
              <button onClick={() => onCancel(o.symbol, o.orderId)} className="text-red-400 hover:text-red-300 text-[10px] font-medium">Cancel</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OrderHistoryTable({ orders }: { orders: AsterOrderHistory[] }) {
  if (orders.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No order history</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-left px-2 py-1.5">Type</th>
          <th className="text-left px-2 py-1.5">Side</th>
          <th className="text-right px-2 py-1.5">Price</th>
          <th className="text-right px-2 py-1.5">Filled/Qty</th>
          <th className="text-left px-2 py-1.5">Status</th>
          <th className="text-right px-3 py-1.5">Time</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.orderId} className="border-b border-border/30 hover:bg-surface-hover/50">
            <td className="px-3 py-2 font-medium text-foreground">{o.symbol.replace("USDT", "")}</td>
            <td className="px-2 py-2 text-muted-foreground">{o.type}</td>
            <td className={cn("px-2 py-2 font-medium", o.side === "BUY" ? "text-green-400" : "text-red-400")}>{o.side}</td>
            <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(o.avgPrice || o.price).toLocaleString()}</td>
            <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{o.executedQty}/{o.origQty}</td>
            <td className="px-2 py-2">
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                o.status === "FILLED" ? "bg-green-500/10 text-green-400" :
                o.status === "CANCELED" ? "bg-red-500/10 text-red-400" :
                "bg-muted text-muted-foreground"
              )}>{o.status}</span>
            </td>
            <td className="text-right px-3 py-2 text-muted-foreground tabular-nums">{formatTime(o.time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TradeHistoryTable({ trades }: { trades: AsterTradeHistory[] }) {
  if (trades.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No trade history</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Symbol</th>
          <th className="text-left px-2 py-1.5">Side</th>
          <th className="text-right px-2 py-1.5">Price</th>
          <th className="text-right px-2 py-1.5">Qty</th>
          <th className="text-right px-2 py-1.5">Realized PnL</th>
          <th className="text-right px-2 py-1.5">Fee</th>
          <th className="text-right px-3 py-1.5">Time</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => {
          const pnl = parseFloat(t.realizedPnl);
          return (
            <tr key={t.id} className="border-b border-border/30 hover:bg-surface-hover/50">
              <td className="px-3 py-2 font-medium text-foreground">{t.symbol.replace("USDT", "")}</td>
              <td className={cn("px-2 py-2 font-medium", t.side === "BUY" ? "text-green-400" : "text-red-400")}>{t.side}</td>
              <td className="text-right px-2 py-2 text-foreground tabular-nums">${parseFloat(t.price).toLocaleString()}</td>
              <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{t.qty}</td>
              <td className={cn("text-right px-2 py-2 font-medium tabular-nums", pnl >= 0 ? "text-green-400" : "text-red-400")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)}
              </td>
              <td className="text-right px-2 py-2 text-muted-foreground tabular-nums">{parseFloat(t.commission).toFixed(4)}</td>
              <td className="text-right px-3 py-2 text-muted-foreground tabular-nums">{formatTime(t.time)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AssetsTable({ account }: { account: AsterAccountInfo | null }) {
  const assets = (account?.assets || []).filter((a) => parseFloat(a.walletBalance) > 0);
  if (assets.length === 0) return <div className="flex items-center justify-center py-8 text-muted-foreground">No assets</div>;
  return (
    <table className="w-full">
      <thead>
        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
          <th className="text-left px-3 py-1.5">Asset</th>
          <th className="text-right px-2 py-1.5">Wallet Balance</th>
          <th className="text-right px-2 py-1.5">Unrealized PnL</th>
          <th className="text-right px-2 py-1.5">Margin Balance</th>
          <th className="text-right px-3 py-1.5">Available</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((a) => (
          <tr key={a.asset} className="border-b border-border/30 hover:bg-surface-hover/50">
            <td className="px-3 py-2 font-medium text-foreground">{a.asset}</td>
            <td className="text-right px-2 py-2 text-foreground tabular-nums">{parseFloat(a.walletBalance).toFixed(4)}</td>
            <td className={cn("text-right px-2 py-2 tabular-nums", parseFloat(a.unrealizedProfit) >= 0 ? "text-green-400" : "text-red-400")}>
              {parseFloat(a.unrealizedProfit).toFixed(4)}
            </td>
            <td className="text-right px-2 py-2 text-foreground/70 tabular-nums">{parseFloat(a.marginBalance).toFixed(4)}</td>
            <td className="text-right px-3 py-2 text-primary font-medium tabular-nums">{parseFloat(a.availableBalance).toFixed(4)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
