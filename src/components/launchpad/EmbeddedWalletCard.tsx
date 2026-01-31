import { useEffect, useState } from "react";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { usePrivy } from "@privy-io/react-auth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Settings,
  AlertTriangle,
  Shield,
  ArrowDownToLine,
  LogIn,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";

interface EmbeddedWalletCardProps {
  className?: string;
}

export function EmbeddedWalletCard({ className = "" }: EmbeddedWalletCardProps) {
  const privyAvailable = usePrivyAvailable();
  const { isAuthenticated, login } = useAuth();

  if (!privyAvailable) {
    return (
      <Card className={`gate-card p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Embedded Wallet</h3>
            <p className="text-xs text-muted-foreground">Wallet service unavailable</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Please try refreshing the page.
        </p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className={`gate-card p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Embedded Wallet</h3>
            <p className="text-xs text-muted-foreground">Connect to trade</p>
          </div>
        </div>
        <Button onClick={login} className="w-full">
          <LogIn className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </Card>
    );
  }

  return <EmbeddedWalletCardInner className={className} />;
}

function EmbeddedWalletCardInner({ className }: { className: string }) {
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
    } catch (error) {
      console.error("Failed to fetch balance:", error);
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

  // Poll for deposits when QR modal is open
  useEffect(() => {
    if (!showQR || !isWalletReady) return;

    // Store balance when modal opens
    if (balanceAtOpen === null && balance !== null) {
      setBalanceAtOpen(balance);
    }

    const pollInterval = setInterval(async () => {
      try {
        const currentBal = getBalanceStrict ? await getBalanceStrict() : await getBalance();
        setBalance(currentBal);

        // Check if balance increased
        const openingBalance = balanceAtOpen ?? balance ?? 0;
        if (currentBal > openingBalance + 0.0001) {
          const depositAmount = currentBal - openingBalance;
          setDepositSuccess({ amount: depositAmount });
          
          // Show success toast
          toast({
            title: "🎉 Deposit Received!",
            description: `+${depositAmount.toFixed(4)} SOL has been added to your wallet`,
          });

          // Close modal after showing success
          setTimeout(() => {
            setShowQR(false);
            setDepositSuccess(null);
            setBalanceAtOpen(null);
          }, 2500);
        }
      } catch (error) {
        console.error("Balance poll error:", error);
      }
    }, 3000); // Poll every 3 seconds when modal is open

    return () => clearInterval(pollInterval);
  }, [showQR, isWalletReady, balanceAtOpen, balance]);

  // Reset state when modal closes
  const handleQROpenChange = (open: boolean) => {
    setShowQR(open);
    if (open) {
      setDepositSuccess(null);
      setBalanceAtOpen(balance);
    } else {
      setBalanceAtOpen(null);
      setDepositSuccess(null);
    }
  };

  const handleCopy = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast({ title: "Address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    if (confirmText !== "EXPORT") {
      toast({
        title: "Please confirm",
        description: 'Type "EXPORT" to confirm',
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      await exportWallet();
      toast({ title: "Export initiated", description: "Follow the secure export flow" });
      setShowExport(false);
      setConfirmText("");
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const truncateAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (!isWalletReady || !walletAddress) {
    return (
      <Card className={`gate-card p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Embedded Wallet</h3>
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-muted/50 rounded animate-pulse" />
          <div className="h-10 bg-muted/50 rounded animate-pulse" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={`gate-card p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Embedded Wallet</h3>
            <p className="text-xs text-muted-foreground">Powered by Privy</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchBalance} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Balance */}
      <div className="text-center py-4 bg-secondary/30 rounded-lg mb-4">
        <p className="text-xs text-muted-foreground mb-1">Balance</p>
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-3xl font-bold">
            {isLoading ? "..." : (balance?.toFixed(4) ?? "0.0000")}
          </span>
          <span className="text-lg text-muted-foreground">SOL</span>
        </div>
      </div>

      {/* Address */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-background/50 rounded-lg px-3 py-2 font-mono text-sm text-muted-foreground truncate">
          {truncateAddress(walletAddress)}
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => window.open(`https://solscan.io/account/${walletAddress}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Deposit / QR Code */}
        <Dialog open={showQR} onOpenChange={handleQROpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Deposit SOL
              </DialogTitle>
              <DialogDescription>
                Scan this QR code or copy the address to send SOL
              </DialogDescription>
            </DialogHeader>
            
            {depositSuccess ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Check className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">Deposit Received!</h3>
                  <p className="text-2xl font-bold">+{depositSuccess.amount.toFixed(4)} SOL</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your wallet has been updated
                  </p>
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
                <p className="text-xs text-muted-foreground text-center">
                  Send SOL from any exchange or wallet to this address
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Export Key */}
        <Dialog open={showExport} onOpenChange={(open) => {
          setShowExport(open);
          if (!open) setConfirmText("");
        }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2">
              <Key className="h-4 w-4" />
              Export Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Export Private Key
              </DialogTitle>
              <DialogDescription>
                Export your private key to use in other wallets
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>WARNING:</strong> Never share your private key. Anyone with it has full control over your funds.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label className="text-sm">Type "EXPORT" to confirm</Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type EXPORT"
                  className="font-mono"
                />
              </div>

              <Button
                variant="destructive"
                className="w-full"
                onClick={handleExport}
                disabled={isExporting || confirmText !== "EXPORT"}
              >
                {isExporting ? "Exporting..." : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Export Private Key
                  </>
                )}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Keys are encrypted and only accessible by you</p>
                <p>• Store exported keys in a secure location</p>
                <p>• Import to Phantom, Solflare, or any Solana wallet</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}
