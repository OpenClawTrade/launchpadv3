import { Link } from "react-router-dom";
import { Search, Plus, Menu } from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { usePanelNav } from "@/hooks/usePanelNav";
import clawLogo from "@/assets/claw-logo.png";

interface TopBarProps {
  onMobileMenuOpen?: () => void;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ onMobileMenuOpen }: TopBarProps) {
  const { chain } = useChain();
  const [search, setSearch] = useState("");
  const { goToPanel } = usePanelNav();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 bg-background border-b border-border"
      style={{ height: "52px" }}
    >
      {/* Mobile hamburger */}
      <button
        className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200"
        onClick={onMobileMenuOpen}
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Chain switcher */}
      <div className="hidden sm:block flex-shrink-0">
        <ChainSwitcher />
      </div>

      {/* Search input */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-9 pr-3 text-[13px] rounded-xl outline-none text-foreground placeholder-muted-foreground bg-surface border border-border transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/20 focus-ring-purple"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}

        <a
          href="https://x.com/clawmode"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-7 w-7 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-surface-hover hover:rotate-[8deg]"
        >
          <XLogo className="h-3.5 w-3.5" weight="fill" />
        </a>

        <button
          onClick={goToPanel}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all duration-200 hover:bg-surface-hover hover-lift flex-shrink-0 border border-success/40 text-success cursor-pointer"
        >
          <img src={clawLogo} alt="" className="h-4 w-4 rounded-sm" />
          Panel
        </button>

        <Link
          to="/?create=1"
          className="hidden sm:flex items-center gap-1.5 h-8 px-4 rounded-xl text-[12px] font-bold text-white btn-gradient-green flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Token
        </Link>
      </div>
    </header>
  );
}
