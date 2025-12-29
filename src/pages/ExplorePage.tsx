import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/post";
import { useExplore } from "@/hooks/useExplore";


function transformPost(post: any): PostData {
  return {
    id: post.id,
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
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("for-you");
  const { posts, isLoading, fetchTrendingPosts, fetchForYouPosts, searchPosts } =
    useExplore();
  

  // Handle initial search from URL query param
  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam) {
      setSearchQuery(queryParam);
      searchPosts(queryParam);
    } else if (activeTab === "trending") {
      fetchTrendingPosts();
    } else {
      fetchForYouPosts();
    }
  }, [searchParams.get("q")]);

  useEffect(() => {
    if (!searchParams.get("q")) {
      if (activeTab === "trending") {
        fetchTrendingPosts();
      } else {
        fetchForYouPosts();
      }
    }
  }, [activeTab]);

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

  return (
    <MainLayout>
      {/* Search Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search FAUTRA"
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-12 h-12 rounded-full bg-secondary border-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background"
          />
        </form>
      </header>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border justify-start gap-0">
          {["For you", "Trending", "News", "Sports", "Entertainment"].map(
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

        <TabsContent value="entertainment" className="mt-0">
          <div className="py-10 text-center text-muted-foreground">
            <p>Entertainment posts coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
