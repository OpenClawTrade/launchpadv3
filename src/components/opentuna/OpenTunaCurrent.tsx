import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CurrencyCircleDollar,
  ArrowUp,
  ArrowDown,
  Plus,
  Clock,
  Check,
  X,
  Fish,
  Spinner,
  Copy
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import OpenTunaAgentSelector from "./OpenTunaAgentSelector";

interface Transaction {
  id: string;
  requester_agent_id: string;
  provider_agent_id: string | null;
  service_name: string | null;
  amount_sol: number;
  status: string;
  created_at: string;
  tide_receipt_id: string;
  fin_id: string | null;
}

interface AgentBalance {
  balance_sol: number;
  total_earned_sol: number;
  total_spent_sol: number;
  wallet_address: string;
}

export default function OpenTunaCurrent() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentBalance, setAgentBalance] = useState<AgentBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (selectedAgentId) {
      fetchData();
    }
  }, [selectedAgentId]);

  const fetchData = async () => {
    if (!selectedAgentId) return;
    
    setLoading(true);
    try {
      // Fetch agent balance
      const { data: agent, error: agentError } = await supabase
        .from("opentuna_agents")
        .select("balance_sol, total_earned_sol, total_spent_sol, wallet_address")
        .eq("id", selectedAgentId)
        .single();

      if (!agentError && agent) {
        setAgentBalance(agent as AgentBalance);
      }

      // Fetch recent transactions (both as requester and provider)
      const { data: flows, error: flowsError } = await supabase
        .from("opentuna_current_flows")
        .select("*")
        .or(`requester_agent_id.eq.${selectedAgentId},provider_agent_id.eq.${selectedAgentId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!flowsError && flows) {
        const completed = flows.filter(f => f.status === "completed");
        const pending = flows.filter(f => f.status === "pending");
        setTransactions(completed as Transaction[]);
        setPendingPayments(pending as Transaction[]);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedAgentId || !agentBalance) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // In production: This would initiate a SOL transfer to the agent's wallet
    // For now, simulate the deposit by updating the balance directly
    try {
      const newBalance = Number(agentBalance.balance_sol) + amount;
      
      const { error } = await supabase
        .from("opentuna_agents")
        .update({ balance_sol: newBalance })
        .eq("id", selectedAgentId);

      if (error) throw error;

      toast({
        title: "Deposit Initiated",
        description: `Send ${amount} SOL to ${agentBalance.wallet_address.slice(0, 8)}...`,
      });

      setDepositAmount("");
      setDepositDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyWallet = () => {
    if (agentBalance?.wallet_address) {
      navigator.clipboard.writeText(agentBalance.wallet_address);
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const getTransactionType = (tx: Transaction): 'earned' | 'paid' => {
    return tx.provider_agent_id === selectedAgentId ? 'earned' : 'paid';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Agent Selector */}
      <OpenTunaAgentSelector 
        selectedAgentId={selectedAgentId}
        onSelect={setSelectedAgentId}
      />

      {!selectedAgentId ? (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <CurrencyCircleDollar className="h-12 w-12 text-muted-foreground mx-auto mb-3" weight="duotone" />
            <p className="text-muted-foreground">Select an agent to view their economy</p>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="opentuna-card">
          <CardContent className="p-8 text-center">
            <Spinner className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">Loading economy data...</p>
          </CardContent>
        </Card>
      ) : agentBalance && (
        <>
          {/* Balance Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="opentuna-card opentuna-glow">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-primary">
                  {Number(agentBalance.balance_sol).toFixed(4)} SOL
                </p>
              </CardContent>
            </Card>
            <Card className="opentuna-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold text-green-400">
                  {Number(agentBalance.total_earned_sol).toFixed(4)} SOL
                </p>
              </CardContent>
            </Card>
            <Card className="opentuna-card">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">
                  {Number(agentBalance.total_spent_sol).toFixed(4)} SOL
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Deposit Button */}
          <div className="flex justify-end">
            <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
              <DialogTrigger asChild>
                <Button className="opentuna-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Deposit SOL
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deposit SOL to Agent</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Agent Wallet</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-secondary rounded text-sm font-mono truncate">
                        {agentBalance.wallet_address}
                      </code>
                      <Button variant="secondary" size="icon" onClick={copyWallet}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send SOL to this address to fund your agent
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount (SOL)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.5"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                  <Button 
                    className="w-full opentuna-button"
                    onClick={handleDeposit}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Simulate Deposit
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Fish className="h-10 w-10 text-muted-foreground mx-auto mb-2" weight="duotone" />
                    <p className="text-muted-foreground">No transactions yet</p>
                  </div>
                ) : (
                  transactions.map((tx) => {
                    const type = getTransactionType(tx);
                    return (
                      <div 
                        key={tx.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className={cn(
                          "p-2 rounded-full",
                          type === 'earned' ? "bg-green-500/10" : "bg-secondary"
                        )}>
                          {type === 'earned' ? (
                            <ArrowDown className="h-4 w-4 text-green-400" />
                          ) : (
                            <ArrowUp className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {tx.service_name || "Fin payment"}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(tx.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-semibold",
                            type === 'earned' ? "text-green-400" : "text-foreground"
                          )}>
                            {type === 'earned' ? '+' : '-'}{Number(tx.amount_sol).toFixed(4)} SOL
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
                    );
                  })
                )}
              </div>
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
              {pendingPayments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No pending payments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingPayments.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                    >
                      <div>
                        <p className="text-sm font-medium">{tx.service_name || "Pending payment"}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {tx.tide_receipt_id.slice(0, 20)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-yellow-400">
                          {Number(tx.amount_sol).toFixed(4)} SOL
                        </p>
                        <Badge variant="secondary" className="text-xs text-yellow-400">
                          <Clock className="h-3 w-3 mr-1" />
                          pending
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SchoolPay Info */}
          <Card className="opentuna-card bg-gradient-to-br from-green-500/10 to-emerald-500/5">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CurrencyCircleDollar className="h-5 w-5 text-primary" weight="duotone" />
                About SchoolPay (x402)
              </h3>
              <p className="text-sm text-muted-foreground">
                SchoolPay is OpenTuna's agent-to-agent payment system. When your agent uses a premium Fin, 
                it pays the provider directly in SOL. When others use your Fins, you earn SOL automatically.
              </p>
              <div className="mt-4 grid sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">0%</p>
                  <p className="text-xs text-muted-foreground">Platform Fee</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">5 min</p>
                  <p className="text-xs text-muted-foreground">Receipt Expiry</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">On-chain</p>
                  <p className="text-xs text-muted-foreground">Verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
