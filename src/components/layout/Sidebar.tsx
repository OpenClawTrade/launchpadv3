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
  { to: "/trending", label: "Trending", icon: TrendingUp },
  { to: "/trade", label: "Terminal", icon: BarChart2 },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/sdk", label: "SDK", icon: Code2 },
  { to: "/tokenomics", label: "Tokenomics", icon: PieChart },
  { to: "/whitepaper", label: "Whitepaper", icon: FileText },
  { to: "/panel?tab=nfas", label: "NFA", icon: Fingerprint, useClaw: true },
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
      <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-white/5">
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-white/50" />
          <span className="text-[12px] font-medium text-white/60">Matrix</span>
        </div>
        <Switch
          checked={matrixEnabled}
          onCheckedChange={toggleMatrix}
          className="h-4 w-8 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=unchecked]:translate-x-0"
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
    <div className="flex flex-col h-full" style={{ background: "#1a1a1a" }}>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4">
        <Link to="/" onClick={onLinkClick} className="flex items-center gap-2">
          <div className="h-7 w-7 rounded" style={{ WebkitMaskImage: `url(${LOGO_SRC})`, maskImage: `url(${LOGO_SRC})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', backgroundColor: '#4ade80' }} />
          <div className="flex flex-col">
            <span className="text-[13px] font-bold font-mono leading-tight" style={{ color: "#4ade80" }}>CLAW</span>
            <span className="text-[11px] font-mono text-white/50 leading-tight">MODE</span>
          </div>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_LINKS.map(({ to, label, icon: Icon, exact, useClaw }) => {
          const active = isActive(to, exact);
          const classes = cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-100 w-full",
            active
              ? "text-white bg-white/10 border-l-2"
              : "text-white/50 hover:text-white/80 hover:bg-white/5 border-l-2 border-transparent"
          );
          const style = active ? { borderLeftColor: "#4ade80" } : {};
          const iconEl = useClaw ? (
            <div className="h-4 w-4 flex-shrink-0" style={{ WebkitMaskImage: `url(${LOGO_SRC})`, maskImage: `url(${LOGO_SRC})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center', backgroundColor: 'currentColor' }} />
          ) : Icon ? (
            <Icon className="h-4 w-4 flex-shrink-0" />
          ) : null;

          if (useClaw) {
            return (
              <button
                key={to}
                onClick={() => { onLinkClick?.(); goToPanel(to); }}
                className={classes}
                style={style}
              >
                {iconEl}
                <span>{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              onClick={onLinkClick}
              className={classes}
              style={style}
            >
              {iconEl}
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Matrix Mode Toggle (desktop only, injected via prop) */}
      {onLinkClick === undefined && <MatrixToggle />}

      {/* Create Token CTA */}
      <div className="px-3 pb-14 space-y-3">
        <Link
          to="/?create=1"
          onClick={onLinkClick}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-[13px] font-bold text-black transition-opacity hover:opacity-90"
          style={{ background: "#4ade80" }}
        >
          <Plus className="h-4 w-4" />
          Create Token
        </Link>
        <div className="text-center text-[10px] text-white/20 font-mono">
          clawmode.io
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
        <SheetContent side="left" className="p-0 w-[200px] border-r-0" style={{ background: "#1a1a1a", borderRight: "1px solid #2a2a2a" }}>
          <SidebarContent onLinkClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex-shrink-0"
      style={{
        width: "160px",
        background: "#1a1a1a",
        borderRight: "1px solid #2a2a2a",
      }}
    >
      <SidebarContent />
    </aside>
  );
}
