import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { XLogo, Fish } from "@phosphor-icons/react";
import { Menu, Bot, FileText, ArrowLeftRight } from "lucide-react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const HEADER_LOGO_SRC = "/claw-logo.png";

interface AppHeaderProps {
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

const NAV_LINKS = [
  { to: "/trade", label: "Trade" },
  { to: "/trending", label: "Trending" },
  { to: "/api", label: "API" },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/opentuna", label: "SDK", icon: Fish },
  { to: "/migrate", label: "Migrate", icon: ArrowLeftRight },
];

export function AppHeader({ showBack, backTo = "/", backLabel }: AppHeaderProps) {
  const { chain } = useChain();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="gate-header">
      <div className="gate-header-inner">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="gate-logo"
            aria-label="Claw Mode"
          >
            <img
              src={HEADER_LOGO_SRC}
              alt="Claw Mode"
              className="h-7 w-7 object-cover"
              loading="eager"
            />
            <span className="text-[15px] font-bold font-mono text-primary">CLAW</span>
            <span className="text-[15px] font-bold font-mono text-foreground/80">MODE</span>
          </Link>
          <div className="hidden sm:block">
            <ChainSwitcher />
          </div>
        </div>

        {/* Desktop flat nav */}
        <nav className="hidden md:flex items-center">
          {NAV_LINKS.map(({ to, label }) => {
            const isActive = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "px-3 py-1 text-[13px] font-medium transition-colors duration-150 border-b-2",
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to="/whitepaper"
            className="flex items-center justify-center h-7 w-7 rounded hover:bg-white/5 transition-colors"
            title="Whitepaper"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" />
          </Link>
          <a
            href="https://x.com/buildtuna"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center h-7 w-7 rounded hover:bg-white/5 transition-colors"
            title="Follow on X"
          >
            <XLogo className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground" weight="fill" />
          </a>
          {chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}

          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[hsl(240_10%_5%)] border-border w-64">
              <nav className="flex flex-col mt-8">
                <div className="px-4 py-2 border-b border-border mb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Chain</p>
                  <ChainSwitcher variant="default" />
                </div>
                {NAV_LINKS.map(({ to, label }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-2.5 text-sm font-medium transition-colors border-l-2",
                      location.pathname === to || (to !== "/" && location.pathname.startsWith(to))
                        ? "text-primary border-primary bg-primary/5"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  to="/whitepaper"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground border-l-2 border-transparent hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Whitepaper
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
