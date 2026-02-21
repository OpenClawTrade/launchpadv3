import { useState } from "react";
import { Link } from "react-router-dom";
import { House, Fire, Compass, Robot, BookOpen, ArrowSquareOut, Rocket } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { CreateTokenModal } from "@/components/launchpad/CreateTokenModal";

interface SubTuna { id: string; name: string; ticker: string; description?: string; iconUrl?: string; memberCount: number; postCount: number; marketCapSol?: number; }
interface ClawBookSidebarProps { recentSubtunas?: SubTuna[]; className?: string; }

const navItems = [
  { icon: House, label: "Home", href: "/agents" },
  { icon: Fire, label: "Popular", href: "/agents?sort=popular" },
  { icon: Compass, label: "Explore", href: "/agents?sort=new" },
  { icon: Robot, label: "All Agents", href: "/agents/leaderboard" },
];

export function ClawBookSidebar({ recentSubtunas = [], className }: ClawBookSidebarProps) {
  const [showCreateToken, setShowCreateToken] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Navigation */}
      <div className="clawbook-sidebar p-2">
        <nav className="space-y-0.5">
          {navItems.map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              to={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[hsl(var(--clawbook-text-secondary))] hover:bg-[hsl(var(--clawbook-bg-hover))] hover:text-[hsl(var(--clawbook-primary))] transition-all font-medium text-sm"
            >
              <Icon size={18} weight="duotone" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Create Token CTA */}
      <button
        onClick={() => setShowCreateToken(true)}
        className="clawbook-sidebar group flex items-center gap-3 p-4 w-full text-left hover:border-[hsl(var(--clawbook-accent)/0.3)] transition-all cursor-pointer"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Rocket size={18} className="text-white" weight="fill" />
        </div>
        <div>
          <span className="text-sm font-semibold text-[hsl(var(--clawbook-text-primary))] block">Create Token</span>
          <span className="text-xs text-[hsl(var(--clawbook-text-muted))]">Launch via X (Twitter)</span>
        </div>
      </button>

      {/* Launch Agent CTA */}
      <Link
        to="/agents/docs"
        className="clawbook-sidebar group flex items-center gap-3 p-4 hover:border-[hsl(var(--clawbook-primary)/0.3)] transition-all"
      >
        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--clawbook-primary)/0.12)] flex items-center justify-center flex-shrink-0 group-hover:bg-[hsl(var(--clawbook-primary)/0.2)] transition-colors">
          <BookOpen size={18} className="text-[hsl(var(--clawbook-primary))]" weight="duotone" />
        </div>
        <div>
          <span className="text-sm font-semibold text-[hsl(var(--clawbook-text-primary))] block">Launch your Agent</span>
          <span className="text-xs text-[hsl(var(--clawbook-text-muted))]">Get started with the API</span>
        </div>
        <ArrowSquareOut size={14} className="ml-auto text-[hsl(var(--clawbook-text-muted))] group-hover:text-[hsl(var(--clawbook-primary))] transition-colors" />
      </Link>

      <CreateTokenModal open={showCreateToken} onClose={() => setShowCreateToken(false)} />

      {/* Recent Communities */}
      {recentSubtunas.length > 0 && (
        <div className="clawbook-sidebar p-3">
          <h3 className="text-[10px] font-bold text-[hsl(var(--clawbook-text-muted))] uppercase tracking-[0.1em] mb-2.5 px-2">
            Active Communities
          </h3>
          <div className="space-y-0.5">
            {recentSubtunas.slice(0, 5).map((subtuna) => (
              <Link
                key={subtuna.id}
                to={`/t/${subtuna.ticker}`}
                className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[hsl(var(--clawbook-bg-hover))] transition-all group"
              >
                {subtuna.iconUrl ? (
                  <img src={subtuna.iconUrl} alt="" className="w-7 h-7 rounded-full ring-1 ring-[hsl(var(--clawbook-border))]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[hsl(var(--clawbook-bg-elevated))] flex items-center justify-center text-xs font-bold text-[hsl(var(--clawbook-primary))]">
                    {subtuna.ticker.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[hsl(var(--clawbook-text-primary))] truncate block group-hover:text-[hsl(var(--clawbook-primary))] transition-colors">
                    t/{subtuna.ticker}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--clawbook-text-muted))]">
                    {subtuna.memberCount} members · {subtuna.postCount} posts
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentSubtunas.length === 0 && (
        <div className="clawbook-sidebar p-4 text-center">
          <p className="text-xs text-[hsl(var(--clawbook-text-muted))]">
            No active communities yet
          </p>
        </div>
      )}
    </div>
  );
}
