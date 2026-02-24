import { Link, useLocation } from "react-router-dom";
import { Home, BarChart2, Bot, Code2, TrendingUp, Plus, PieChart, FileText, Fingerprint, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { usePanelNav } from "@/hooks/usePanelNav";
import { useMatrixMode } from "@/contexts/MatrixModeContext";
import clawLogo from "@/assets/claw-logo.png";

const LOGO_SRC = clawLogo;

const NAV_LINKS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/console", label: "Console", icon: Code2, isLive: true },
  { to: "/trade", label: "Terminal", icon: BarChart2 },
  { to: "/agents", label: "Agents", icon: Bot },
  
  { to: "/panel?tab=nfas", label: "NFA", icon: Fingerprint, useClaw: true },
  { to: "/sdk", label: "SDK", icon: Code2 },
  { to: "/tokenomics", label: "Tokenomics", icon: PieChart },
  { to: "/whitepaper", label: "Whitepaper", icon: FileText },
  { to: "/panel", label: "Panel", icon: null, useClaw: true },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function MatrixToggle() {
  const { matrixEnabled, toggleMatrix } = useMatrixMode();
  return (
    <div className="px-3 pb-2">
      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-surface-hover/50">
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-muted-foreground">Matrix</span>
        </div>
        <Switch
          checked={matrixEnabled}
          onCheckedChange={toggleMatrix}
          className="h-4 w-8 data-[state=checked]:bg-success data-[state=unchecked]:bg-muted [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=unchecked]:translate-x-0"
        />
      </div>
    </div>
  );
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const location = useLocation();
  const { goToPanel } = usePanelNav();

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to || location.pathname === "/launch/solana";
    return location.pathname.startsWith(to) && to !== "/";
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="px-3 pt-5 pb-4 md:px-4 md:pt-6 md:pb-5 border-b border-border/30">
        <Link to="/" onClick={onLinkClick} className="flex items-center gap-2.5 md:gap-3 group transition-all duration-300">
          <img
            src={LOGO_SRC}
            alt="Claw Mode"
            className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 object-contain rounded-lg flex-shrink-0 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
          />
          <div className="flex flex-col">
            <span className="text-base md:text-lg lg:text-xl font-extrabold font-mono leading-tight text-success tracking-[-0.02em] transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">
              CLAW
            </span>
            <span className="text-[10px] md:text-xs font-mono text-muted-foreground leading-tight tracking-widest">
              MODE
            </span>
          </div>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2.5 space-y-0.5">
        {NAV_LINKS.map((navItem) => {
          const { to, label, icon: Icon, exact, useClaw } = navItem;
          const active = isActive(to, exact);
          const classes = cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 w-full border-l-2",
            active
              ? "text-foreground bg-surface-hover border-success"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/50 border-transparent"
          );
          const iconEl = useClaw ? (
            <img src={LOGO_SRC} alt="" className="h-4 w-4 rounded-sm object-contain flex-shrink-0" />
          ) : Icon ? (
            <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", active && "text-success")} />
          ) : null;

          if (useClaw) {
            return (
              <button
                key={to}
                onClick={() => { onLinkClick?.(); goToPanel(to); }}
                className={classes}
              >
                {iconEl}
                <span>{label}</span>
                {label === "NFA" && (
                  <span className="relative flex h-2 w-2 ml-auto">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                  </span>
                )}
              </button>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              onClick={onLinkClick}
              className={classes}
            >
              {iconEl}
              <span>{label}</span>
              {(navItem as any).isLive && (
                <span className="ml-auto text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
                  Live
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Matrix Mode Toggle (desktop only) */}
      {onLinkClick === undefined && <MatrixToggle />}

      {/* Create Token CTA */}
      <div className="px-3 pb-14 space-y-3">
        <Link
          to="/?create=1"
          onClick={onLinkClick}
          className="btn-gradient-green flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-bold"
        >
          <Plus className="h-4 w-4" />
          Create Token
        </Link>
        <div className="text-center text-[10px] text-muted-foreground/40 font-mono">
          clawsai.fun
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="p-0 w-[200px] border-r-0 bg-sidebar" style={{ borderRight: "1px solid hsl(var(--border))" }}>
          <SidebarContent onLinkClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex-shrink-0 bg-sidebar/80 backdrop-blur-md border-r border-border"
      style={{ width: "160px" }}
    >
      <SidebarContent />
    </aside>
  );
}
