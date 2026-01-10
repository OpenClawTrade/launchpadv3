import { MainLayout } from "@/components/layout";
import { TokenCard } from "@/components/launchpad";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Search, TrendingUp, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";

export default function LaunchpadPage() {
  const { user } = useAuth();
  const { tokens, isLoadingTokens } = useLaunchpad();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const currentUser = user ? {
    name: user.displayName ?? user.wallet?.address?.slice(0, 8) ?? "Anonymous",
    handle: user.twitter?.username ?? user.wallet?.address?.slice(0, 12) ?? "user",
    avatar: user.avatarUrl,
  } : null;

  // Filter tokens based on search and tab
  const filteredTokens = useMemo(() => {
    let result = tokens;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.ticker.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    // Tab filter
    switch (activeTab) {
      case "bonding":
        result = result.filter(t => t.status === 'bonding');
        break;
      case "graduated":
        result = result.filter(t => t.status === 'graduated');
        break;
      case "trending":
        result = [...result].sort((a, b) => b.volume_24h_sol - a.volume_24h_sol);
        break;
      default:
        // all - sort by newest
        result = [...result].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return result;
  }, [tokens, searchQuery, activeTab]);

  return (
    <MainLayout user={currentUser}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Launchpad</h1>
          </div>
          <Link to="/launch">
            <Button size="sm" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Launch Token
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-12 bg-transparent rounded-none p-0 border-0 grid grid-cols-4">
            <TabsTrigger 
              value="all" 
              className="h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-medium text-sm"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              All
            </TabsTrigger>
            <TabsTrigger 
              value="trending" 
              className="h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-medium text-sm"
            >
              <TrendingUp className="h-4 w-4 mr-1.5" />
              Trending
            </TabsTrigger>
            <TabsTrigger 
              value="bonding" 
              className="h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-medium text-sm"
            >
              ⚡ Bonding
            </TabsTrigger>
            <TabsTrigger 
              value="graduated" 
              className="h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-medium text-sm"
            >
              🎓 Graduated
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Token List */}
      <div className="p-4 space-y-3">
        {isLoadingTokens ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-lg space-y-3">
              <div className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="text-6xl">🚀</div>
            <h3 className="text-xl font-bold">No tokens found</h3>
            <p className="text-muted-foreground">
              {searchQuery 
                ? "Try adjusting your search query" 
                : "Be the first to launch a token!"}
            </p>
            <Link to="/launch">
              <Button>Launch Token</Button>
            </Link>
          </div>
        ) : (
          filteredTokens.map((token) => (
            <TokenCard key={token.id} token={token} />
          ))
        )}
      </div>
    </MainLayout>
  );
}
