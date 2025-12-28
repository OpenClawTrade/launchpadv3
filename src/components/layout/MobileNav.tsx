import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bell, Mail, Feather } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, href: "/" },
  { icon: Search, href: "/explore" },
  { icon: Bell, href: "/notifications" },
  { icon: Mail, href: "/messages" },
];

export type MobileNavProps = ComponentPropsWithoutRef<"nav">;

export const MobileNav = forwardRef<HTMLElement, MobileNavProps>(
  ({ className, ...props }, ref) => {
    const location = useLocation();

    return (
      <nav
        ref={ref}
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border md:hidden z-50",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "p-3 rounded-full transition-colors duration-200",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-7 w-7", isActive && "stroke-[2.5px]")} />
              </Link>
            );
          })}
        </div>

        {/* Floating Post Button */}
        <Link
          to="/compose"
          className="absolute -top-20 right-4 h-14 w-14 bg-primary rounded-full shadow-lg flex items-center justify-center hover:bg-fautra-blue-hover transition-colors duration-200 btn-press"
          aria-label="Create a new post"
        >
          <Feather className="h-6 w-6 text-primary-foreground" />
        </Link>
      </nav>
    );
  }
);

MobileNav.displayName = "MobileNav";

