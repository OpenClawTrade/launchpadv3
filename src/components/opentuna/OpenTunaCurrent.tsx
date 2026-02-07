import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CurrencyCircleDollar,
  ArrowUp,
  ArrowDown,
  Plus,
  Clock,
  Check,
  X,
  Fish
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: 'paid' | 'earned';
  service: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
}

const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'paid', service: 'alpha_radar', amount: 0.01, status: 'completed', timestamp: '12:34' },
  { id: '2', type: 'earned', service: 'meme_forge', amount: 0.002, status: 'completed', timestamp: '12:30' },
  { id: '3', type: 'paid', service: 'whale_sonar', amount: 0.02, status: 'completed', timestamp: '11:45' },
  { id: '4', type: 'paid', service: 'sentiment_pulse', amount: 0.005, status: 'pending', timestamp: '11:30' },
];

export default function OpenTunaCurrent() {
  const [balance] = useState(0.45);
  const [totalEarned] = useState(1.24);
  const [totalSpent] = useState(0.79);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Balance Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="opentuna-card opentuna-glow">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-2xl font-bold text-cyan-400">{balance} SOL</p>
          </CardContent>
        </Card>
        <Card className="opentuna-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Earned</p>
            <p className="text-2xl font-bold text-green-400">{totalEarned} SOL</p>
          </CardContent>
        </Card>
        <Card className="opentuna-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="text-2xl font-bold text-foreground">{totalSpent} SOL</p>
          </CardContent>
        </Card>
      </div>

      {/* Deposit Button */}
      <div className="flex justify-end">
        <Button className="opentuna-button">
          <Plus className="h-4 w-4 mr-2" />
          Deposit SOL
        </Button>
      </div>

      {/* Transaction History */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CurrencyCircleDollar className="h-5 w-5 text-green-400" weight="duotone" />
            Recent Transactions (Current Flows)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {SAMPLE_TRANSACTIONS.map((tx) => (
              <div 
                key={tx.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <div className={cn(
                  "p-2 rounded-full",
                  tx.type === 'earned' ? "bg-green-500/10" : "bg-secondary"
                )}>
                  {tx.type === 'earned' ? (
                    <ArrowDown className="h-4 w-4 text-green-400" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{tx.service}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tx.timestamp}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-semibold",
                    tx.type === 'earned' ? "text-green-400" : "text-foreground"
                  )}>
                    {tx.type === 'earned' ? '+' : '-'}{tx.amount} SOL
                  </p>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs",
                      tx.status === 'completed' && "text-green-400",
                      tx.status === 'pending' && "text-yellow-400",
                      tx.status === 'failed' && "text-red-400"
                    )}
                  >
                    {tx.status === 'completed' && <Check className="h-3 w-3 mr-1" />}
                    {tx.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {tx.status === 'failed' && <X className="h-3 w-3 mr-1" />}
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          
          {SAMPLE_TRANSACTIONS.length === 0 && (
            <div className="text-center py-8">
              <Fish className="h-10 w-10 text-muted-foreground mx-auto mb-2" weight="duotone" />
              <p className="text-muted-foreground">No transactions yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Payments */}
      <Card className="opentuna-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-400" weight="duotone" />
            Pending Payments (Tide Receipts)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground">No pending payments</p>
          </div>
        </CardContent>
      </Card>

      {/* SchoolPay Info */}
      <Card className="opentuna-card bg-gradient-to-br from-cyan-500/10 to-teal-500/5">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <CurrencyCircleDollar className="h-5 w-5 text-cyan-400" weight="duotone" />
            About SchoolPay (x402)
          </h3>
          <p className="text-sm text-muted-foreground">
            SchoolPay is OpenTuna's agent-to-agent payment system. When your agent uses a premium Fin, 
            it pays the provider directly in SOL. When others use your Fins, you earn SOL automatically.
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-cyan-400">0%</p>
              <p className="text-xs text-muted-foreground">Platform Fee</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">5 min</p>
              <p className="text-xs text-muted-foreground">Receipt Expiry</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">On-chain</p>
              <p className="text-xs text-muted-foreground">Verification</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
