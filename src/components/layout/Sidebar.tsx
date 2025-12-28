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
  Feather
} from "lucide-react";
import { cn } from "@/lib/utils";
import fautraLogo from "@/assets/fautra-logo.png";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Bell, label: "Notifications", href: "/notifications", badge: 3 },
  { icon: Mail, label: "Messages", href: "/messages" },
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
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className="sticky top-0 h-screen flex flex-col justify-between py-2 px-2 xl:px-4 w-20 xl:w-72 border-r border-border">
      {/* Logo */}
      <div className="flex flex-col">
        <Link 
          to="/" 
          className="p-3 rounded-full hover:bg-primary/10 transition-colors duration-200 w-fit"
        >
          <img 
            src={fautraLogo} 
            alt="FAUTRA" 
            className="h-8 w-8 object-contain"
          />
        </Link>

        {/* Navigation */}
        <nav className="mt-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-full transition-all duration-200 group relative",
                  isActive 
                    ? "font-bold" 
                    : "font-normal hover:bg-secondary"
                )}
              >
                <div className="relative">
                  <Icon 
                    className={cn(
                      "h-7 w-7 transition-transform group-hover:scale-105",
                      isActive && "stroke-[2.5px]"
                    )} 
                  />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-xl hidden xl:block",
                  isActive && "font-bold"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          
          {/* More Options */}
          <button
            className="flex items-center gap-4 px-4 py-3 rounded-full transition-colors duration-200 hover:bg-secondary w-full"
          >
            <MoreHorizontal className="h-7 w-7" />
            <span className="text-xl hidden xl:block">More</span>
          </button>
        </nav>

        {/* Post Button */}
        <Button 
          variant="default" 
          size="lg"
          className="mt-4 rounded-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 btn-press hidden xl:flex"
        >
          <Feather className="mr-2 h-5 w-5" />
          Post
        </Button>
        
        {/* Mobile Post Button */}
        <Button 
          variant="default" 
          size="icon"
          className="mt-4 rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all duration-200 btn-press xl:hidden mx-auto"
        >
          <Feather className="h-6 w-6" />
        </Button>
      </div>

      {/* User Profile */}
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 p-3 rounded-full hover:bg-secondary transition-colors duration-200 w-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden xl:block text-left flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user.name}</p>
                <p className="text-muted-foreground text-sm truncate">@{user.handle}</p>
              </div>
              <MoreHorizontal className="h-5 w-5 hidden xl:block text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onLogout}
              className="text-destructive focus:text-destructive"
            >
              Log out @{user.handle}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link to="/auth">
          <Button variant="outline" className="rounded-full w-full">
            Sign In
          </Button>
        </Link>
      )}
    </aside>
  );
}
