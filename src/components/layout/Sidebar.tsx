import { Link, useLocation } from "react-router-dom";
import { Home, Zap, TrendingUp, Plus, FileText, Crosshair, LayoutDashboard, CandlestickChart, Radar, Rocket, Coins, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { usePanelNav } from "@/hooks/usePanelNav";
import { useMatrixMode } from "@/contexts/MatrixModeContext";
import popshibaLogo from "@/assets/popshiba-logo.png";
import { BRAND } from "@/config/branding";

const LOGO_SRC = popshibaLogo;

const NAV_LINKS: { to: string; label: string; icon: any; exact?: boolean; neonGreen?: boolean; comingSoon?: boolean; disabled?: boolean }[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  
  { to: "/trade", label: "Pulse", icon: Zap },
  { to: "/tokens", label: "Tokens", icon: Coins },
  { to: "/launchpad", label: "Launchpad", icon: Rocket },
  { to: "/discover", label: "Discover", icon: TrendingUp },
  { to: "/alpha-tracker", label: "Alpha", icon: Crosshair },
  { to: "/x-tracker", label: "X Tracker", icon: Radar },
  { to: "/leverage", label: "Leverage", icon: CandlestickChart, comingSoon: true, disabled: true },
  { to: "/whitepaper", label: "Docs", icon: FileText },
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const location = useLocation();
  const { goToPanel } = usePanelNav();
  const isMobile = !!onLinkClick;

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to || location.pathname === "/launch/solana";
    return location.pathname.startsWith(to) && to !== "/";
  };

  return (
    <div className="flex flex-col h-full bg-pop-cream">
      {/* Logo */}
      <div className={cn(
        "flex items-center justify-center border-b-2 border-pop-ink",
        isMobile ? "px-3 pt-5 pb-4" : "py-3"
      )}>
        <Link to="/" onClick={onLinkClick} className="group transition-transform duration-150 hover:-translate-y-[2px]">
          <img
            src={LOGO_SRC}
            alt={BRAND.name}
            className={cn(
              "object-contain flex-shrink-0",
              isMobile ? "h-9 w-9" : "h-8 w-8"
            )}
          />
        </Link>
      </div>

      <nav className={cn("flex-1 flex flex-col items-center gap-0.5 py-2", isMobile && "items-stretch px-2")}>
        {NAV_LINKS.map((navItem) => {
          const { to, label, icon: Icon, exact, neonGreen, comingSoon, disabled } = navItem;
          const active = isActive(to, exact);

          const iconEl = Icon ? (
            <Icon className={cn(
              "h-4 w-4 flex-shrink-0",
              active ? "text-pop-ink" : "text-pop-ink/70"
            )} strokeWidth={active ? 2.75 : 2.25} />
          ) : null;

          if (isMobile) {
            const classes = cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-[12px] font-pop-display uppercase tracking-wider w-full transition-all duration-150",
              disabled
                ? "text-pop-ink/40 cursor-not-allowed"
                : active
                  ? "bg-pop-orange text-pop-ink pop-border"
                  : "text-pop-ink/80 hover:bg-pop-ink/10 border-2 border-transparent"
            );

            const inner = (
              <>
                {iconEl}
                <span>{label}</span>
                {comingSoon && (
                  <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-pop-ink text-pop-cream font-pop-mono">
                    Soon
                  </span>
                )}
              </>
            );

            if (disabled) {
              return (
                <div key={to} className={classes} aria-disabled="true">
                  {inner}
                </div>
              );
            }
            return (
              <Link key={to} to={to} onClick={onLinkClick} className={classes}>
                {inner}
              </Link>
            );
          }

          // Desktop: icon-only with tooltip
          const desktopClasses = cn(
            "relative flex items-center justify-center w-9 h-9 rounded-md transition-all duration-150 group/nav",
            disabled
              ? "text-pop-ink/30 cursor-not-allowed"
              : active
                ? "bg-pop-orange text-pop-ink pop-border"
                : "text-pop-ink/70 hover:bg-pop-ink/10 hover:text-pop-ink border-2 border-transparent"
          );

          const content = (
            <>
              {iconEl}
              {comingSoon && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-pop-ink/60" />
              )}
              <span className="absolute left-full ml-2 px-2 py-1 text-[10px] font-pop-display uppercase bg-pop-ink text-pop-cream rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity z-50">
                {label}{comingSoon ? " · Soon" : ""}
              </span>
            </>
          );

          if (disabled) {
            return (
              <div key={to} className={desktopClasses} aria-disabled="true">
                {content}
              </div>
            );
          }

          return (
            <Link key={to} to={to} className={desktopClasses}>
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Create Token CTA */}
      <div className={cn("space-y-2", isMobile ? "pb-14 px-3" : "pb-20 px-1.5 flex flex-col items-center")}>
        <Link
          to="/launchpad"
          onClick={onLinkClick}
          className={cn(
            "bg-pop-ink text-pop-orange pop-border rounded-md font-pop-display uppercase flex items-center justify-center transition-transform duration-150 hover:-translate-y-[2px]",
            isMobile ? "gap-2 w-full py-2.5 text-[12px]" : "w-9 h-9"
          )}
          title="Create Token"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {isMobile && "Create"}
        </Link>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="p-0 w-[220px] bg-pop-cream border-r-[3px] border-pop-ink">
          <SidebarContent onLinkClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex-shrink-0 bg-pop-cream border-r-[3px] border-pop-ink"
      style={{ width: "48px" }}
    >
      <SidebarContent />
    </aside>
  );
}
