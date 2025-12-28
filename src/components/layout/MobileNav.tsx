import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bell, Mail, Feather } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

const baseNavItems = [
  { icon: Home, href: "/", badgeKey: null },
  { icon: Search, href: "/explore", badgeKey: null },
  { icon: Bell, href: "/notifications", badgeKey: "notifications" as const },
  { icon: Mail, href: "/messages", badgeKey: "messages" as const },
];

export type MobileNavProps = ComponentPropsWithoutRef<"nav">;

export const MobileNav = forwardRef<HTMLElement, MobileNavProps>(
  ({ className, ...props }, ref) => {
    const location = useLocation();
    const { notificationCount, messageCount } = useUnreadCounts();

    const navItems = baseNavItems.map((item) => ({
      ...item,
      badge: item.badgeKey === "notifications" ? notificationCount : 
             item.badgeKey === "messages" ? messageCount : 0,
    }));

    return (
      <nav
        ref={ref}
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border md:hidden z-50",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-around h-14">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "p-2.5 rounded-lg transition-colors duration-200 relative",
                  isActive
                    ? "text-primary bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-6 w-6", isActive && "stroke-[2px]")} />
                {item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Floating Post Button */}
        <Link
          to="/compose"
          className="absolute -top-16 right-4 h-12 w-12 bg-primary rounded-lg shadow-glow flex items-center justify-center hover:bg-primary/90 transition-all duration-200 btn-press"
          aria-label="Create a new post"
        >
          <Feather className="h-5 w-5 text-primary-foreground" />
        </Link>
      </nav>
    );
  }
);

MobileNav.displayName = "MobileNav";
