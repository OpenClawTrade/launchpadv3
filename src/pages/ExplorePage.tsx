import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/post";
import { useExplore } from "@/hooks/useExplore";
import { useSuggestedUsers } from "@/hooks/useSuggestedUsers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { useAuth } from "@/contexts/AuthContext";


function transformPost(post: any): PostData {
  return {
    id: post.id,
    shortId: post.short_id,
    authorId: post.user_id,
    author: {
      name: post.profiles?.display_name || "Unknown",
      handle: post.profiles?.username || "unknown",
      avatar: post.profiles?.avatar_url || undefined,
      verified: post.profiles?.verified_type as "blue" | "gold" | undefined,
    },
    content: post.content,
    media: post.image_url
      ? [{ type: "image" as const, url: post.image_url }]
      : undefined,
    createdAt: new Date(post.created_at),
    stats: {
      likes: post.likes_count || 0,
      reposts: post.reposts_count || 0,
      replies: post.replies_count || 0,
      views: post.views_count || 0,
      bookmarks: 0,
    },
    isLiked: post.is_liked,
    isBookmarked: post.is_bookmarked,
  };
}

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialTab = searchParams.get("tab") || "for-you";
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const { posts, isLoading, fetchTrendingPosts, fetchForYouPosts, searchPosts } =
    useExplore();
  const { suggestedUsers, isLoading: usersLoading, followUser } = useSuggestedUsers(20);
  const { isAuthenticated, login } = useAuth();
  

  // Handle URL tab param
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handle initial search from URL query param
  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam) {
      setSearchQuery(queryParam);
      searchPosts(queryParam);
    } else if (activeTab === "trending") {
      fetchTrendingPosts();
    } else if (activeTab !== "users") {
      fetchForYouPosts();
    }
  }, [searchParams.get("q")]);

  useEffect(() => {
    if (!searchParams.get("q") && activeTab !== "users") {
      if (activeTab === "trending") {
        fetchTrendingPosts();
      } else {
        fetchForYouPosts();
      }
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "users") {
      setSearchParams({ tab: "users" });
    } else if (tab === "trending") {
      setSearchParams({ tab: "trending" });
    } else {
      setSearchParams({});
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim() });
      searchPosts(searchQuery);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!e.target.value.trim()) {
      setSearchParams({});
      if (activeTab === "trending") {
        fetchTrendingPosts();
      } else {
        fetchForYouPosts();
      }
    }
  };

  const handleFollow = async (userId: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    await followUser(userId);
  };

  return (
    <MainLayout>
      {/* Search Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search TRENCHES"
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-12 h-12 rounded-full bg-secondary border-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background"
          />
        </form>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border justify-start gap-0">
          {["For you", "Trending", "Users", "News", "Sports"].map(
            (tab) => (
              <TabsTrigger
                key={tab}
                value={tab.toLowerCase().replace(" ", "-")}
                className="h-full rounded-none border-0 px-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
              >
                {tab}
              </TabsTrigger>
            )
          )}
        </TabsList>

        <TabsContent value="for-you" className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={transformPost(post)} />
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No posts found. Be the first to post!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trending" className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <PostCard key={post.id} post={transformPost(post)} />
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No trending posts yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          {usersLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : suggestedUsers.length > 0 ? (
            <div className="divide-y divide-border">
              {suggestedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors duration-200"
                >
                  <Link to={`/${user.username}`}>
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.display_name} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.display_name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <Link 
                        to={`/${user.username}`}
                        className="font-semibold truncate hover:underline"
                      >
                        {user.display_name}
                      </Link>
                      {user.verified_type && (
                        <VerifiedBadge type={user.verified_type as "blue" | "gold"} />
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm truncate">
                      @{user.username}
                    </p>
                    {user.bio && (
                      <p className="text-sm text-foreground mt-1 line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="rounded-full font-semibold px-4 flex-shrink-0"
                    onClick={() => handleFollow(user.id)}
                  >
                    Follow
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No users to suggest yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="news" className="mt-0">
          <div className="py-10 text-center text-muted-foreground">
            <p>News posts coming soon</p>
          </div>
        </TabsContent>

        <TabsContent value="sports" className="mt-0">
          <div className="py-10 text-center text-muted-foreground">
            <p>Sports posts coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
