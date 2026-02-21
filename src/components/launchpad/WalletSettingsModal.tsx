import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Eye, EyeOff, Copy, Check, AlertTriangle, Key, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";

interface WalletSettingsModalProps {
  walletAddress?: string;
}

export function WalletSettingsModal({ walletAddress }: WalletSettingsModalProps) {
  const { exportWallet } = useExportWallet();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleExportPrivateKey = async () => {
    if (confirmText !== "EXPORT") {
      toast({
        title: "Please confirm",
        description: 'Type "EXPORT" to confirm you understand the risks',
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Privy's exportWallet opens a secure modal for private key export
      await exportWallet();
      toast({
        title: "Export initiated",
        description: "Follow the Privy secure export flow",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast({ title: "Address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Wallet Settings
          </DialogTitle>
          <DialogDescription>
            Manage your embedded Solana wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Wallet Address</Label>
            <div className="flex items-center gap-2">
              <Input
                value={walletAddress || "Not connected"}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyAddress}
                disabled={!walletAddress}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Security Warning */}
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>WARNING:</strong> Never share your private key with anyone. Anyone with your private key has full control over your wallet and funds.
            </AlertDescription>
          </Alert>

          {/* Export Private Key Section */}
          <div className="space-y-3 p-4 bg-secondary/50 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Export Private Key</Label>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Exporting your private key allows you to import this wallet into other applications like Phantom, Solflare, or any Solana-compatible wallet.
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Type "EXPORT" to confirm you understand the risks
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Type EXPORT here"
                className="font-mono"
              />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleExportPrivateKey}
              disabled={isExporting || confirmText !== "EXPORT"}
            >
              {isExporting ? (
                "Exporting..."
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Export Private Key
                </>
              )}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Your wallet is secured by Privy's embedded wallet infrastructure</p>
            <p>• Private keys are encrypted and only accessible by you</p>
            <p>• Store your exported key in a secure location</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
