import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout";
import { PostCard, PostData, ComposePost } from "@/components/post";
import { Button } from "@/components/ui/button";
import { usePost, usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

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
    isReposted: post.is_reposted,
  };
}

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuth();
  const { post, replies, isLoading, refetch } = usePost(postId || null);
  const { toggleLike, toggleBookmark, toggleRepost, createPost } = usePosts();
  const [isReplying, setIsReplying] = useState(false);

  const handleLike = (id: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    toggleLike(id);
  };

  const handleBookmark = (id: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    toggleBookmark(id);
  };

  const handleRepost = (id: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    toggleRepost(id);
  };

  const handleReply = async (content: string) => {
    if (!postId) return;
    setIsReplying(true);
    try {
      await createPost(content, undefined, postId);
      refetch();
    } finally {
      setIsReplying(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!post) {
    return (
      <MainLayout>
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-4 px-4 h-14">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Post</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h2 className="text-2xl font-bold mb-2">Post not found</h2>
          <p className="text-muted-foreground">
            This post doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </MainLayout>
    );
  }

  const currentUser = user
    ? {
        name: user.displayName || user.email?.split("@")[0] || "User",
        handle: user.email?.split("@")[0] || "user",
        avatar: user.avatarUrl,
      }
    : null;

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4 px-4 h-14">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>
      </header>

      {/* Main Post */}
      <PostCard
        post={transformPost(post)}
        onLike={handleLike}
        onBookmark={handleBookmark}
        onRepost={handleRepost}
      />

      {/* Reply Composer */}
      {isAuthenticated && currentUser && (
        <div className="border-b border-border">
          <ComposePost
            user={currentUser}
            onPost={handleReply}
            placeholder={`Reply to @${post.profiles?.username || "user"}...`}
          />
        </div>
      )}

      {/* Replies Section */}
      <div>
        {replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-semibold">No replies yet</p>
            <p className="text-muted-foreground">
              Be the first to reply to this post!
            </p>
          </div>
        ) : (
          replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={transformPost(reply)}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onRepost={handleRepost}
            />
          ))
        )}
      </div>
    </MainLayout>
  );
}