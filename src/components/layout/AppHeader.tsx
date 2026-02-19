import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  XLogo,
  Copy,
  Check,
  FileText,
  ChartLine,
  Fish,
  ArrowsClockwise,
  Wallet,
  SignOut,
} from "@phosphor-icons/react";
import { ExternalLink, Menu, Bot } from "lucide-react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { toast } from "sonner";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";

const TUNA_CA = "AeeP5ebA5R8srQZkkYwfNyvgYWFtxYqFfc6E6qqypump";
const HEADER_LOGO_SRC = "/claw-logo.png";

interface AppHeaderProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ showBack, backTo = "/", backLabel }: AppHeaderProps) {
  const { isAuthenticated, login, logout, solanaAddress } = useAuth();
  const { chain } = useChain();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const copyCA = () => {
    navigator.clipboard.writeText(TUNA_CA);
    setCopied(true);
    toast.success("CA copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="gate-header">
      <div className="gate-header-inner">
        <div className="flex items-center gap-3">
          <Link to="/" className="gate-logo" aria-label="Claw Mode">
            <img
              src={HEADER_LOGO_SRC}
              alt="Claw Mode"
              className="h-8 w-8 rounded-lg object-cover"
              loading="eager"
            />
            <span className="text-lg font-bold">Claw Mode</span>
          </Link>
          
          <div className="hidden sm:block">
            <ChainSwitcher />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-2">
          <Link to="/trade">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-sm font-medium">
              Trade
            </Button>
          </Link>
          <Link to="/trending">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
              Trending
            </Button>
          </Link>
          <Link to="/api">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium">
              API
            </Button>
          </Link>
          <Link to="/agents">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium gap-1.5">
              <Bot className="h-4 w-4" />
              Agents
            </Button>
          </Link>
          <Link to="/opentuna">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium gap-1.5">
              <Fish className="h-4 w-4" weight="duotone" />
              Claw SDK
            </Button>
          </Link>
          <Link to="/migrate">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-lg h-9 px-3 text-sm font-medium gap-1.5">
              <ArrowsClockwise className="h-4 w-4" weight="bold" />
              Migrate
            </Button>
          </Link>
          
          {/* Visitors Online - could be added here if needed */}
        </nav>

        <div className="flex items-center gap-2">
          <a 
            href="https://x.com/buildtuna" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
            title="Follow us on X"
          >
            <XLogo className="h-4 w-4 text-muted-foreground hover:text-foreground" weight="fill" />
          </a>
          {chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}
          
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="gate-btn-ghost h-10 w-10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-border">
              <nav className="flex flex-col gap-2 mt-8">
                {/* Mobile Chain Switcher */}
                <div className="px-4 py-2 border-b border-border mb-2">
                  <p className="text-xs text-muted-foreground mb-2">Select Chain</p>
                  <ChainSwitcher variant="default" />
                </div>
                
                <Link to="/trade" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-primary-foreground text-sm font-medium">Trade</span>
                </Link>
                <Link to="/trending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-foreground text-sm font-medium">Trending</span>
                </Link>
                <Link to="/api" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <span className="text-foreground text-sm font-medium">API</span>
                </Link>
                <Link to="/agents" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <Bot className="h-4 w-4" />
                  <span className="text-foreground text-sm font-medium">Agents</span>
                </Link>
                <Link to="/opentuna" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <Fish className="h-4 w-4" weight="duotone" />
                  <span className="text-foreground text-sm font-medium">Claw SDK</span>
                </Link>
                <Link to="/migrate" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 transition-colors" onClick={() => setMobileMenuOpen(false)}>
                  <ArrowsClockwise className="h-4 w-4 text-white" weight="bold" />
                  <span className="text-white text-sm font-medium">Migrate</span>
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
