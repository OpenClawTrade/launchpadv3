import { MainLayout } from "@/components/layout";
import { Bookmark, Loader2 } from "lucide-react";
import { PostCard, PostData } from "@/components/post";
import { useAuth } from "@/contexts/AuthContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { Button } from "@/components/ui/button";

function transformPost(post: any): PostData {
  return {
    id: post.id,
    shortId: post.short_id,
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

export default function BookmarksPage() {
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { bookmarkedPosts, isLoading, removeBookmark } = useBookmarks();

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <MainLayout>
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">Bookmarks</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Save posts for later</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            Sign in to save posts and easily find them again in the future.
          </p>
          <Button onClick={login} className="rounded-full font-bold">
            Sign In
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Bookmarks</h1>
          <p className="text-sm text-muted-foreground">
            @{user?.twitter?.username || user?.displayName || "you"}
          </p>
        </div>
      </header>

      {/* Loading State */}
      {isLoading || authLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : bookmarkedPosts.length > 0 ? (
        <div className="divide-y divide-border">
          {bookmarkedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={transformPost(post)}
              onBookmark={() => removeBookmark(post.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Save posts for later</h2>
          <p className="text-muted-foreground max-w-sm">
            Bookmark posts to easily find them again in the future.
          </p>
        </div>
      )}
    </MainLayout>
  );
}
