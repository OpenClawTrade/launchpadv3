import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ai69xLogo from "@/assets/ai69x-logo.png";
import { 
  TrendUp, 
  Key, 
  Wallet, 
  SignOut, 
  Scales,
  XLogo,
  ChartLine
} from "@phosphor-icons/react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { Ai67xPriceDisplay } from "./Ai67xPriceDisplay";

interface AppHeaderProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ showBack, backTo = "/", backLabel }: AppHeaderProps) {
  const { isAuthenticated, login, logout, solanaAddress } = useAuth();

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  return (
    <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50 w-full">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        {/* Logo section - always visible */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img src={ai69xLogo} alt="ai67x" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
            <span className="text-base sm:text-lg font-bold text-white">ai67x</span>
          </Link>
          {showBack && backLabel && (
            <div className="hidden sm:flex items-center gap-2 text-gray-400">
              <span className="text-gray-600">|</span>
              <span className="text-sm">{backLabel}</span>
            </div>
          )}
        </div>
        
        {/* Right navigation - responsive */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          {/* Price displays */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            <Ai67xPriceDisplay />
            <SolPriceDisplay />
          </div>
          
          {/* Icon links */}
          <a 
            href="https://dune.com/ai67xlaunch/stats" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-orange-500/10 transition-colors flex-shrink-0"
            title="View Analytics on Dune"
          >
            <ChartLine className="h-4 w-4 text-orange-400 hover:text-orange-300" weight="bold" />
          </a>
          
          <a 
            href="https://x.com/ai67x_fun" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
            title="Follow us on X"
          >
            <XLogo className="h-4 w-4 text-gray-400 hover:text-white" weight="fill" />
          </a>
          
          {/* Nav buttons - icon only on mobile */}
          <Link to="/trending" className="flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 w-8 sm:w-auto px-0 sm:px-3"
            >
              <TrendUp className="h-4 w-4 sm:mr-1" weight="bold" />
              <span className="hidden sm:inline">Narratives</span>
            </Button>
          </Link>
          
          <Link to="/api" className="flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 w-8 sm:w-auto px-0 sm:px-3"
            >
              <Key className="h-4 w-4 sm:mr-1" weight="bold" />
              <span className="hidden sm:inline">API</span>
            </Button>
          </Link>
          
          <Link to="/governance" className="flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-8 w-8 sm:w-auto px-0 sm:px-3"
            >
              <Scales className="h-4 w-4 sm:mr-1" weight="bold" />
              <span className="hidden sm:inline">Governance</span>
            </Button>
          </Link>

          {/* Auth section */}
          {isAuthenticated && solanaAddress ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#1a1a1f] rounded-md text-xs text-gray-300">
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
              className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-2 sm:px-3 flex-shrink-0"
            >
              <Wallet className="h-4 w-4 sm:mr-1" weight="bold" />
              <span className="hidden sm:inline">Connect</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
