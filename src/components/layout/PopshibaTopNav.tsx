import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Menu, X, Plus,
  Home as HomeIcon, LineChart, Users, Sparkles, Twitter, BookOpen,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import popshibaLogo from "@/assets/popshiba-logo.png";
import { CreatorFeesPill } from "./CreatorFeesPill";

// Mirrors the in-iframe template nav on the home page so every page shows the
// exact same primary navigation.
const NAV_LINKS = [
  { label: "Home",    to: "/",           Icon: HomeIcon },
  { label: "Trade",   to: "/ape",        Icon: LineChart },
  { label: "Holders", to: "/holders",    Icon: Users },
  { label: "Alpha",   to: "/alpha",      Icon: Sparkles },
  { label: "Tracker", to: "/x-tracker",  Icon: Twitter },
  { label: "Docs",    to: "/docs",       Icon: BookOpen },
];

/** Tilted brand frame: two stacked rotated squares with the logo on top. */
function BrandFrame() {
  return (
    <span className="relative inline-block w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] flex-shrink-0">
      <span className="absolute inset-0 border border-pop-orange rounded-[2px] bg-[#f5e6c8] -rotate-[6deg] z-0" />
      <span className="absolute inset-0 border border-pop-orange rounded-[2px] bg-white rotate-[3deg] z-[1]" />
      <img
        src={popshibaLogo}
        alt="Popshiba"
        className="relative z-[2] w-[86%] h-[86%] m-[7%] object-contain rotate-[3deg]"
      />
    </span>
  );
}

export function PopshibaTopNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="sticky top-0 z-[100] bg-pop-ink text-pop-cream border-b-[3px] border-pop-orange">
      <div className="max-w-[1440px] mx-auto flex items-center gap-4 lg:gap-6 px-4 sm:px-6 lg:px-7 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 font-pop-display text-[16px] sm:text-[18px] tracking-[-0.02em] text-pop-orange shrink-0">
          <BrandFrame />
          <span>POPSHIBA</span>
        </Link>

        {/* Desktop links — labels only, no icons, matches home page exactly */}
        <nav className="hidden lg:flex gap-6 xl:gap-7 text-[14px] font-bold items-center">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-pop-cream/90 hover:text-pop-cream transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right (desktop) */}
        <div className="hidden md:flex ml-auto items-center gap-2.5">
          <SocialLinks />
          <CreatorFeesPill />
          <WalletPill />
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-bold text-[12px] lg:text-[13px] px-3 lg:px-4 py-2 lg:py-2.5 border-2 border-pop-ink bg-pop-orange text-pop-ink shadow-[3px_3px_0_hsl(var(--pop-ink))] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_hsl(var(--pop-ink))] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_hsl(var(--pop-ink))] transition-all"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            Create
          </Link>
        </div>

        {/* Mobile pill (compact) */}
        <div className="md:hidden ml-auto flex items-center gap-2">
          <SocialLinks compact />
          <CreatorFeesPill />
        </div>

        {/* Mobile burger */}
        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden ml-auto inline-flex items-center justify-center w-10 h-10 border-2 border-pop-cream text-pop-cream"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden border-t-2 border-pop-orange bg-pop-ink max-h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to || (link.to !== "/" && pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-3 font-bold text-[15px] border-l-[3px] ${
                    active
                      ? "border-pop-orange text-pop-cream bg-pop-cream/5"
                      : "border-transparent text-pop-cream/80"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-pop-cream/10">
              <div className="col-span-2 flex justify-center">
                <SocialLinks />
              </div>
              <WalletPill className="col-span-2" />
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 font-bold text-[13px] px-4 py-3 border-2 border-pop-ink bg-pop-orange text-pop-ink col-span-2"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                Create
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ───────── Social Links (Telegram + X) ───────── */
const TELEGRAM_URL = "https://t.me/popshiba_eth";
const X_URL = "https://x.com/PopShiba_launch";

function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.566-4.458c.538-.196 1.006.128.832.938z"/>
    </svg>
  );
}

function XIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function SocialLinks({ compact = false }: { compact?: boolean }) {
  const sizeCls = compact ? "w-9 h-9" : "w-10 h-10";
  const iconCls = compact ? "w-4 h-4" : "w-[18px] h-[18px]";
  const base =
    "inline-flex items-center justify-center border-2 border-pop-orange bg-pop-orange text-pop-ink hover:bg-pop-cream hover:text-pop-ink transition-colors shadow-[2px_2px_0_hsl(var(--pop-ink))]";
  return (
    <div className="flex items-center gap-2">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Popshiba on Telegram"
        title="Telegram"
        className={`${base} ${sizeCls}`}
      >
        <TelegramIcon className={iconCls} />
      </a>
      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Popshiba on X"
        title="X (Twitter)"
        className={`${base} ${sizeCls}`}
      >
        <XIcon className={iconCls} />
      </a>
    </div>
  );
}

function WalletPill({ className = "" }: { className?: string }) {
  const { user, login, logout, authenticated } = usePrivy();
  const [menuOpen, setMenuOpen] = useState(false);
  const evm =
    (user?.wallet?.address as string | undefined) ||
    ((user?.linkedAccounts ?? []).find((a: any) => a?.type === "wallet" && typeof a?.address === "string") as any)
      ?.address as string | undefined;
  const short = evm ? `${evm.slice(0, 6)}…${evm.slice(-4)}` : null;

  // Close on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-wallet-pill]")) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!authenticated || !short) {
    return (
      <button
        onClick={() => {
          // Open Privy's modal directly. Do not touch window.ethereum
          // here — that prompts whichever extension is injected (Trust,
          // Phantom, etc.) before Privy ever appears.
          login();
        }}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-[11px] uppercase font-pop-mono tracking-[0.08em] bg-pop-ink-soft border-[1.5px] border-pop-orange text-pop-cream hover:bg-pop-orange hover:text-pop-ink transition-colors ${className}`}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-pop-cream/60" />
        Connect
      </button>
    );
  }

  return (
    <div data-wallet-pill className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-[11px] uppercase font-pop-mono tracking-[0.08em] bg-pop-ink-soft border-[1.5px] border-pop-orange text-pop-cream hover:bg-pop-orange hover:text-pop-ink transition-colors w-full justify-center"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-[#5ce68e] shadow-[0_0_8px_#5ce68e]" />
        {short}
        <svg viewBox="0 0 12 12" className={`w-2.5 h-2.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true">
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 min-w-[200px] bg-pop-ink border-2 border-pop-orange shadow-[3px_3px_0_hsl(var(--pop-ink))] z-[200] overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={() => {
              if (evm) navigator.clipboard?.writeText(evm).catch(() => {});
              setMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 text-[12px] font-bold text-pop-cream hover:bg-pop-cream/10 transition-colors"
          >
            Copy address
          </button>
          <Link
            role="menuitem"
            to="/earnings"
            onClick={() => setMenuOpen(false)}
            className="block w-full text-left px-3 py-2.5 text-[12px] font-bold text-pop-cream hover:bg-pop-cream/10 transition-colors border-t border-pop-cream/10"
          >
            Earnings
          </Link>
          <button
            role="menuitem"
            onClick={async () => {
              setMenuOpen(false);
              try { await logout(); } catch (e) { console.error("logout failed", e); }
            }}
            className="w-full text-left px-3 py-2.5 text-[12px] font-bold text-pop-ink bg-pop-orange hover:brightness-95 transition-all border-t-2 border-pop-ink"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
