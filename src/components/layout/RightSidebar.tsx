import { Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";

interface TrendItem {
  category: string;
  topic: string;
  posts: string;
}

const trends: TrendItem[] = [
  { category: "Technology · Trending", topic: "Solana", posts: "45.2K" },
  { category: "Crypto · Trending", topic: "#Web3", posts: "28.1K" },
  { category: "Business · Trending", topic: "AI Revolution", posts: "156K" },
  { category: "Sports · Trending", topic: "World Cup", posts: "89.3K" },
  { category: "Entertainment", topic: "New Movie Release", posts: "34.7K" },
];

interface SuggestedUser {
  name: string;
  handle: string;
  avatar?: string;
  verified?: "blue" | "gold";
}

const suggestedUsers: SuggestedUser[] = [
  { name: "FAUTRA Official", handle: "fautra", verified: "gold" },
  { name: "Solana", handle: "solana", verified: "blue" },
  { name: "Crypto News", handle: "cryptonews", verified: "blue" },
];

export function RightSidebar() {
  return (
    <aside className="sticky top-0 h-screen py-2 px-4 w-80 lg:w-88 hidden lg:flex flex-col gap-4 overflow-y-auto scrollbar-thin">
      {/* Search */}
      <div className="sticky top-0 bg-background pt-1 pb-3 z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search FAUTRA"
            className="pl-12 h-12 rounded-full bg-secondary border-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Premium Card */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <h2 className="text-xl font-bold mb-2">Subscribe to Premium</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Get verified, unlock exclusive features, and boost your presence on FAUTRA.
        </p>
        <Button className="rounded-full font-bold">
          Subscribe
        </Button>
      </div>

      {/* Trends */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-xl font-bold">Trends for you</h2>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <div className="divide-y divide-border">
          {trends.map((trend, index) => (
            <button
              key={index}
              className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors duration-200"
            >
              <p className="text-xs text-muted-foreground">{trend.category}</p>
              <p className="font-bold mt-0.5">{trend.topic}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{trend.posts} posts</p>
            </button>
          ))}
        </div>
        <button className="w-full text-left px-4 py-4 text-primary hover:bg-secondary/50 transition-colors duration-200">
          Show more
        </button>
      </div>

      {/* Who to follow */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <h2 className="text-xl font-bold p-4">Who to follow</h2>
        <div className="divide-y divide-border">
          {suggestedUsers.map((user, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors duration-200"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm truncate">{user.name}</span>
                  {user.verified && <VerifiedBadge type={user.verified} />}
                </div>
                <p className="text-muted-foreground text-sm truncate">@{user.handle}</p>
              </div>
              <Button variant="default" size="sm" className="rounded-full font-bold">
                Follow
              </Button>
            </div>
          ))}
        </div>
        <button className="w-full text-left px-4 py-4 text-primary hover:bg-secondary/50 transition-colors duration-200">
          Show more
        </button>
      </div>

      {/* Footer links */}
      <div className="text-xs text-muted-foreground px-4 pb-4">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <a href="#" className="hover:underline">Terms of Service</a>
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Cookie Policy</a>
          <a href="#" className="hover:underline">Accessibility</a>
          <a href="#" className="hover:underline">Ads info</a>
          <span>© 2025 FAUTRA</span>
        </div>
      </div>
    </aside>
  );
}
