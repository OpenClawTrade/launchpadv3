import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendUp, 
  Key, 
  Wallet, 
  SignOut, 
  Scales,
  XLogo,
  ChartLine,
  List,
  Copy,
  Check
} from "@phosphor-icons/react";
import { ExternalLink, Menu } from "lucide-react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { toast } from "sonner";

const TUNA_CA = "AeeP5ebA5R8srQZkkYwfNyvgYWFtxYqFfc6E6qqypump";
const HEADER_LOGO_SRC = "/tuna-logo.png";

interface AppHeaderProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ showBack, backTo = "/", backLabel }: AppHeaderProps) {
  const { isAuthenticated, login, logout, solanaAddress } = useAuth();
  const [copied, setCopied] = useState(false);

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
    <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50 w-full">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Logo section */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img src={HEADER_LOGO_SRC} alt="TUNA" className="h-8 w-8 rounded-lg object-cover" loading="eager" />
            <span className="text-lg font-bold">TUNA</span>
          </Link>
          {showBack && backLabel && (
            <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
              <span className="text-muted-foreground/50">|</span>
              <span className="text-sm">{backLabel}</span>
            </div>
          )}
        </div>
        
        {/* Desktop navigation */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1">
            <SolPriceDisplay />
          </div>
          
          {/* CA Display */}
          <button
            onClick={copyCA}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1f] hover:bg-[#252530] rounded-md text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Click to copy CA"
          >
            <span className="font-mono">CA: {TUNA_CA.slice(0, 4)}...{TUNA_CA.slice(-4)}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-400" weight="bold" />
            ) : (
              <Copy className="h-3 w-3" weight="bold" />
            )}
          </button>
          
          <a 
            href="https://dune.com/tunalaunch/stats"
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-orange-500/10 transition-colors"
            title="View Analytics on Dune"
          >
            <ChartLine className="h-4 w-4 text-orange-400 hover:text-orange-300" weight="bold" />
          </a>
          
          <a 
            href="https://x.com/buildtuna" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
            title="Follow us on X"
          >
            <XLogo className="h-4 w-4 text-muted-foreground hover:text-foreground" weight="fill" />
          </a>
          
          <Link to="/trending">
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-xs sm:text-sm font-medium"
            >
              <TrendUp className="h-4 w-4 mr-1.5" weight="bold" />
              Narratives
            </Button>
          </Link>
          
          <Link to="/api">
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-xs sm:text-sm font-medium"
            >
              <Key className="h-4 w-4 mr-1.5" weight="bold" />
              API
            </Button>
          </Link>
          
          <Link to="/governance">
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg h-9 px-3 text-xs sm:text-sm font-medium"
            >
              <Scales className="h-4 w-4 mr-1.5" weight="bold" />
              Governance
            </Button>
          </Link>

          {isAuthenticated && solanaAddress ? (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1f] rounded-md text-xs text-gray-300">
                <Wallet className="h-3 w-3" weight="bold" />
                {truncateAddress(solanaAddress)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
                title="Disconnect"
              >
                <SignOut className="h-4 w-4" weight="bold" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => login()}
              className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3"
            >
              <Wallet className="h-4 w-4 mr-1" weight="bold" />
              Connect
            </Button>
          )}
        </div>
        
        {/* Mobile navigation */}
        <div className="flex sm:hidden items-center gap-2">
          <div className="flex items-center gap-0.5">
            <SolPriceDisplay />
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-[#0d0d0f] border-[#1a1a1f] p-0">
              <div className="flex flex-col h-full">
                {/* Menu header */}
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <img src={HEADER_LOGO_SRC} alt="TUNA" className="h-8 w-8 rounded-lg object-cover" loading="eager" />
                  <span className="text-lg font-bold">TUNA</span>
                </div>
                
                {/* Auth section */}
                <div className="p-4 border-b border-[#1a1a1f]">
                  {isAuthenticated && solanaAddress ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1f] rounded-lg text-sm text-gray-300">
                        <Wallet className="h-4 w-4" weight="bold" />
                        {truncateAddress(solanaAddress)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => logout()}
                        className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                        title="Disconnect"
                      >
                        <SignOut className="h-4 w-4" weight="bold" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => login()}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Wallet className="h-4 w-4 mr-2" weight="bold" />
                      Connect Wallet
                    </Button>
                  )}
                </div>
                
                {/* Menu items */}
                <nav className="flex-1 p-4 space-y-2">
                  <Link to="/trending" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors">
                    <TrendUp className="h-4 w-4 text-primary-foreground" weight="bold" />
                    <span className="text-primary-foreground text-sm font-medium">Narratives</span>
                  </Link>
                  
                  <Link to="/api" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors">
                    <Key className="h-4 w-4 text-primary-foreground" weight="bold" />
                    <span className="text-primary-foreground text-sm font-medium">API</span>
                  </Link>
                  
                  <Link to="/governance" className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 transition-colors">
                    <Scales className="h-4 w-4 text-primary-foreground" weight="bold" />
                    <span className="text-primary-foreground text-sm font-medium">Governance</span>
                  </Link>
                  
                  <div className="pt-4 border-t border-[#1a1a1f] space-y-2">
                    <a 
                      href="https://dune.com/tunalaunch/stats" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1a1f] transition-colors"
                    >
                      <ChartLine className="h-5 w-5 text-orange-400" weight="bold" />
                      <span className="text-gray-300">Analytics (Dune)</span>
                      <ExternalLink className="h-3 w-3 text-gray-500 ml-auto" />
                    </a>
                    
                    <a 
                      href="https://x.com/buildtuna" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1a1a1f] transition-colors"
                    >
                      <XLogo className="h-5 w-5 text-gray-400" weight="fill" />
                      <span className="text-gray-300">Follow on X</span>
                      <ExternalLink className="h-3 w-3 text-gray-500 ml-auto" />
                    </a>
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
