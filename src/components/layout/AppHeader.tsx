import { Link } from "react-router-dom";
import { Search, Plus, Menu } from "lucide-react";
import { XLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";

interface TopBarProps {
  onMobileMenuOpen?: () => void;
  // Legacy props accepted but ignored (kept for other pages that pass them)
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ onMobileMenuOpen }: TopBarProps) {
  const { chain } = useChain();
  const [search, setSearch] = useState("");

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4"
      style={{
        height: "52px",
        background: "#141414",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      {/* Mobile hamburger */}
      <button
        className="md:hidden flex items-center justify-center h-8 w-8 rounded text-white/50 hover:text-white hover:bg-white/5 transition-colors"
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
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: "#666" }} />
        <input
          type="text"
          placeholder="Search for token..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md outline-none text-white placeholder-[#555] transition-colors"
          style={{
            background: "#2a2a2a",
            border: "1px solid #333",
            color: "#fff",
          }}
          onFocus={e => (e.target.style.borderColor = "#4ade80")}
          onBlur={e => (e.target.style.borderColor = "#333")}
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}

        <a
          href="https://x.com/buildtuna"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-7 w-7 rounded transition-colors hover:bg-white/5"
          style={{ color: "#666" }}
        >
          <XLogo className="h-3.5 w-3.5" weight="fill" />
        </a>

        <Link
          to="/?create=1"
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-bold text-black transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: "#4ade80" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Token
        </Link>
      </div>
    </header>
  );
}
