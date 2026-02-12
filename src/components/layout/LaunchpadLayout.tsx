import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TokenTickerBar } from "@/components/launchpad/TokenTickerBar";
import { KingOfTheHill } from "@/components/launchpad/KingOfTheHill";
import { SolPriceDisplay } from "@/components/layout/SolPriceDisplay";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { Footer } from "@/components/layout/Footer";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { Menu, TrendingUp, Bot } from "lucide-react";
import { XLogo, Fish, ArrowsClockwise } from "@phosphor-icons/react";
import { MigrationPopup } from "@/components/migration/MigrationPopup";

const HEADER_LOGO_SRC = "/tuna-logo.png";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
}

export function LaunchpadLayout({ children, showKingOfTheHill = true }: LaunchpadLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { onlineCount } = useVisitorTracking();

  return (
    <div className="gate-theme dark min-h-screen">
      {/* Header */}
      <header className="gate-header">
        <div className="gate-header-inner">
        <div className="flex items-center gap-3">
          <Link to="/" className="gate-logo" aria-label="TUNA OS">
            <img
              src={HEADER_LOGO_SRC}
              alt="TUNA OS"
              className="h-8 w-8 rounded-lg object-cover"
              loading="eager"
            />
            <span className="text-lg font-bold">TUNA OS</span>
          </Link>
          
          {/* Chain Switcher */}
          <div className="hidden sm:block">
            <ChainSwitcher />
          </div>
        </div>

          <nav className="hidden md:flex items-center gap-2">
            <Link to="/migrate">
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground rounded-lg h-9 px-3 text-sm font-medium gap-1.5">
                <ArrowsClockwise className="h-4 w-4" weight="bold" />
                Migrate
              </Button>
            </Link>
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
                OpenTuna
              </Button>
            </Link>
            
            {/* Visitors Online */}
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-secondary/50 border border-border">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{onlineCount ?? '—'}</span> Online
              </span>
            </div>
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
            <SolPriceDisplay />
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" className="gate-btn-ghost h-10 w-10">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border">
                <nav className="flex flex-col gap-2 mt-8">
                  <Link to="/migrate" className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    <ArrowsClockwise className="h-4 w-4" weight="bold" />
                    <span className="text-foreground text-sm font-medium">Migrate</span>
                  </Link>
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
                    <span className="text-foreground text-sm font-medium">OpenTuna</span>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Ticker Bar */}
      <div className="mt-4">
        <TokenTickerBar />
      </div>

      {/* King of the Hill */}
      {showKingOfTheHill && (
        <div className="max-w-[1400px] mx-auto px-4 pt-6">
          <KingOfTheHill />
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <Footer />
      <MigrationPopup />
    </div>
  );
}
