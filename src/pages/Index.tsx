import { MainLayout } from "@/components/layout";
import { PostCard, ComposePost } from "@/components/post";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts, PostWithProfile } from "@/hooks/usePosts";
import { useState } from "react";
import { PostData } from "@/components/post";
import { PostSkeletonList } from "@/components/ui/post-skeleton";

// Transform database post to PostData format
function transformPost(post: PostWithProfile): PostData {
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
    media: post.image_url ? [{ type: "image" as const, url: post.image_url }] : undefined,
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
    isReposted: post.is_reposted,
  };
}

const Index = () => {
  const { user, isAuthenticated } = useAuth();
  const { posts, isLoading, createPost, toggleLike, toggleBookmark, toggleRepost, deletePost, quotePost, refetch } = usePosts();
  const [activeTab, setActiveTab] = useState("for-you");
  
  // Build current user object from auth context
  const currentUser = user ? {
    name: user.displayName ?? user.wallet?.address?.slice(0, 8) ?? "Anonymous",
    handle: user.twitter?.username ?? user.wallet?.address?.slice(0, 12) ?? "user",
    avatar: user.avatarUrl,
  } : null;

  const handlePost = async (content: string, media?: File[]) => {
    const imageFile = media?.[0];
    const result = await createPost(content, imageFile);
    // The post should appear immediately since createPost adds it to state
    // But if it doesn't, refetch
    if (!result) {
      await refetch();
    }
  };

  const handleLike = (id: string) => {
    toggleLike(id);
  };

  const handleBookmark = (id: string) => {
    toggleBookmark(id);
  };

  const handleRepost = (id: string) => {
    toggleRepost(id);
  };

  const handleDelete = (id: string) => {
    deletePost(id);
  };

  const handleQuote = async (id: string, content: string, imageFile?: File) => {
    await quotePost(id, content, imageFile);
  };

  return (
    <MainLayout user={currentUser}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="text-lg font-semibold">Home</h1>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-0">
            <TabsTrigger 
              value="for-you" 
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              For you
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 bg-primary rounded-full opacity-0 data-[state=active]:opacity-100 transition-opacity" />
            </TabsTrigger>
            <TabsTrigger 
              value="following" 
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              Following
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-16 bg-primary rounded-full opacity-0 data-[state=active]:opacity-100 transition-opacity" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Compose Post */}
      {currentUser && <ComposePost user={currentUser} onPost={handlePost} />}

      {/* Posts Feed */}
      <div className="divide-y divide-border">
        {isLoading ? (
          <PostSkeletonList count={5} />
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-sm">Be the first to post something!</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div 
              key={post.id} 
              style={{ animationDelay: `${index * 50}ms` }}
              className="animate-fadeIn"
            >
              <PostCard 
                post={transformPost(post)} 
                onLike={handleLike}
                onBookmark={handleBookmark}
                onRepost={handleRepost}
                onDelete={handleDelete}
                onQuote={handleQuote}
              />
            </div>
          ))
        )}
      </div>
    </MainLayout>
  );
};

export default Index;
