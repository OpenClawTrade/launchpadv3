import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Search, Plus, Menu, X, Gift } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { useState, useEffect, useCallback, useRef } from "react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { BnbPriceDisplay } from "./BnbPriceDisplay";
import { BtcPriceDisplay } from "./BtcPriceDisplay";

import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { usePanelNav } from "@/hooks/usePanelNav";
import { HeaderWalletBalance } from "./HeaderWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import popshibaLogo from "@/assets/popshiba-logo.png";
import { BRAND } from "@/config/branding";
import { useTokenSearch } from "@/hooks/useTokenSearch";
import { GlobalSearchDropdown } from "@/components/search/GlobalSearchDropdown";
import { NotLoggedInModal } from "@/components/launchpad/NotLoggedInModal";
import { BtcWalletConnect } from "@/components/bitcoin/BtcWalletConnect";
import { SaturnTokenPriceDisplay } from "./SaturnTokenPriceDisplay";

interface TopBarProps {
  onMobileMenuOpen?: () => void;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ onMobileMenuOpen }: TopBarProps) {
  const { chain } = useChain();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnTrade = location.pathname === "/trade";
  const isBtcMode = location.pathname.startsWith("/btc");

  const [search, setSearch] = useState(() => isOnTrade ? (searchParams.get("q") || "") : "");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLaunchAppModal, setShowLaunchAppModal] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: searchResults = [], isLoading: searchLoading } = useTokenSearch(debouncedQuery);

  useEffect(() => {
    if (isOnTrade) {
      setSearch(searchParams.get("q") || "");
    } else {
      setSearch("");
    }
  }, [location.pathname]);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Show dropdown when we have a query
  useEffect(() => {
    setShowDropdown(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  // Close dropdown on route change
  useEffect(() => {
    setShowDropdown(false);
  }, [location.pathname]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (isOnTrade) {
      if (value.trim()) {
        setSearchParams({ q: value }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [isOnTrade, setSearchParams]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim()) {
      if (!isOnTrade) {
        navigate(`/trade?q=${encodeURIComponent(search.trim())}`);
        setMobileSearchOpen(false);
      }
      setShowDropdown(false);
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
      setMobileSearchOpen(false);
    }
  }, [search, isOnTrade, navigate]);

  const closeDropdown = useCallback(() => setShowDropdown(false), []);

  const { goToPanel } = usePanelNav();
  const handleLaunchAppClick = useCallback(() => {
    setShowDropdown(false);
    setMobileSearchOpen(false);

    if (isAuthenticated) {
      goToPanel();
      return;
    }
    setShowLaunchAppModal(true);
  }, [goToPanel, isAuthenticated]);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 px-3 md:sticky md:gap-4 lg:gap-5 md:px-5 lg:px-6 bg-pop-ink border-b-[3px] border-pop-orange"
        style={{
          height: "calc(56px + env(safe-area-inset-top, 0px))",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex items-center gap-3 md:gap-4 lg:gap-5 w-full max-w-[1800px] mx-auto">
          {/* ── Left: Hamburger + Brand + Chain + Search ── */}
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-pop-ink bg-pop-cream pop-border transition-transform duration-150 hover:-translate-y-[2px]"
              onClick={onMobileMenuOpen}
            >
              <Menu className="h-4 w-4" strokeWidth={2.5} />
            </button>

            <Link to="/" className="md:hidden flex items-center gap-1.5">
              <img src={popshibaLogo} alt="PopShiba" className="h-7 w-7" />
              <span className="font-pop-display text-pop-orange text-sm uppercase">Pop</span>
            </Link>

            <div className="hidden sm:block flex-shrink-0">
              <ChainSwitcher />
            </div>

            <div className="hidden md:block relative z-[60] w-56 lg:w-72 xl:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-pop-cream/50" />
              <input
                type="text"
                placeholder="Search token..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if (debouncedQuery.length >= 2) setShowDropdown(true); }}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-md outline-none
                           text-pop-cream placeholder-pop-cream/40
                           font-pop-mono tracking-wide
                           bg-[#231c16] border-[1.5px] border-pop-orange/60
                           transition-all duration-150
                           focus:border-pop-orange"
              />
              {showDropdown && (
                <div className="absolute left-0 top-full mt-2 w-[min(720px,calc(100vw-2rem))] z-[60]">
                  <GlobalSearchDropdown
                    results={searchResults}
                    isLoading={searchLoading}
                    query={debouncedQuery}
                    onClose={closeDropdown}
                  />
                </div>
              )}
            </div>

            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md text-pop-ink bg-pop-cream pop-border ml-auto transition-transform duration-150 hover:-translate-y-[2px]"
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <div className="hidden md:flex flex-1 items-center justify-center gap-2">
            {isBtcMode ? <BtcPriceDisplay /> : chain === 'bnb' ? <BnbPriceDisplay /> : <EthPriceDisplay />}
          </div>

          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <div className="md:hidden flex items-center gap-1.5">
              {isBtcMode ? <BtcPriceDisplay /> : chain === 'bnb' ? <BnbPriceDisplay /> : <EthPriceDisplay />}
            </div>

            <a
              href="https://x.com/saturnterminal"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-md bg-[#231c16] border-[1.5px] border-pop-orange/60 text-pop-orange transition-transform duration-150 hover:-translate-y-[2px]"
            >
              <XIcon className="h-3.5 w-3.5" />
            </a>

            {isBtcMode ? (
              <BtcWalletConnect />
            ) : (
              <>
                {isAuthenticated && (
                  <div className="hidden sm:block">
                    <HeaderWalletBalance />
                  </div>
                )}

                <button
                  onClick={handleLaunchAppClick}
                  className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-md text-[11px] font-pop-display uppercase
                             bg-transparent border-2 border-pop-cream text-pop-cream
                             shadow-[3px_3px_0_0_hsl(var(--pop-orange))]
                             transition-transform duration-150 hover:-translate-x-[1px] hover:-translate-y-[1px]
                             cursor-pointer flex-shrink-0"
                >
                  <span>{isAuthenticated ? 'Dashboard' : 'Launch app'}</span>
                </button>

                <Link
                  to="/launchpad"
                  className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-md text-[11px] font-pop-display uppercase
                             bg-pop-orange text-pop-ink border-2 border-pop-ink
                             shadow-[3px_3px_0_0_hsl(var(--pop-ink))]
                             transition-transform duration-150 hover:-translate-x-[1px] hover:-translate-y-[1px]
                             flex-shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                  <span className="hidden sm:inline">Create</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen search overlay ── */}
      {mobileSearchOpen && (
        <div
          className="fixed inset-0 z-[70] flex flex-col md:hidden animate-fade-in"
          style={{
            background: "hsl(0 0% 0% / 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          {/* Sticky search bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search token..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                className="w-full h-12 pl-10 pr-4 text-sm rounded-xl outline-none
                           text-foreground placeholder-muted-foreground/50
                           font-mono tracking-wide
                           border border-border/30 bg-card/30
                           focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => { setMobileSearchOpen(false); setShowDropdown(false); setSearch(""); }}
              className="flex-shrink-0 h-12 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors bg-card/20"
            >
              Cancel
            </button>
          </div>
          {/* Mobile search results */}
          {debouncedQuery.length >= 2 && (
            <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),12px)]">
              <GlobalSearchDropdown
                results={searchResults}
                isLoading={searchLoading}
                query={debouncedQuery}
                onClose={() => { setMobileSearchOpen(false); setSearch(""); }}
                inline
              />
            </div>
          )}
        </div>
      )}
      <NotLoggedInModal open={showLaunchAppModal} onOpenChange={setShowLaunchAppModal} />
    </>
  );
}
