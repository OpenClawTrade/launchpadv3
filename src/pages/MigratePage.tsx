import { useState, useEffect, useMemo, useCallback } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { LaunchCountdown } from "@/components/LaunchCountdown";
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
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { SolanaWalletAdapterProvider } from "@/providers/SolanaWalletAdapterProvider";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  ExternalLink,
  RefreshCw,
  Inbox,
  Hash,
  CheckCircle2,
  Wallet,
  Timer,
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

interface LedgerEntry {
  id: string;
  wallet_address: string;
  total_tokens_received: number;
  tx_count: number;
  first_transfer_at: string | null;
  last_transfer_at: string | null;
  last_scanned_at: string | null;
}

// useCountdown for migration deadline only
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

function MigratePageContent() {
  const { publicKey } = useWallet();
  const solanaAddress = publicKey?.toBase58() || null;
  const [config, setConfig] = useState<MigrationConfig | null>(null);
  const [holders, setHolders] = useState<SnapshotHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllHolders, setShowAllHolders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txSignature, setTxSignature] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [showTechnicals, setShowTechnicals] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [userLedgerEntry, setUserLedgerEntry] = useState<LedgerEntry | null>(null);
  const [userLedgerLoading, setUserLedgerLoading] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  const countdown = useCountdown(config?.deadline_at || null);


  useEffect(() => {
    loadData();
    loadLedger();
  }, []);

  useEffect(() => {
    if (solanaAddress) {
      setWalletInput(solanaAddress);
      // Look up user's migration status
      setUserLedgerLoading(true);
      setUserNotFound(false);
      supabase
        .from("tuna_migration_ledger")
        .select("*")
        .eq("wallet_address", solanaAddress)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setUserLedgerEntry({
              ...data,
              total_tokens_received: Number(data.total_tokens_received),
              tx_count: Number(data.tx_count),
            });
            setUserNotFound(false);
          } else {
            setUserLedgerEntry(null);
            setUserNotFound(true);
          }
          setUserLedgerLoading(false);
        });
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

  const loadLedger = async () => {
    setLedgerLoading(true);
    const allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("tuna_migration_ledger")
        .select("*")
        .order("total_tokens_received", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setLedger(
      allData.map((r: any) => ({
        ...r,
        total_tokens_received: Number(r.total_tokens_received),
        tx_count: Number(r.tx_count),
      }))
    );
    setLedgerLoading(false);
  };

  const handleRefreshScan = async () => {
    setScanning(true);
    try {
      const res = await supabase.functions.invoke("scan-collection-wallet", {
        method: "POST",
      });
      if (res.error) throw new Error(res.data?.error || res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(
        `Scan complete! Found ${res.data.unique_senders} senders, ${Number(res.data.total_tokens_received).toLocaleString()} tokens total.`
      );
      await loadLedger();
    } catch (err: any) {
      toast.error(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
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

  const TOTAL_OLD_SUPPLY = 1_000_000_000; // 1B old TUNA total supply

  const ledgerStats = useMemo(() => {
    const totalReceived = ledger.reduce((s, e) => s + e.total_tokens_received, 0);
    const totalTxs = ledger.reduce((s, e) => s + e.tx_count, 0);
    const lastScanned = ledger.length > 0 ? ledger[0].last_scanned_at : null;
    return {
      totalReceived,
      uniqueSenders: ledger.length,
      totalTxs,
      pctOfSupply: TOTAL_OLD_SUPPLY > 0 ? ((totalReceived / TOTAL_OLD_SUPPLY) * 100).toFixed(4) : "0",
      lastScanned,
    };
  }, [ledger]);

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
    const sig = txSignature.trim();
    if (!sig) {
      toast.error("Enter the transaction signature");
      return;
    }
    if (sig.length < 80 || sig.length > 100) {
      toast.error(`Signature looks invalid (${sig.length} chars). A valid Solana tx signature is 87-88 characters. Make sure you copied the full signature.`);
      return;
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(sig)) {
      toast.error("Signature contains invalid characters. Make sure you copied it correctly without extra spaces.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await supabase.functions.invoke("verify-tuna-migration", {
        body: {
          wallet_address: wallet,
          tx_signature: txSignature.trim(),
        },
      });

      if (res.error) {
        // For non-2xx responses, data may contain the JSON body or be null
        // Try data first, then try parsing from the error context
        let msg = res.data?.error;
        if (!msg && res.error && typeof (res.error as any).context?.json === 'function') {
          try {
            const body = await (res.error as any).context.json();
            msg = body?.error;
          } catch {}
        }
        throw new Error(msg || res.error.message || "Verification failed");
      }
      
      const data = res.data;
      if (data?.error) throw new Error(data.error);

      const totalSent = data.total_sent ? Number(data.total_sent).toLocaleString() : "";
      const txCount = data.tx_count || 1;
      if (txCount > 1) {
        toast.success(`Transfer #${txCount} registered! Total: ${totalSent} $TUNA across ${txCount} transactions.`);
      } else {
        toast.success(`Migration registered! ${data.amount_sent ? `${Number(data.amount_sent).toLocaleString()} $TUNA verified.` : ""}`);
      }
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
        {/* Token Launch Countdown */}
        <LaunchCountdown />
         {/* Hero Section - Migration Succeeded */}
        <div className="text-center space-y-4">
          <Badge className="bg-primary/10 text-primary border-primary/30 text-sm px-4 py-1">
            <CheckCircle2 className="w-4 h-4 mr-1.5 inline" />
            Migration Complete
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground">
            Migration Succeeded
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The migration window has closed.{" "}
            <span className="text-foreground font-semibold">{ledgerStats.uniqueSenders}</span> holders migrated{" "}
            <span className="text-foreground font-semibold">{formatNumber(ledgerStats.totalReceived)}</span> tokens to the new TUNA.
          </p>
        </div>

        {/* Why Section */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Why We're Migrating
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Pump.fun doesn't generate enough fees to sustain the TUNA ecosystem, and none of those fees
            flow back to the project or holders. For TUNA to grow professionally, it needs to launch from
            its own launchpad with a proper fee architecture that funds development, rewards creators, and
            powers the entire ecosystem.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            The new $TUNA will also have a <strong className="text-foreground">Trading Agent</strong> attached
            to it, which will autonomously trade and <strong className="text-foreground">reward holders</strong> through
            fee distribution — something impossible on pump.fun.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By migrating to our own launchpad, trading fees are properly split between the platform,
            creators, agents, and holders — directly funding continued development and growth.
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
                    <p className="font-semibold text-foreground text-sm">Claw SDK — API/SDK Platform</p>
                    <p className="text-xs text-muted-foreground">
                      Full API access for developers to build on Claw Mode infrastructure. Includes Fin
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

        {/* Your Migration Status Card */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Your Migration Status
          </h2>

          {!solanaAddress ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-muted-foreground">Connect your wallet to see your migration status and estimated new TUNA allocation.</p>
              <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-md !px-4 !py-2 !text-sm !font-medium hover:!bg-primary/90 !transition-colors" />
            </div>
          ) : userLedgerLoading ? (
            <div className="text-center py-6 text-muted-foreground">Loading your migration data...</div>
          ) : userNotFound ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-muted-foreground">This wallet did not participate in the migration.</p>
              <p className="text-xs text-muted-foreground font-mono">{solanaAddress}</p>
            </div>
          ) : userLedgerEntry ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-3 text-center bg-secondary/30 border-border">
                <div className="text-lg font-bold text-foreground">
                  {userLedgerEntry.total_tokens_received.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-muted-foreground">Tokens Migrated</div>
              </Card>
              <Card className="p-3 text-center bg-secondary/30 border-border">
                <div className="text-lg font-bold text-primary">
                  {((userLedgerEntry.total_tokens_received / TOTAL_OLD_SUPPLY) * 100).toFixed(4)}%
                </div>
                <div className="text-xs text-muted-foreground">% of Old Supply</div>
              </Card>
              <Card className="p-3 text-center bg-secondary/30 border-border">
                <div className="text-lg font-bold text-foreground">
                  {((userLedgerEntry.total_tokens_received / TOTAL_OLD_SUPPLY) * 100).toFixed(4)}%
                </div>
                <div className="text-xs text-muted-foreground">Est. New TUNA Share</div>
              </Card>
              <Card className="p-3 text-center bg-secondary/30 border-border">
                <div className="text-sm font-medium text-muted-foreground">
                  Pending
                </div>
                <div className="text-xs text-muted-foreground">Distribution TX</div>
              </Card>
            </div>
          ) : null}
        </Card>

        {/* Distribution & Protection Info Card */}
        <Card className="p-6 space-y-5 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Distribution & Anti-Dump Protection
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Timer className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-sm">24-Hour Launch Protection</p>
                <p className="text-sm text-muted-foreground">
                  After launch, the migrated supply will be locked in the developer wallet for 24 hours. This prevents migrated users from selling immediately and protects the chart during the critical first day of trading.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-sm">Auto Buyback Protection</p>
                <p className="text-sm text-muted-foreground">
                  If any migrated user sells after receiving their tokens, trading fees generated in the first 24 hours will be automatically used to buy back TUNA — offsetting sell pressure and letting the token grow organically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-sm">Staggered Distribution</p>
                <p className="text-sm text-muted-foreground">
                  After the 24-hour lock, tokens will be distributed to migrated holders one by one with delays between each transfer — preventing a mass sell-off and ensuring smooth, safe delivery.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Snapshot Table */}
        <Card className="p-6 space-y-4 bg-card border-border">
          <Tabs defaultValue="holders" className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="holders">Snapshot Holders</TabsTrigger>
                <TabsTrigger value="migrated">
                  Migrated ({stats.migratedHolders})
                </TabsTrigger>
                <TabsTrigger value="received">
                  Received ({ledgerStats.uniqueSenders})
                </TabsTrigger>
              </TabsList>
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
                {/* All Holders Tab */}
                <TabsContent value="holders">
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
                        {filteredHolders.map((holder) => {
                          const isLP = holder.wallet_address === "GjK3S2ZgxTVFEkxg43JE8eC1tbztWCseBYyZ8o8sg9f";
                          return (
                            <TableRow key={holder.id}>
                              <TableCell className="font-mono text-sm">
                                {truncateWallet(holder.wallet_address)}
                                {isLP && <span className="ml-1.5 text-xs text-amber-400 font-sans">(Liquidity Pool)</span>}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {!showAllHolders && holders.length > 20 && (
                    <Button
                      variant="outline"
                      onClick={() => setShowAllHolders(true)}
                      className="w-full mt-4"
                    >
                      Show All {holders.length} Holders
                    </Button>
                  )}
                </TabsContent>

                {/* Migrated Tab */}
                <TabsContent value="migrated">
                  {(() => {
                    const migratedList = holders
                      .filter((h) => h.has_migrated)
                      .filter((h) =>
                        searchQuery
                          ? h.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
                          : true
                      )
                      .sort((a, b) => b.amount_sent - a.amount_sent);

                    if (migratedList.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No holders have migrated yet.
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Wallet</TableHead>
                              <TableHead className="text-right">Amount Sent</TableHead>
                              <TableHead className="text-right">% Supply</TableHead>
                              <TableHead className="text-right">Migrated At</TableHead>
                              <TableHead className="text-center">Solscan</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {migratedList.map((holder) => (
                              <TableRow key={holder.id}>
                                <TableCell className="font-mono text-sm">
                                  {truncateWallet(holder.wallet_address)}
                                  <CopyButton text={holder.wallet_address} label="Wallet" />
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(holder.amount_sent)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {holder.supply_percentage.toFixed(4)}%
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {holder.migrated_at
                                    ? new Date(holder.migrated_at).toLocaleDateString()
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <a
                                    href={`https://solscan.io/account/${holder.wallet_address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </TabsContent>
                {/* Received Ledger Tab */}
                <TabsContent value="received">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <Card className="p-3 text-center bg-secondary/30 border-border">
                      <div className="text-lg font-bold text-foreground">
                        {formatNumber(ledgerStats.totalReceived)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tokens Received ({ledgerStats.pctOfSupply}%)
                      </div>
                    </Card>
                    <Card className="p-3 text-center bg-secondary/30 border-border">
                      <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-primary" />
                        {ledgerStats.uniqueSenders}
                      </div>
                      <div className="text-xs text-muted-foreground">Unique Senders</div>
                    </Card>
                    <Card className="p-3 text-center bg-secondary/30 border-border">
                      <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                        <Hash className="w-4 h-4 text-primary" />
                        {ledgerStats.totalTxs}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Transactions</div>
                    </Card>
                    <Card className="p-3 text-center bg-secondary/30 border-border">
                      <div className="text-sm text-foreground">
                        {ledgerStats.lastScanned
                          ? new Date(ledgerStats.lastScanned).toLocaleString()
                          : "Never"}
                      </div>
                      <div className="text-xs text-muted-foreground">Last Scanned</div>
                    </Card>
                  </div>

                  {/* Refresh Button */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={handleRefreshScan}
                      disabled={scanning}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
                      {scanning ? "Scanning on-chain..." : "Refresh from Chain"}
                    </Button>
                  </div>

                  {ledgerLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading ledger data...</div>
                  ) : ledger.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground space-y-3">
                      <Inbox className="w-8 h-8 mx-auto text-muted-foreground/50" />
                      <p>No received tokens recorded yet. Click "Refresh from Chain" to scan.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Wallet</TableHead>
                            <TableHead className="text-right">Tokens Received</TableHead>
                            <TableHead className="text-right">% Supply</TableHead>
                            <TableHead className="text-right">TXs</TableHead>
                            <TableHead className="text-right">First Transfer</TableHead>
                            <TableHead className="text-right">Last Transfer</TableHead>
                            <TableHead className="text-center">Solscan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledger
                            .filter((e) =>
                              searchQuery
                                ? e.wallet_address.toLowerCase().includes(searchQuery.toLowerCase())
                                : true
                            )
                            .map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="font-mono text-sm">
                                  {truncateWallet(entry.wallet_address)}
                                  <CopyButton text={entry.wallet_address} label="Wallet" />
                                </TableCell>
                                <TableCell className="text-right">
                                  {entry.total_tokens_received.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  {((entry.total_tokens_received / TOTAL_OLD_SUPPLY) * 100).toFixed(4)}%
                                </TableCell>
                                <TableCell className="text-right">{entry.tx_count}</TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {entry.first_transfer_at
                                    ? new Date(entry.first_transfer_at).toLocaleDateString()
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {entry.last_transfer_at
                                    ? new Date(entry.last_transfer_at).toLocaleDateString()
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-center">
                                  <a
                                    href={`https://solscan.io/account/${entry.wallet_address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        </Card>
      </div>
    </LaunchpadLayout>
  );
}

export default function MigratePage() {
  return (
    <SolanaWalletAdapterProvider>
      <MigratePageContent />
    </SolanaWalletAdapterProvider>
  );
}
