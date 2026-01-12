import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard, PostData } from "@/components/post";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { FollowersModal } from "@/components/profile/FollowersModal";

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

export default function ProfilePage() {
  const { username } = useParams<{ username?: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());
  const { deletePost } = usePosts({ fetch: false });

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
    updateProfile,
    toggleFollow,
  } = useProfile(username);

  const handleDelete = (postId: string) => {
    deletePost(postId);
    setDeletedPostIds(prev => new Set(prev).add(postId));
  };

  // Filter out deleted posts
  const visiblePosts = posts.filter(p => !deletedPostIds.has(p.id));
  const visibleReplies = replies.filter(p => !deletedPostIds.has(p.id));
  const visibleMediaPosts = mediaPosts.filter(p => !deletedPostIds.has(p.id));
  const visibleLikedPosts = likedPosts.filter(p => !deletedPostIds.has(p.id));

  // Don't auto-trigger login - let user click the button so they can dismiss the modal

  // Show loading while checking auth
  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // Not logged in and no username provided
  if (!isAuthenticated && !username) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Sign in to view your profile</h2>
          <p className="text-muted-foreground mb-6">
            Connect your wallet or sign in to access your profile.
          </p>
          <Button onClick={login} className="rounded-full font-bold">
            Sign In
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !profile) {
    return (
      <MainLayout>
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-6 px-4 h-14">
            <Link
              to="/"
              className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold">Profile</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <h2 className="text-2xl font-bold mb-2">Profile not found</h2>
          <p className="text-muted-foreground">
            This account doesn't exist. Try searching for another.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-6 px-4 h-14">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
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
      <div className="h-48 bg-gradient-to-br from-primary/30 to-primary/10 relative">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 relative">
        {/* Avatar */}
        <div className="absolute -top-16 left-4">
          <Avatar className="h-32 w-32 border-4 border-background bg-primary">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
              {profile.display_name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-border"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
          {isOwnProfile ? (
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() => setShowEditModal(true)}
            >
              Edit profile
            </Button>
          ) : isAuthenticated ? (
            <Button
              variant={isFollowing ? "outline" : "default"}
              className="rounded-full font-bold"
              onClick={toggleFollow}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          ) : (
            <Button
              variant="default"
              className="rounded-full font-bold"
              onClick={login}
            >
              Follow
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="mt-16">
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold">{profile.display_name}</h2>
            {profile.verified_type && (
              <VerifiedBadge type={profile.verified_type as "blue" | "gold"} />
            )}
          </div>
          <p className="text-muted-foreground">@{profile.username}</p>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-3 whitespace-pre-wrap">{profile.bio}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-muted-foreground">
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
                className="flex items-center gap-1 text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkIcon className="h-4 w-4" />
                {profile.website}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Joined {format(new Date(profile.created_at), "MMMM yyyy")}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-3">
            <button 
              className="hover:underline"
              onClick={() => {
                setFollowersModalTab("following");
                setShowFollowersModal(true);
              }}
            >
              <span className="font-bold">
                {(profile.following_count || 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground"> Following</span>
            </button>
            <button 
              className="hover:underline"
              onClick={() => {
                setFollowersModalTab("followers");
                setShowFollowersModal(true);
              }}
            >
              <span className="font-bold">
                {(profile.followers_count || 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground"> Followers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border justify-start">
          {["Posts", "Replies", "Media", "Likes"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="flex-1 h-full max-w-32 rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          {visiblePosts.length > 0 ? (
            visiblePosts.map((post) => (
              <PostCard 
                key={post.id} 
                post={transformPost(post)} 
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No posts yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          {visibleReplies.length > 0 ? (
            visibleReplies.map((post) => (
              <PostCard 
                key={post.id} 
                post={transformPost(post)} 
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No replies yet</p>
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
            <div className="py-10 text-center text-muted-foreground">
              <p>No media yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="likes" className="mt-0">
          {visibleLikedPosts.length > 0 ? (
            visibleLikedPosts.map((post) => (
              <PostCard key={post.id} post={transformPost(post)} />
            ))
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <p>No likes yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Profile Modal */}
      {isOwnProfile && profile && (
        <EditProfileModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          profile={profile}
          onSave={updateProfile}
        />
      )}

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
