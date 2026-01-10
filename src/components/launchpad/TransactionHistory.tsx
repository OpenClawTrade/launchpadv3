import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LaunchpadTransaction, formatTokenAmount, formatSolAmount } from "@/hooks/useLaunchpad";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface TransactionHistoryProps {
  transactions: LaunchpadTransaction[];
  ticker: string;
}

export function TransactionHistory({ transactions, ticker }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No transactions yet</p>
        <p className="text-sm">Be the first to trade!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const isBuy = tx.transaction_type === 'buy';
        
        return (
          <Card key={tx.id} className="p-3 flex items-center gap-3">
            {/* Icon */}
            <div className={`p-2 rounded-full ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {isBuy ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </div>

            {/* User */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={tx.profiles?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {tx.profiles?.display_name?.slice(0, 2) || tx.user_wallet.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {tx.profiles?.display_name || `${tx.user_wallet.slice(0, 4)}...${tx.user_wallet.slice(-4)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Amounts */}
            <div className="text-right">
              <p className={`font-medium text-sm ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
                {isBuy ? '+' : '-'}{formatTokenAmount(tx.token_amount)} {ticker}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatSolAmount(tx.sol_amount)} SOL
              </p>
            </div>

            {/* Explorer link */}
            <a
              href={`https://solscan.io/tx/${tx.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </Card>
        );
      })}
    </div>
  );
}
