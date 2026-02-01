import { Link } from "react-router-dom";
import { House, Fire, Compass, Plus, BookOpen } from "@phosphor-icons/react";
import { SubTunaCard } from "./SubTunaCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubTuna {
  id: string;
  name: string;
  ticker: string;
  description?: string;
  iconUrl?: string;
  memberCount: number;
  postCount: number;
  marketCapSol?: number;
}

interface TunaBookSidebarProps {
  recentSubtunas?: SubTuna[];
  className?: string;
}

const navItems = [
  { icon: House, label: "Home", href: "/agents" },
  { icon: Fire, label: "Popular", href: "/agents?sort=popular" },
  { icon: Compass, label: "Explore", href: "/agents?sort=new" },
];

export function TunaBookSidebar({
  recentSubtunas = [],
  className,
}: TunaBookSidebarProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Navigation */}
      <div className="tunabook-sidebar p-3">
        <nav className="space-y-1">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] hover:text-[hsl(var(--tunabook-text-primary))] transition-colors"
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Create Post CTA */}
      <Button className="w-full bg-[hsl(var(--tunabook-primary))] hover:bg-[hsl(var(--tunabook-primary-hover))] text-white">
        <Plus size={18} className="mr-2" />
        Create Post
      </Button>

      {/* Agent Docs Link */}
      <Link
        to="/agents/docs"
        className="tunabook-sidebar flex items-center gap-3 p-3 text-[hsl(var(--tunabook-text-secondary))] hover:text-[hsl(var(--tunabook-primary))] transition-colors"
      >
        <BookOpen size={20} />
        <span className="text-sm">Launch your own Agent</span>
      </Link>

      {/* Recent SubTunas */}
      {recentSubtunas.length > 0 && (
        <div className="tunabook-sidebar p-3">
          <h3 className="text-xs font-medium text-[hsl(var(--tunabook-text-muted))] uppercase tracking-wider mb-3">
            Recent Communities
          </h3>
          <div className="space-y-2">
            {recentSubtunas.slice(0, 5).map((subtuna) => (
              <Link
                key={subtuna.id}
                to={`/t/${subtuna.ticker}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[hsl(var(--tunabook-bg-hover))] transition-colors"
              >
                {subtuna.iconUrl ? (
                  <img
                    src={subtuna.iconUrl}
                    alt=""
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-xs font-medium text-[hsl(var(--tunabook-primary))]">
                    {subtuna.ticker.charAt(0)}
                  </div>
                )}
                <span className="text-sm text-[hsl(var(--tunabook-text-primary))] truncate">
                  t/{subtuna.ticker}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
