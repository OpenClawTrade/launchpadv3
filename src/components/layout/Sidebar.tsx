import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  Bookmark, 
  Users, 
  User, 
  Settings,
  Sparkles,
  MoreHorizontal,
  Feather,
  LogIn,
  UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import fautraLogo from "@/assets/fautra-logo.png";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badgeKey?: "notifications" | "messages";
}

const baseNavItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Bell, label: "Notifications", href: "/notifications", badgeKey: "notifications" },
  { icon: Mail, label: "Messages", href: "/messages", badgeKey: "messages" },
  { icon: Sparkles, label: "Fautra AI", href: "/ai" },
  { icon: Bookmark, label: "Bookmarks", href: "/bookmarks" },
  { icon: Users, label: "Communities", href: "/communities" },
  { icon: User, label: "Profile", href: "/profile" },
];

interface SidebarProps {
  user?: {
    name: string;
    handle: string;
    avatar?: string;
  } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const location = useLocation();
  const { logout, isAuthenticated, login } = useAuth();
  const { notificationCount, messageCount } = useUnreadCounts();

  const navItems = baseNavItems.map((item) => ({
    ...item,
    badge: item.badgeKey === "notifications" ? notificationCount : 
           item.badgeKey === "messages" ? messageCount : undefined,
  }));
  return (
    <aside className="sticky top-0 h-screen flex flex-col py-4 px-3 xl:px-4 w-20 xl:w-72 border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex flex-col">
        <Link 
          to="/" 
          className="p-2 rounded-lg hover:bg-secondary transition-colors duration-200 w-fit mb-4"
        >
          <img 
            src={fautraLogo} 
            alt="FAUTRA" 
            className="h-8 w-8 object-contain"
          />
        </Link>

        {/* Auth Buttons - Above Search */}
        {!isAuthenticated && (
          <div className="mb-4 space-y-2 hidden xl:block">
            <Button 
              onClick={login}
              variant="default" 
              className="w-full rounded-lg font-semibold h-10"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Log In
            </Button>
            <Button 
              onClick={login}
              variant="outline" 
              className="w-full rounded-lg font-semibold h-10 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Register
            </Button>
          </div>
        )}

        {/* Mobile Auth Button */}
        {!isAuthenticated && (
          <div className="mb-4 xl:hidden flex justify-center">
            <Button 
              onClick={login}
              variant="default" 
              size="icon"
              className="rounded-lg h-10 w-10"
            >
              <LogIn className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Search - Desktop Only */}
        <div className="relative mb-4 hidden xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="pl-10 h-10 rounded-lg bg-secondary border-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background text-sm"
          />
        </div>

        {/* Mobile Search Icon */}
        <div className="mb-4 xl:hidden flex justify-center">
          <Link to="/explore">
            <Button variant="ghost" size="icon" className="rounded-lg h-10 w-10">
              <Search className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive 
                    ? "bg-secondary text-primary font-semibold" 
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <div className="relative">
                  <Icon 
                    className={cn(
                      "h-5 w-5 transition-transform group-hover:scale-105",
                      isActive && "text-primary"
                    )} 
                  />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-sm hidden xl:block",
                  isActive && "font-semibold"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {/* More Options */}
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 hover:bg-secondary w-full text-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-sm hidden xl:block">More</span>
          </button>
        </nav>

        {/* Post Button */}
        <Button 
          variant="default" 
          size="lg"
          className="mt-4 rounded-lg h-11 text-sm font-semibold shadow-glow hover:shadow-lg transition-all duration-200 btn-press hidden xl:flex"
        >
          <Feather className="mr-2 h-4 w-4" />
          Post
        </Button>
        
        {/* Mobile Post Button */}
        <Button 
          variant="default" 
          size="icon"
          className="mt-4 rounded-lg h-11 w-11 shadow-glow hover:shadow-lg transition-all duration-200 btn-press xl:hidden mx-auto"
        >
          <Feather className="h-5 w-5" />
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User Profile */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors duration-200 w-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block text-left flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user.name}</p>
                <p className="text-muted-foreground text-xs truncate">@{user.handle}</p>
              </div>
              <MoreHorizontal className="h-4 w-4 hidden xl:block text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => logout()}
              className="text-destructive focus:text-destructive"
            >
              Log out @{user.handle}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </aside>
  );
}
