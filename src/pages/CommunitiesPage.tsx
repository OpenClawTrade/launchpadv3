import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout";
import { Users, Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useCommunities, Community } from "@/hooks/useCommunities";
import { CreateCommunityModal } from "@/components/community/CreateCommunityModal";

export default function CommunitiesPage() {
  const { isAuthenticated, login } = useAuth();
  const {
    communities,
    isLoading,
    createCommunity,
    joinCommunity,
    leaveCommunity,
    searchCommunities,
  } = useCommunities();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Community[] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await searchCommunities(query);
      setSearchResults(results);
    } else {
      setSearchResults(null);
    }
  };

  const handleJoinLeave = (community: Community) => {
    if (!isAuthenticated) {
      login();
      return;
    }

    if (community.is_member) {
      leaveCommunity(community.id);
    } else {
      joinCommunity(community.id);
    }
  };

  const displayCommunities = searchResults ?? communities;

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <h1 className="text-xl font-bold">Communities</h1>
          {isAuthenticated && (
            <Button
              size="icon"
              className="rounded-full"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Communities"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-10 rounded-full bg-secondary border-0 text-sm"
            />
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : displayCommunities.length > 0 ? (
        <div className="divide-y divide-border">
          {displayCommunities.map((community) => (
            <div
              key={community.id}
              className="w-full text-left px-4 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex gap-3">
                <Avatar className="h-14 w-14 rounded-xl">
                  <AvatarImage src={community.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground rounded-xl text-lg">
                    {community.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold">{community.name}</h3>
                  {community.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {community.description}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {community.members_count.toLocaleString()} members
                  </p>
                </div>
                <Button
                  variant={community.is_member ? "outline" : "default"}
                  size="sm"
                  className="rounded-full font-bold flex-shrink-0"
                  onClick={() => handleJoinLeave(community)}
                >
                  {community.is_member ? "Joined" : "Join"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : searchQuery ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">No results found</h2>
          <p className="text-muted-foreground max-w-sm">
            Try searching for something else
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Discover Communities</h2>
          <p className="text-muted-foreground max-w-sm">
            Join communities to connect with people who share your interests.
          </p>
          {isAuthenticated ? (
            <Button
              className="mt-6 rounded-full font-bold"
              onClick={() => setShowCreateModal(true)}
            >
              Create a Community
            </Button>
          ) : (
            <Button className="mt-6 rounded-full font-bold" onClick={login}>
              Sign in to Create
            </Button>
          )}
        </div>
      )}

      {/* Create Community Modal */}
      <CreateCommunityModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreate={createCommunity}
      />
    </MainLayout>
  );
}
