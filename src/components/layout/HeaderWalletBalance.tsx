import { useEffect, useState, useRef } from "react";
import { Copy, Check, Wallet, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

function HeaderWalletBalanceInner() {
  const { isAuthenticated, logout } = useAuth();
  const { walletAddress: embeddedAddress, getBalance } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!embeddedAddress) return;
    let cancelled = false;

    const fetchBal = async () => {
      try {
        const bal = await getBalance();
        if (!cancelled) setBalance(bal);
      } catch (e) {
        console.warn("Header balance fetch failed:", e);
      }
    };

    fetchBal();
    const interval = setInterval(fetchBal, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [embeddedAddress, getBalance]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!isAuthenticated || !embeddedAddress) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(embeddedAddress);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied", description: "Send SOL to this address to top up" });
      setTimeout(() => setCopied(false), 2000);
    }
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all duration-200 hover:bg-surface-hover flex-shrink-0 border border-border cursor-pointer group"
        title="Wallet menu"
      >
        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground font-mono">
          {balance !== null
            ? `${balance.toFixed(3)} SOL`
            : `${embeddedAddress.slice(0, 4)}..${embeddedAddress.slice(-4)}`}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-44 rounded-xl overflow-hidden z-50 border border-border"
          style={{ background: "rgba(15,23,42,0.95)", backdropFilter: "blur(12px)" }}
        >
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            Copy Address
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-destructive hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function HeaderWalletBalance() {
  const privyAvailable = usePrivyAvailable();
  const { isAuthenticated } = useAuth();

  if (!privyAvailable || !isAuthenticated) return null;

  return <HeaderWalletBalanceInner />;
}
