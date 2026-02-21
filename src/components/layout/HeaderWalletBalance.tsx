import { useEffect, useState, lazy, Suspense } from "react";
import { Copy, Check, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

function HeaderWalletBalanceInner() {
  const { solanaAddress, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Dynamically import the privy wallet hook only when privy is available
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!solanaAddress) return;
    let cancelled = false;

    const fetchBal = async () => {
      try {
        const { useSolanaWalletWithPrivy } = await import("@/hooks/useSolanaWalletPrivy");
        // We can't call hooks dynamically, so use RPC directly
        const { Connection, PublicKey, clusterApiUrl } = await import("@solana/web3.js");
        const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
        const connection = new Connection(rpcUrl, "confirmed");
        const bal = await connection.getBalance(new PublicKey(solanaAddress));
        if (!cancelled) setBalance(bal / 1e9);
      } catch (e) {
        console.warn("Header balance fetch failed:", e);
      }
    };

    fetchBal();
    const interval = setInterval(fetchBal, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [solanaAddress]);

  if (!isAuthenticated || !solanaAddress) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(solanaAddress);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied", description: "Send SOL to this address to top up" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all duration-200 hover:bg-surface-hover flex-shrink-0 border border-border cursor-pointer group"
      title="Click to copy wallet address"
    >
      <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground font-mono">
        {balance !== null ? `${balance.toFixed(3)} SOL` : "..."}
      </span>
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      </span>
    </button>
  );
}

export function HeaderWalletBalance() {
  const privyAvailable = usePrivyAvailable();
  const { isAuthenticated } = useAuth();

  if (!privyAvailable || !isAuthenticated) return null;

  return <HeaderWalletBalanceInner />;
}
