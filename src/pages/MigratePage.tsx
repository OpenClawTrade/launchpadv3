import { useState, useEffect, useMemo } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Search,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  Shield,
  Cpu,
  Globe,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const OLD_MINT = "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump";
const COLLECTION_WALLET = "9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe";

interface SnapshotHolder {
  id: string;
  wallet_address: string;
  token_balance: number;
  supply_percentage: number;
  has_migrated: boolean;
  amount_sent: number;
  migrated_at: string | null;
}

interface MigrationConfig {
  deadline_at: string;
  total_supply_snapshot: number;
}

function useCountdown(deadline: string | null) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: true });

  useEffect(() => {
    if (!deadline) return;

    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, expired: true });
        return;
      }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return timeLeft;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label || "Address"} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function MigratePage() {
  const { solanaAddress, login } = useAuth();
  const [config, setConfig] = useState<MigrationConfig | null>(null);
  const [holders, setHolders] = useState<SnapshotHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllHolders, setShowAllHolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amountSent, setAmountSent] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [showTechnicals, setShowTechnicals] = useState(false);

  const countdown = useCountdown(config?.deadline_at || null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (solanaAddress) {
      setWalletInput(solanaAddress);
    }
  }, [solanaAddress]);

  const loadData = async () => {
    setLoading(true);

    // Fetch all holders (may exceed 1000 default limit)
    const fetchAllHolders = async () => {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("tuna_migration_snapshot")
          .select("*")
          .order("token_balance", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    };

    const [configRes, allHolders] = await Promise.all([
      supabase.from("tuna_migration_config").select("*").limit(1).single(),
      fetchAllHolders(),
    ]);

    if (configRes.data) {
      setConfig({
        deadline_at: configRes.data.deadline_at,
        total_supply_snapshot: Number(configRes.data.total_supply_snapshot),
      });
    }

    if (allHolders.length > 0) {
      setHolders(
        allHolders.map((h: any) => ({
          ...h,
          token_balance: Number(h.token_balance),
          supply_percentage: Number(h.supply_percentage),
          amount_sent: Number(h.amount_sent),
        }))
      );
    }

    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalHolders = holders.length;
    const migratedHolders = holders.filter((h) => h.has_migrated).length;
    const totalSupply = config?.total_supply_snapshot || 0;
    const migratedSupply = holders
      .filter((h) => h.has_migrated)
      .reduce((sum, h) => sum + h.amount_sent, 0);

    return {
      totalHolders,
      migratedHolders,
      holderPct: totalHolders > 0 ? ((migratedHolders / totalHolders) * 100).toFixed(1) : "0",
      totalSupply,
      migratedSupply,
      supplyPct: totalSupply > 0 ? ((migratedSupply / totalSupply) * 100).toFixed(1) : "0",
    };
  }, [holders, config]);

  const filteredHolders = useMemo(() => {
    const filtered = searchQuery
      ? holders.filter((h) =>
          h.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : holders;
    return showAllHolders ? filtered : filtered.slice(0, 20);
  }, [holders, searchQuery, showAllHolders]);

  const handleSubmitMigration = async () => {
    const wallet = walletInput.trim();
    if (!wallet) {
      toast.error("Enter your wallet address");
      return;
    }
    if (!amountSent || Number(amountSent) <= 0) {
      toast.error("Enter the amount of $TUNA you sent");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_tuna_migration", {
        p_wallet_address: wallet,
        p_amount_sent: Number(amountSent),
        p_tx_signature: txSignature.trim() || null,
      });

      if (error) throw error;

      toast.success("Migration registered successfully!");
      setAmountSent("");
      setTxSignature("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit migration");
    } finally {
      setSubmitting(false);
    }
  };

  const truncateWallet = (addr: string) =>
    `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toFixed(2);
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <Badge variant="outline" className="border-primary text-primary text-sm px-4 py-1">
            Token Migration
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground">
            $TUNA is Migrating
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From pump.fun to our own launchpad — a critical step to properly fund
            the TUNA OS ecosystem and sustain long-term growth.
          </p>
        </div>

        {/* Why Section */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Why We're Migrating
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Pump.fun's fee structure does not return fees to token creators. Every trade on pump.fun
            generates fees that go entirely to pump.fun — not to the $TUNA project. This means
            <strong className="text-foreground"> zero revenue</strong> flows back to fund development
            of TUNA OS, our AI agents, OpenClaw, TunaBook, and the entire ecosystem.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By migrating to our own launchpad with a proper fee distribution architecture, trading
            fees are split between the platform, creators, and agents — directly funding continued
            development and growth.
          </p>

          <button
            onClick={() => setShowTechnicals(!showTechnicals)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            {showTechnicals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showTechnicals ? "Hide" : "Show"} Technical Details
          </button>

          {showTechnicals && (
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Cpu className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">TUNA OS — AI Agent Operating System</p>
                    <p className="text-xs text-muted-foreground">
                      Autonomous agents that launch tokens, trade, engage socially, and earn fees.
                      Includes agent registration, API keys, writing style learning, and cross-community
                      engagement.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">OpenTuna — API/SDK Platform</p>
                    <p className="text-xs text-muted-foreground">
                      Full API access for developers to build on TUNA infrastructure. Includes Fin
                      trading engine, Sonar analytics, and DNS integration system.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">OpenClaw — Advanced Launchpad</p>
                    <p className="text-xs text-muted-foreground">
                      Our own launchpad system with creator fees, agent fee sharing, fair launches,
                      trading agent integration, bribe mechanics, and community governance.
                      Same magnitude as pump.fun but with proper revenue distribution.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">TunaBook — Social Layer</p>
                    <p className="text-xs text-muted-foreground">
                      Reddit-style communities per token (SubTunas), with posts, comments, voting,
                      and agent participation. Creates organic engagement around every token.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Trading Agents</p>
                    <p className="text-xs text-muted-foreground">
                      Autonomous trading bots with their own wallets, strategies, and on-chain
                      activity. They learn patterns, manage positions, and generate real volume.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">Fee Distribution Architecture</p>
                    <p className="text-xs text-muted-foreground">
                      Every trade generates fees split: platform treasury, token creator, and
                      agents. This funds development, rewards creators, and incentivizes ecosystem
                      participation — impossible on pump.fun.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Countdown Timer */}
        {config && (
          <Card className="p-6 text-center bg-card border-border">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Migration Window</h2>
            </div>
            {countdown.expired ? (
              <div className="text-destructive font-bold text-2xl">Migration Window Closed</div>
            ) : (
              <div className="flex justify-center gap-4">
                {[
                  { value: countdown.h, label: "Hours" },
                  { value: countdown.m, label: "Minutes" },
                  { value: countdown.s, label: "Seconds" },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <div className="text-4xl md:text-5xl font-mono font-bold text-primary">
                      {String(unit.value).padStart(2, "0")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{unit.label}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              Holders who send their $TUNA within this window will receive the equivalent % of new tokens.
            </p>
          </Card>
        )}

        {/* Stats Bar */}
        {holders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 text-center bg-card border-border">
              <div className="text-2xl font-bold text-foreground">{stats.totalHolders}</div>
              <div className="text-xs text-muted-foreground">Snapshot Holders</div>
            </Card>
            <Card className="p-4 text-center bg-card border-border">
              <div className="text-2xl font-bold text-primary">
                {stats.migratedHolders}{" "}
                <span className="text-sm text-muted-foreground">({stats.holderPct}%)</span>
              </div>
              <div className="text-xs text-muted-foreground">Agreed to Migrate</div>
            </Card>
            <Card className="p-4 text-center bg-card border-border">
              <div className="text-2xl font-bold text-foreground">
                {formatNumber(stats.totalSupply)}
              </div>
              <div className="text-xs text-muted-foreground">Total Supply Snapshot</div>
            </Card>
            <Card className="p-4 text-center bg-card border-border">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(stats.migratedSupply)}{" "}
                <span className="text-sm text-muted-foreground">({stats.supplyPct}%)</span>
              </div>
              <div className="text-xs text-muted-foreground">Supply Migrating</div>
            </Card>
          </div>
        )}

        {/* Deposit Instructions */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            How to Migrate
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
            <li>
              Check your wallet is in the snapshot table below
            </li>
            <li>
              Send your old $TUNA tokens to the collection wallet:
              <div className="mt-2 bg-secondary/50 rounded-lg p-3 flex items-center justify-between gap-2 font-mono text-sm text-foreground break-all">
                <span>{COLLECTION_WALLET}</span>
                <CopyButton text={COLLECTION_WALLET} label="Collection wallet" />
              </div>
            </li>
            <li>
              Come back here and click "I've Sent My Tokens" below
            </li>
            <li>
              Once migration completes, you'll receive new $TUNA proportional to your snapshot balance
            </li>
          </ol>

          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Old $TUNA Mint: </span>
            <span className="font-mono break-all">{OLD_MINT}</span>
            <CopyButton text={OLD_MINT} label="Mint address" />
          </div>
        </Card>

        {/* Migration Form */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground">I've Sent My Tokens</h2>

          {countdown.expired && config ? (
            <p className="text-destructive font-semibold">
              The migration window has closed. New submissions are no longer accepted.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Your Wallet Address
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter your Solana wallet address"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                  />
                  {!solanaAddress && (
                    <Button variant="outline" onClick={() => login()} className="shrink-0">
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Amount of $TUNA Sent
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 50000"
                  value={amountSent}
                  onChange={(e) => setAmountSent(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Transaction Signature (optional)
                </label>
                <Input
                  placeholder="Paste your tx signature for faster verification"
                  value={txSignature}
                  onChange={(e) => setTxSignature(e.target.value)}
                />
              </div>

              <Button
                onClick={handleSubmitMigration}
                disabled={submitting || !walletInput}
                className="w-full"
              >
                {submitting ? "Submitting..." : "Register Migration"}
              </Button>
            </div>
          )}
        </Card>

        {/* Snapshot Table */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">Snapshot Holders</h2>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search wallet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading snapshot data...</div>
          ) : holders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No snapshot data yet. The snapshot will be taken before the migration window opens.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">% Supply</TableHead>
                      <TableHead className="text-center">Migrated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHolders.map((holder) => (
                      <TableRow key={holder.id}>
                        <TableCell className="font-mono text-sm">
                          {truncateWallet(holder.wallet_address)}
                          <CopyButton text={holder.wallet_address} label="Wallet" />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(holder.token_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {holder.supply_percentage.toFixed(4)}%
                        </TableCell>
                        <TableCell className="text-center">
                          {holder.has_migrated ? (
                            <Check className="w-5 h-5 text-primary mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {!showAllHolders && holders.length > 20 && (
                <Button
                  variant="outline"
                  onClick={() => setShowAllHolders(true)}
                  className="w-full"
                >
                  Show All {holders.length} Holders
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </LaunchpadLayout>
  );
}
