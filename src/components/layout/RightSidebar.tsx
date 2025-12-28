import { Settings, TrendingUp } from "lucide-react";
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
    <aside className="sticky top-0 h-screen py-4 px-4 w-80 lg:w-88 hidden lg:flex flex-col gap-4 overflow-y-auto scrollbar-thin">
      {/* Premium Card */}
      <div className="bg-card rounded-lg p-4 border border-border">
        <h2 className="text-base font-semibold mb-2">Subscribe to Premium</h2>
        <p className="text-muted-foreground text-sm mb-3">
          Get verified, unlock exclusive features, and boost your presence.
        </p>
        <Button className="rounded-lg font-semibold text-sm h-9">
          Subscribe
        </Button>
      </div>

      {/* Trends */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Trending</h2>
          </div>
          <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <div className="divide-y divide-border">
          {trends.map((trend, index) => (
            <button
              key={index}
              className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 transition-colors duration-200"
            >
              <p className="text-xs text-muted-foreground">{trend.category}</p>
              <p className="font-semibold text-sm mt-0.5">{trend.topic}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{trend.posts} posts</p>
            </button>
          ))}
        </div>
        <button className="w-full text-left px-4 py-3 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors duration-200">
          Show more
        </button>
      </div>

      {/* Who to follow */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <h2 className="text-base font-semibold p-4 pb-2">Who to follow</h2>
        <div className="divide-y divide-border">
          {suggestedUsers.map((user, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors duration-200"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-sm truncate">{user.name}</span>
                  {user.verified && <VerifiedBadge type={user.verified} />}
                </div>
                <p className="text-muted-foreground text-xs truncate">@{user.handle}</p>
              </div>
              <Button variant="default" size="sm" className="rounded-lg font-semibold text-xs h-8 px-3">
                Follow
              </Button>
            </div>
          ))}
        </div>
        <button className="w-full text-left px-4 py-3 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors duration-200">
          Show more
        </button>
      </div>

      {/* Footer links */}
      <div className="text-xs text-muted-foreground px-2 pb-4">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <a href="#" className="hover:underline">Terms</a>
          <a href="#" className="hover:underline">Privacy</a>
          <a href="#" className="hover:underline">Cookies</a>
          <a href="#" className="hover:underline">Accessibility</a>
          <span>© 2025 FAUTRA</span>
        </div>
      </div>
    </aside>
  );
}
