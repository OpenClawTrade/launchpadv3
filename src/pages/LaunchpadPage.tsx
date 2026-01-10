import { MainLayout } from "@/components/layout";
import { TokenCard, WalletBalanceCard } from "@/components/launchpad";
import { useLaunchpad } from "@/hooks/useLaunchpad";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Search, Clock, Sparkles, Zap, GraduationCap, Flame } from "lucide-react";
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

  // Stats
  const totalTokens = tokens.length;
  const bondingTokens = tokens.filter(t => t.status === 'bonding').length;
  const graduatedTokens = tokens.filter(t => t.status === 'graduated').length;
  const totalVolume = tokens.reduce((acc, t) => acc + t.volume_24h_sol, 0);

  return (
    <MainLayout user={currentUser}>
      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-accent/10">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
        </div>

        <div className="relative px-4 pt-6 pb-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Launchpad</h1>
                <p className="text-sm text-muted-foreground">Discover & trade new tokens</p>
              </div>
            </div>
            <Link to="/launch">
              <Button size="default" className="gap-2 shadow-lg glow-yellow">
                <Sparkles className="h-4 w-4" />
                Launch Token
              </Button>
            </Link>
          </div>

          {/* Wallet Balance Card */}
          <WalletBalanceCard className="mb-4" />

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-foreground">{totalTokens}</p>
              <p className="text-xs text-muted-foreground">Total Tokens</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary">{bondingTokens}</p>
              <p className="text-xs text-muted-foreground">Bonding</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-500">{graduatedTokens}</p>
              <p className="text-xs text-muted-foreground">Graduated</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-foreground">{totalVolume.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">24h Vol (SOL)</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ticker, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-12 bg-transparent rounded-none p-0 border-0 grid grid-cols-4 gap-0">
            <TabsTrigger 
              value="all" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-sm transition-all"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              New
            </TabsTrigger>
            <TabsTrigger 
              value="trending" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-sm transition-all"
            >
              <Flame className="h-4 w-4 mr-1.5" />
              Hot
            </TabsTrigger>
            <TabsTrigger 
              value="bonding" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-sm transition-all"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Bonding
            </TabsTrigger>
            <TabsTrigger 
              value="graduated" 
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary font-medium text-sm transition-all"
            >
              <GraduationCap className="h-4 w-4 mr-1.5" />
              Live
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Token List */}
      <div className="p-4 space-y-3">
        {/* Results count */}
        {!isLoadingTokens && filteredTokens.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>{filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''}</span>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {isLoadingTokens ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 border border-border rounded-xl bg-card space-y-3 animate-pulse">
              <div className="flex gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full max-w-xs" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))
        ) : filteredTokens.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Rocket className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold">No tokens found</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {searchQuery 
                ? "Try adjusting your search query or filters" 
                : "Be the first to launch a token on TRENCHES!"}
            </p>
            <Link to="/launch">
              <Button className="gap-2 mt-2">
                <Sparkles className="h-4 w-4" />
                Launch Token
              </Button>
            </Link>
          </div>
        ) : (
          filteredTokens.map((token, index) => (
            <div 
              key={token.id} 
              className="animate-fadeIn" 
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <TokenCard token={token} />
            </div>
          ))
        )}
      </div>
    </MainLayout>
  );
}
