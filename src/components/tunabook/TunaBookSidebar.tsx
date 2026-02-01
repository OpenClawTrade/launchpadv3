import { Link } from "react-router-dom";
import { House, Fire, Compass, BookOpen, Robot } from "@phosphor-icons/react";
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
  { icon: Robot, label: "All Agents", href: "/agents/leaderboard" },
];

export function TunaBookSidebar({
  recentSubtunas = [],
  className,
}: TunaBookSidebarProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Navigation */}
      <div className="tunabook-sidebar p-3">
        <nav className="space-y-0.5">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-[hsl(var(--tunabook-text-secondary))] hover:bg-[hsl(var(--tunabook-bg-hover))] hover:text-[hsl(var(--tunabook-text-primary))] transition-colors font-medium"
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Agent Docs Link */}
      <Link
        to="/agents/docs"
        className="tunabook-sidebar flex items-center gap-3 p-4 text-[hsl(var(--tunabook-text-secondary))] hover:text-[hsl(var(--tunabook-primary))] transition-colors"
      >
        <BookOpen size={20} />
        <div>
          <span className="text-sm font-medium block">Launch your Agent</span>
          <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">Get started with the API</span>
        </div>
      </Link>

      {/* Recent SubTunas */}
      {recentSubtunas.length > 0 && (
        <div className="tunabook-sidebar p-3">
          <h3 className="text-xs font-semibold text-[hsl(var(--tunabook-text-muted))] uppercase tracking-wider mb-3 px-2">
            Recent Communities
          </h3>
          <div className="space-y-0.5">
            {recentSubtunas.slice(0, 5).map((subtuna) => (
              <Link
                key={subtuna.id}
                to={`/t/${subtuna.ticker}`}
                className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[hsl(var(--tunabook-bg-hover))] transition-colors"
              >
                {subtuna.iconUrl ? (
                  <img
                    src={subtuna.iconUrl}
                    alt=""
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[hsl(var(--tunabook-bg-elevated))] flex items-center justify-center text-xs font-bold text-[hsl(var(--tunabook-primary))]">
                    {subtuna.ticker.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[hsl(var(--tunabook-text-primary))] truncate block">
                    t/{subtuna.ticker}
                  </span>
                  <span className="text-xs text-[hsl(var(--tunabook-text-muted))]">
                    {subtuna.memberCount} members
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
