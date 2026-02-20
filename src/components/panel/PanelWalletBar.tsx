import { useEffect, useState } from "react";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Key,
  QrCode,
  AlertTriangle,
  Shield,
  ArrowDownToLine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import QRCode from "react-qr-code";

export default function PanelWalletBar() {
  const privyAvailable = usePrivyAvailable();
  if (!privyAvailable) return null;
  return <WalletBarInner />;
}

function WalletBarInner() {
  const { walletAddress, isWalletReady, getBalance, getBalanceStrict } = useSolanaWalletWithPrivy();
  const { exportWallet } = usePrivy();
  const { toast } = useToast();

  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState<{ amount: number } | null>(null);
  const [balanceAtOpen, setBalanceAtOpen] = useState<number | null>(null);

  const fetchBalance = async () => {
    if (!isWalletReady) return;
    setIsLoading(true);
    try {
      const bal = getBalanceStrict ? await getBalanceStrict() : await getBalance();
      setBalance(bal);
      return bal;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isWalletReady) return;
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [isWalletReady]);

  // Deposit detection polling
  useEffect(() => {
    if (!showQR || !isWalletReady) return;
    if (balanceAtOpen === null && balance !== null) setBalanceAtOpen(balance);

    const pollInterval = setInterval(async () => {
      try {
        const currentBal = getBalanceStrict ? await getBalanceStrict() : await getBalance();
        setBalance(currentBal);
        const openingBalance = balanceAtOpen ?? balance ?? 0;
        if (currentBal > openingBalance + 0.0001) {
          const depositAmount = currentBal - openingBalance;
          setDepositSuccess({ amount: depositAmount });
          toast({ title: "🎉 Deposit Received!", description: `+${depositAmount.toFixed(4)} SOL` });
          setTimeout(() => { setShowQR(false); setDepositSuccess(null); setBalanceAtOpen(null); }, 2500);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [showQR, isWalletReady, balanceAtOpen, balance]);

  const handleQROpenChange = (open: boolean) => {
    setShowQR(open);
    if (open) { setDepositSuccess(null); setBalanceAtOpen(balance); }
    else { setBalanceAtOpen(null); setDepositSuccess(null); }
  };

  const handleCopy = async () => {
    if (!walletAddress) return;
    const ok = await copyToClipboard(walletAddress);
    if (ok) { setCopied(true); toast({ title: "Address copied!" }); setTimeout(() => setCopied(false), 2000); }
  };

  const handleExport = async () => {
    if (confirmText !== "EXPORT") return;
    setIsExporting(true);
    try {
      await exportWallet();
      toast({ title: "Export initiated", description: "Follow the secure export flow" });
      setShowExport(false); setConfirmText("");
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally { setIsExporting(false); }
  };

  if (!isWalletReady || !walletAddress) {
    return (
      <div className="mx-4 mb-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const truncated = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <div className="mx-4 mb-3 rounded-xl bg-white/[0.04] backdrop-blur-md border border-white/10 p-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Balance */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(74,222,128,0.15)" }}>
            <Wallet className="h-3.5 w-3.5" style={{ color: "#4ade80" }} />
          </div>
          <span className="font-mono font-bold text-sm">
            {isLoading ? "..." : (balance?.toFixed(4) ?? "0.0000")}
          </span>
          <span className="text-xs text-muted-foreground font-mono">SOL</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchBalance} disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Address */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">{truncated}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3" style={{ color: "#4ade80" }} /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Deposit */}
          <Dialog open={showQR} onOpenChange={handleQROpenChange}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2">
                <ArrowDownToLine className="h-3 w-3" />
                Deposit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" /> Deposit SOL
                </DialogTitle>
                <DialogDescription>Scan QR or copy address to send SOL</DialogDescription>
              </DialogHeader>
              {depositSuccess ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                    <Check className="h-10 w-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-primary mb-2">Deposit Received!</h3>
                    <p className="text-2xl font-bold">+{depositSuccess.amount.toFixed(4)} SOL</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCode value={walletAddress} size={180} />
                  </div>
                  <div className="w-full">
                    <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input value={walletAddress} readOnly className="font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Waiting for deposit...</span>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Export Key */}
          <Dialog open={showExport} onOpenChange={(open) => { setShowExport(open); if (!open) setConfirmText(""); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2">
                <Key className="h-3 w-3" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" /> Export Private Key
                </DialogTitle>
                <DialogDescription>Export your private key to use in other wallets</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>WARNING:</strong> Never share your private key.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label className="text-sm">Type "EXPORT" to confirm</Label>
                  <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="Type EXPORT" className="font-mono" />
                </div>
                <Button variant="destructive" className="w-full" onClick={handleExport} disabled={isExporting || confirmText !== "EXPORT"}>
                  {isExporting ? "Exporting..." : <><Key className="h-4 w-4 mr-2" />Export Private Key</>}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Solscan */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, "_blank")}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
