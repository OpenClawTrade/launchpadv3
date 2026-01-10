import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  UserPlus,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import trenchesLogo from "@/assets/trenches-logo-optimized.png";
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
import { ComposeModal } from "@/components/post/ComposeModal";
import { usePosts } from "@/hooks/usePosts";
import { useAdmin } from "@/hooks/useAdmin";

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
  { icon: Sparkles, label: "Trenches AI", href: "/ai" },
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
  const navigate = useNavigate();
  const { logout, isAuthenticated, login } = useAuth();
  const { notificationCount, messageCount } = useUnreadCounts();
  const { createPost } = usePosts({ fetch: false });
  const { isAdmin } = useAdmin();
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navItems = baseNavItems.map((item) => ({
    ...item,
    badge: item.badgeKey === "notifications" ? notificationCount : 
           item.badgeKey === "messages" ? messageCount : undefined,
  }));

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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

  return (
    <>
      <aside className="sticky top-0 h-screen flex flex-col py-4 px-3 xl:px-4 w-20 xl:w-64 bg-sidebar">
        {/* Logo */}
        <div className="flex flex-col">
          <Link 
            to="/" 
            className="flex justify-center rounded-lg hover:bg-secondary transition-colors duration-200 mb-2"
          >
            <img 
              src={trenchesLogo} 
              alt="TRENCHES" 
              className="h-16 w-auto xl:h-20"
            />
          </Link>

          {/* Mobile Auth Button - Only show on mobile since desktop has right sidebar */}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
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
                  <div className="relative flex-shrink-0">
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
                    "text-sm hidden xl:block truncate",
                    isActive && "font-semibold"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            
            {/* More Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative text-foreground hover:bg-secondary w-full"
                >
                  <MoreHorizontal className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm hidden xl:block">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56 bg-popover border border-border">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings and Support
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/bookmarks" className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    Bookmarks
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a 
                    href="https://help.trenches.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    Help Center
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Display
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Keyboard shortcuts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Settings */}
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                location.pathname === "/settings"
                  ? "bg-secondary text-primary font-semibold" 
                  : "text-foreground hover:bg-secondary"
              )}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm hidden xl:block">Settings</span>
            </Link>

            {/* Admin Panel - Only visible to admins */}
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  location.pathname === "/admin"
                    ? "bg-destructive/10 text-destructive font-semibold" 
                    : "text-destructive hover:bg-destructive/10"
                )}
              >
                <Shield className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm hidden xl:block">Admin</span>
              </Link>
            )}
          </nav>

          {/* Post Button */}
          <Button 
            variant="default" 
            size="lg"
            onClick={() => isAuthenticated ? setComposeOpen(true) : login()}
            className="mt-4 rounded-lg h-11 text-sm font-semibold shadow-glow hover:shadow-lg transition-all duration-200 btn-press hidden xl:flex"
          >
            <Feather className="mr-2 h-4 w-4" />
            Post
          </Button>
          
          {/* Mobile Post Button */}
          <Button 
            variant="default" 
            size="icon"
            onClick={() => isAuthenticated ? setComposeOpen(true) : login()}
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
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden xl:block text-left flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user.name}</p>
                  <p className="text-muted-foreground text-xs truncate">@{user.handle}</p>
                </div>
                <MoreHorizontal className="h-4 w-4 hidden xl:block text-muted-foreground flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
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

      {/* Compose Modal */}
      <ComposeModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onPost={handlePost}
      />
    </>
  );
}
