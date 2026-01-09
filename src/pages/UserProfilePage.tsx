import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, Link as LinkIcon, Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout";
import { PostCard, PostData } from "@/components/post";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { useProfile, Profile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { usePosts } from "@/hooks/usePosts";
import { FollowersModal } from "@/components/profile/FollowersModal";
import { format } from "date-fns";

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
    isReposted: post.is_reposted,
  };
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { toggleLike, toggleBookmark, deletePost } = usePosts();
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());
  const {
    profile,
    posts,
    replies,
    mediaPosts,
    likedPosts,
    isLoading,
    isOwnProfile,
    isFollowing,
    error,
    toggleFollow,
  } = useProfile(username);

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    toggleLike(postId);
  };

  const handleBookmark = (postId: string) => {
    if (!isAuthenticated) {
      login();
      return;
    }
    toggleBookmark(postId);
  };

  const handleDelete = (postId: string) => {
    deletePost(postId);
    setDeletedPostIds(prev => new Set(prev).add(postId));
  };

  // Filter out deleted posts
  const visiblePosts = posts.filter(p => !deletedPostIds.has(p.id));
  const visibleReplies = replies.filter(p => !deletedPostIds.has(p.id));
  const visibleMediaPosts = mediaPosts.filter(p => !deletedPostIds.has(p.id));
  const visibleLikedPosts = likedPosts.filter(p => !deletedPostIds.has(p.id));

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !profile) {
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
            <h1 className="text-xl font-bold">Profile</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h2 className="text-2xl font-bold mb-2">User not found</h2>
          <p className="text-muted-foreground">
            The user @{username} doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </MainLayout>
    );
  }

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
          <div>
            <h1 className="text-xl font-bold flex items-center gap-1">
              {profile.display_name}
              {profile.verified_type && (
                <VerifiedBadge type={profile.verified_type as "blue" | "gold"} />
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {visiblePosts.length} posts
            </p>
          </div>
        </div>
      </header>

      {/* Banner */}
      <div className="h-32 md:h-48 bg-gradient-to-r from-primary/20 to-primary/40 relative">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="flex justify-between items-end -mt-16 mb-4">
          <Avatar className="h-32 w-32 border-4 border-background bg-primary">
            <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
              {profile.display_name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          {!isOwnProfile && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              className="rounded-full font-bold"
              onClick={toggleFollow}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          )}

          {isOwnProfile && (
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() => navigate("/profile")}
            >
              Edit Profile
            </Button>
          )}
        </div>

        {/* Name & Handle */}
        <div className="mb-3">
          <h2 className="text-xl font-bold flex items-center gap-1">
            {profile.display_name}
            {profile.verified_type && (
              <VerifiedBadge type={profile.verified_type as "blue" | "gold"} />
            )}
          </h2>
          <p className="text-muted-foreground">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && <p className="mb-3 whitespace-pre-wrap">{profile.bio}</p>}

        {/* Meta Info */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm mb-3">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={
                profile.website.startsWith("http")
                  ? profile.website
                  : `https://${profile.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <LinkIcon className="h-4 w-4" />
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Joined {format(new Date(profile.created_at), "MMMM yyyy")}
          </span>
        </div>

        {/* Follow Stats */}
        <div className="flex gap-4 text-sm">
          <button 
            className="hover:underline"
            onClick={() => {
              setFollowersModalTab("following");
              setShowFollowersModal(true);
            }}
          >
            <span className="font-bold">{profile.following_count || 0}</span>{" "}
            <span className="text-muted-foreground">Following</span>
          </button>
          <button 
            className="hover:underline"
            onClick={() => {
              setFollowersModalTab("followers");
              setShowFollowersModal(true);
            }}
          >
            <span className="font-bold">{profile.followers_count || 0}</span>{" "}
            <span className="text-muted-foreground">Followers</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-auto p-0">
          <TabsTrigger
            value="posts"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 font-semibold"
          >
            Posts
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 font-semibold"
          >
            Replies
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 font-semibold"
          >
            Media
          </TabsTrigger>
          <TabsTrigger
            value="likes"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 font-semibold"
          >
            Likes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          {visiblePosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold">No posts yet</p>
              <p className="text-muted-foreground">
                When {isOwnProfile ? "you post" : `@${profile.username} posts`},
                they'll show up here.
              </p>
            </div>
          ) : (
            visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={transformPost(post)}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onDelete={isOwnProfile ? handleDelete : undefined}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          {visibleReplies.length > 0 ? (
            visibleReplies.map((reply) => (
              <PostCard
                key={reply.id}
                post={transformPost(reply)}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onDelete={isOwnProfile ? handleDelete : undefined}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold">No replies yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          {visibleMediaPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5">
              {visibleMediaPosts.map((post) => (
                <a
                  key={post.id}
                  href={`/post/${post.short_id || post.id}`}
                  className="aspect-square overflow-hidden bg-secondary hover:opacity-90 transition-opacity"
                >
                  <img
                    src={post.image_url || ""}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold">No media yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="likes" className="mt-0">
          {visibleLikedPosts.length > 0 ? (
            visibleLikedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={transformPost(post)}
                onLike={handleLike}
                onBookmark={handleBookmark}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold">No likes yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Followers/Following Modal */}
      {profile && (
        <FollowersModal
          open={showFollowersModal}
          onOpenChange={setShowFollowersModal}
          userId={profile.id}
          username={profile.username}
          initialTab={followersModalTab}
        />
      )}
    </MainLayout>
  );
}
