import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import ai69xLogo from "@/assets/ai69x-logo.png";
import { TrendingUp, Key, Wallet, LogOut, Vote } from "lucide-react";
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
    <header className="border-b border-[#1a1a1f] bg-[#0d0d0f]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={ai69xLogo} alt="ai67x" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
            <span className="text-base sm:text-lg font-bold text-white">ai67x</span>
          </Link>
          {showBack && backLabel && (
            <div className="hidden xs:flex items-center gap-2 text-gray-400">
              <span className="text-gray-600">|</span>
              <span className="text-sm">{backLabel}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <Ai67xPriceDisplay />
          <SolPriceDisplay />
          
          <a 
            href="https://x.com/ai67x_fun" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-colors"
            title="Follow us on X"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400 hover:text-white fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          
          <Link to="/trending">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2 sm:px-3"
            >
              <TrendingUp className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Narratives</span>
            </Button>
          </Link>
          
          <Link to="/api">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-8 px-2 sm:px-3"
            >
              <Key className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">API</span>
            </Button>
          </Link>
          
          <Link to="/governance">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-8 px-2 sm:px-3"
            >
              <Vote className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Governance</span>
            </Button>
          </Link>

          {isAuthenticated && solanaAddress ? (
            <div className="flex items-center gap-1">
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-[#1a1a1f] rounded-md text-xs text-gray-300">
                <Wallet className="h-3 w-3" />
                {truncateAddress(solanaAddress)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-gray-400 hover:text-white h-8 w-8 p-0"
                title="Disconnect"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => login()}
              className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3"
            >
              <Wallet className="h-4 w-4 mr-1" />
              <span className="hidden xs:inline">Connect</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
