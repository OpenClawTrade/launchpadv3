import { forwardRef, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Bell, Mail, Feather, Menu, LogIn, User, Bookmark, Users, Sparkles, Settings, X, Rocket, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/hooks/usePosts";
import { ComposeModal } from "@/components/post/ComposeModal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import trenchesLogo from "@/assets/trenches-logo.png";

const baseNavItems = [
  { icon: Home, href: "/", badgeKey: null },
  { icon: Search, href: "/explore", badgeKey: null },
  { icon: Bell, href: "/notifications", badgeKey: "notifications" as const },
  { icon: Mail, href: "/messages", badgeKey: "messages" as const },
];

const menuItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Rocket, label: "Launchpad", href: "/launchpad" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Mail, label: "Messages", href: "/messages" },
  { icon: Sparkles, label: "Trenches AI", href: "/ai" },
  { icon: Map, label: "Roadmap", href: "/roadmap" },
  { icon: Bookmark, label: "Bookmarks", href: "/bookmarks" },
  { icon: Users, label: "Communities", href: "/communities" },
  { icon: User, label: "Profile", href: "/profile" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export type MobileNavProps = ComponentPropsWithoutRef<"nav">;

interface MobileHeaderProps {
  user?: {
    name: string;
    handle: string;
    avatar?: string;
  } | null;
}

export function MobileHeader({ user }: MobileHeaderProps) {
  const location = useLocation();
  const { isAuthenticated, login, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Hamburger Menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-background">
            <div className="flex flex-col h-full">
              {/* Menu Header */}
              <div className="p-4 border-b border-border">
                {user ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{user.name}</p>
                      <p className="text-muted-foreground text-xs truncate">@{user.handle}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <img src={trenchesLogo} alt="TRENCHES" className="h-8 w-auto" />
                    <span className="font-bold text-lg">TRENCHES</span>
                  </div>
                )}
              </div>

              {/* Menu Items */}
              <nav className="flex-1 p-2 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                        isActive
                          ? "bg-secondary text-primary font-semibold"
                          : "text-foreground hover:bg-secondary"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Menu Footer */}
              {user && (
                <div className="p-4 border-t border-border">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                  >
                    Log out
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Spacer to center the layout */}
        <div className="flex-1" />

        {/* Login Button */}
        {!isAuthenticated ? (
          <Button onClick={login} size="sm" className="h-9">
            <LogIn className="h-4 w-4 mr-2" />
            Log In
          </Button>
        ) : (
          <Link to="/profile">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {user?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}
      </div>
    </header>
  );
}

export const MobileNav = forwardRef<HTMLElement, MobileNavProps>(
  ({ className, ...props }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { notificationCount, messageCount } = useUnreadCounts();
    const { isAuthenticated, login } = useAuth();
    const { createPost } = usePosts({ fetch: false });
    const [composeOpen, setComposeOpen] = useState(false);

    const navItems = baseNavItems.map((item) => ({
      ...item,
      badge: item.badgeKey === "notifications" ? notificationCount : 
             item.badgeKey === "messages" ? messageCount : 0,
    }));

    const handlePost = async (content: string, media?: File[]) => {
      const imageFile = media?.[0];
      await createPost(content, imageFile);
      // If we're on the home page, reload to see the new post
      if (location.pathname === '/') {
        window.location.reload();
      } else {
        // Navigate to home to see the new post
        navigate('/');
      }
    };

    const handleComposeClick = () => {
      if (isAuthenticated) {
        setComposeOpen(true);
      } else {
        login();
      }
    };

    return (
      <>
        <nav
          ref={ref}
          className={cn(
            "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border md:hidden z-50 safe-area-inset-bottom",
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-around h-14 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex-1 flex items-center justify-center p-2 rounded-lg transition-colors duration-200 relative max-w-16",
                    isActive
                      ? "text-primary bg-secondary"
                      : "text-muted-foreground hover:text-foreground active:bg-secondary"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5px]")} />
                  {item.badge > 0 && (
                    <span className="absolute top-1 right-1/4 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Floating Post Button */}
          <button
            onClick={handleComposeClick}
            className="absolute -top-16 right-4 h-14 w-14 bg-primary rounded-full shadow-glow flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all duration-200"
            aria-label="Create a new post"
          >
            <Feather className="h-6 w-6 text-primary-foreground" />
          </button>
        </nav>

        {/* Compose Modal */}
        <ComposeModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          onPost={handlePost}
        />
      </>
    );
  }
);

MobileNav.displayName = "MobileNav";
