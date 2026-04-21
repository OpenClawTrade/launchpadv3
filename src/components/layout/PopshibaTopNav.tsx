import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, Plus } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import popshibaLogo from "@/assets/popshiba-logo.png";
import { CreatorFeesPill } from "./CreatorFeesPill";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Pulse", to: "/launchpad" },
  { label: "Trade", to: "/trade" },
  { label: "Launchpad", to: "/launch" },
  { label: "Discover", to: "/discover" },
  { label: "Alpha", to: "/alpha-tracker" },
  { label: "X Tracker", to: "/x-tracker" },
  { label: "Docs", to: "/docs" },
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

        {/* Desktop links */}
        <nav className="hidden lg:flex gap-5 text-[13px] font-bold flex-wrap">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.to || (link.to !== "/" && pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-0.5 py-1 transition-colors ${
                  active ? "text-pop-cream" : "text-pop-cream/85 hover:text-pop-cream"
                }`}
              >
                {link.label}
                <span
                  className={`absolute left-0 right-0 -bottom-0.5 h-[3px] bg-pop-orange transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right (desktop) */}
        <div className="hidden md:flex ml-auto items-center gap-2.5">
          <SocialLinks />
          <CreatorFeesPill />
          <WalletPill />
          <Link
            to="/launch"
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
                to="/launch"
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
  const sizeCls = compact ? "w-8 h-8" : "w-9 h-9";
  const iconCls = compact ? "w-3.5 h-3.5" : "w-4 h-4";
  const base =
    "inline-flex items-center justify-center border-[1.5px] border-pop-orange bg-pop-ink-soft text-pop-cream hover:bg-pop-orange hover:text-pop-ink transition-colors";
  return (
    <div className="flex items-center gap-1.5">
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
  const { user, login, authenticated } = usePrivy();
  const evm =
    (user?.wallet?.address as string | undefined) ||
    ((user?.linkedAccounts ?? []).find((a: any) => a?.type === "wallet" && typeof a?.address === "string") as any)
      ?.address as string | undefined;
  const short = evm ? `${evm.slice(0, 6)}…${evm.slice(-4)}` : null;

  if (!authenticated || !short) {
    return (
      <button
        onClick={() => login()}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-[11px] uppercase font-pop-mono tracking-[0.08em] bg-pop-ink-soft border-[1.5px] border-pop-orange text-pop-cream ${className}`}
      >
        Connect
      </button>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-3.5 py-2 text-[11px] uppercase font-pop-mono tracking-[0.08em] bg-pop-ink-soft border-[1.5px] border-pop-orange text-pop-cream ${className}`}
    >
      <span className="inline-block w-2 h-2 rounded-full bg-[#5ce68e] shadow-[0_0_8px_#5ce68e]" />
      {short}
    </span>
  );
}
