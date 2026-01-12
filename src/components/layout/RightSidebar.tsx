import { Settings, TrendingUp, LogIn, UserPlus, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTrending } from "@/hooks/useTrending";
import { useSuggestedUsers } from "@/hooks/useSuggestedUsers";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { PremiumSubscriptionCard } from "@/components/premium/PremiumSubscriptionCard";
function formatPostCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
  if (count >= 1000) return (count / 1000).toFixed(1) + "K";
  return count.toString();
}

function getCategoryLabel(name: string): string {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("crypto") || lowerName.includes("btc") || lowerName.includes("eth") || lowerName.includes("sol")) {
    return "Crypto · Trending";
  }
  if (lowerName.includes("ai") || lowerName.includes("tech") || lowerName.includes("dev")) {
    return "Technology · Trending";
  }
  if (lowerName.includes("sport") || lowerName.includes("game") || lowerName.includes("nba") || lowerName.includes("nfl")) {
    return "Sports · Trending";
  }
  return "Trending";
}

export function RightSidebar() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { trends, isLoading: trendsLoading } = useTrending(5);
  const { suggestedUsers, isLoading: usersLoading, followUser } = useSuggestedUsers(3);
  const { tokens, isLoadingTokens, tokensError, refetchTokens } = useLaunchpad();

  // Get latest 3 tokens
  const latestTokens = tokens
    ?.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3) || [];

  const handleFollow = async (userId: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    await followUser(userId);
  };

  return (
    <aside className="sticky top-0 h-screen py-4 px-4 w-80 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
      {/* Auth Buttons - Only show when not logged in */}
      {!isAuthenticated && (
        <div className="bg-card rounded-lg p-4 border border-border space-y-2">
          <h2 className="text-base font-semibold mb-3">New to TRENCHES?</h2>
          <Button onClick={login} className="w-full rounded-lg font-semibold text-sm h-9">
            <LogIn className="mr-2 h-4 w-4" />
            Log In
          </Button>
          <Button
            onClick={login}
            variant="outline"
            className="w-full rounded-lg font-semibold text-sm h-9 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Sign Up
          </Button>
        </div>
      )}

      {/* Latest Token Launches */}
      <div className="flex-none bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Latest Launches</h2>
          </div>
        </div>
        <div className="divide-y divide-border">
          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : tokensError ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">Couldn't load tokens</p>
              <p className="text-xs text-muted-foreground mt-1">Check your connection and try again.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetchTokens()}
              >
                Retry
              </Button>
            </div>
          ) : latestTokens.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No tokens yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Be the first to launch a token!
              </p>
            </div>
          ) : (
            latestTokens.map((token) => (
              <Link
                key={token.id}
                to={`/launchpad/${token.mint_address}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors duration-200"
              >
                <Avatar className="h-9 w-9 rounded-lg">
                  <AvatarImage src={token.image_url || undefined} alt={token.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm rounded-lg">
                    {token.ticker?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{token.name}</p>
                  <p className="text-xs text-muted-foreground">${token.ticker?.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-primary">
                    New
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const threshold = token.graduation_threshold_sol || 85;
                      const progress = token.real_sol_reserves > 0 
                        ? (token.real_sol_reserves / threshold) * 100 
                        : 0;
                      return `${progress.toFixed(0)}% bonded`;
                    })()}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
        {latestTokens.length > 0 && (
          <button 
            onClick={() => navigate("/launchpad")}
            className="w-full text-left px-4 py-3 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors duration-200"
          >
            View all tokens
          </button>
        )}
      </div>

      {/* Trends */}
      <div className="flex-none bg-card rounded-lg border border-border overflow-hidden">
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
          {trendsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : trends.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No trends yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Post with #hashtags to start trending!
              </p>
            </div>
          ) : (
            trends.map((trend) => (
              <button
                key={trend.id}
                className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 transition-colors duration-200"
              >
                <p className="text-xs text-muted-foreground">
                  {getCategoryLabel(trend.name)}
                </p>
                <p className="font-semibold text-sm mt-0.5">#{trend.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPostCount(trend.post_count_24h)} posts
                </p>
              </button>
            ))
          )}
        </div>
        {trends.length > 0 && (
          <button 
            onClick={() => navigate("/explore?tab=trending")}
            className="w-full text-left px-4 py-3 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors duration-200"
          >
            Show more
          </button>
        )}
      </div>

      {/* Premium Card */}
      <PremiumSubscriptionCard />

      {/* Who to follow */}
      <div className="flex-none bg-card rounded-lg border border-border overflow-hidden">
        <h2 className="text-base font-semibold p-4 pb-2">Who to follow</h2>
        <div className="divide-y divide-border">
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : suggestedUsers.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No suggestions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                More users will appear as the community grows!
              </p>
            </div>
          ) : (
            suggestedUsers.map((suggestedUser) => (
              <div
                key={suggestedUser.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors duration-200"
              >
                <Link to={`/${suggestedUser.username}`}>
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={suggestedUser.avatar_url || undefined} alt={suggestedUser.display_name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {suggestedUser.display_name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <Link 
                      to={`/${suggestedUser.username}`}
                      className="font-semibold text-sm truncate hover:underline"
                    >
                      {suggestedUser.display_name}
                    </Link>
                    {suggestedUser.verified_type && (
                      <VerifiedBadge type={suggestedUser.verified_type as "blue" | "gold"} />
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs truncate">
                    @{suggestedUser.username}
                  </p>
                </div>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="rounded-lg font-semibold text-xs h-8 px-3 flex-shrink-0"
                  onClick={() => handleFollow(suggestedUser.id)}
                >
                  Follow
                </Button>
              </div>
            ))
          )}
        </div>
        {suggestedUsers.length > 0 && (
          <button 
            onClick={() => navigate("/explore?tab=users")}
            className="w-full text-left px-4 py-3 text-primary text-sm font-medium hover:bg-secondary/50 transition-colors duration-200"
          >
            Show more
          </button>
        )}
      </div>

      {/* Footer links */}
      <div className="text-xs text-muted-foreground px-2 pb-4">
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          <Link to="/terms" className="hover:underline">Terms</Link>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <Link to="/cookies" className="hover:underline">Cookies</Link>
          <Link to="/accessibility" className="hover:underline">Accessibility</Link>
          <span>© 2025 TRENCHES</span>
        </div>
      </div>
    </aside>
  );
}
