import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FollowersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  initialTab?: "followers" | "following";
}

interface UserItem {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified_type: string | null;
  bio: string | null;
  is_following?: boolean;
}

export function FollowersModal({
  open,
  onOpenChange,
  userId,
  username,
  initialTab = "followers",
}: FollowersModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"followers" | "following">(initialTab);
  const [followers, setFollowers] = useState<UserItem[]>([]);
  const [following, setFollowing] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch followers
        const { data: followersData } = await supabase
          .from("follows")
          .select(`
            follower_id,
            profiles!follows_follower_id_fkey(
              id, username, display_name, avatar_url, verified_type, bio
            )
          `)
          .eq("following_id", userId);

        // Fetch following
        const { data: followingData } = await supabase
          .from("follows")
          .select(`
            following_id,
            profiles!follows_following_id_fkey(
              id, username, display_name, avatar_url, verified_type, bio
            )
          `)
          .eq("follower_id", userId);

        // Get current user's following list to show follow status
        let currentUserFollowing: string[] = [];
        if (user?.id) {
          const { data: myFollowing } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);
          currentUserFollowing = myFollowing?.map((f) => f.following_id) || [];
        }

        const followersList = (followersData || [])
          .map((f: any) => f.profiles)
          .filter(Boolean)
          .map((p: any) => ({
            ...p,
            is_following: currentUserFollowing.includes(p.id),
          }));

        const followingList = (followingData || [])
          .map((f: any) => f.profiles)
          .filter(Boolean)
          .map((p: any) => ({
            ...p,
            is_following: currentUserFollowing.includes(p.id),
          }));

        setFollowers(followersList);
        setFollowing(followingList);
      } catch (error) {
        console.error("Error fetching followers/following:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open, userId, user?.id]);

  const handleFollow = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!user?.id) return;

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
      }

      // Update local state
      const updateList = (list: UserItem[]) =>
        list.map((u) =>
          u.id === targetUserId ? { ...u, is_following: !isCurrentlyFollowing } : u
        );

      setFollowers(updateList);
      setFollowing(updateList);
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border flex flex-row items-center">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full mr-4"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogTitle className="text-xl font-bold">@{username}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full h-14 bg-transparent rounded-none p-0 border-b border-border">
            <TabsTrigger
              value="followers"
              className="flex-1 h-full rounded-none border-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none relative font-semibold text-muted-foreground data-[state=active]:text-foreground"
            >
              Followers
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

          <div className="max-h-[60vh] overflow-y-auto">
            <TabsContent value="followers" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No followers yet
                </div>
              ) : (
                <UserList users={followers} currentUserId={user?.id} onFollow={handleFollow} />
              )}
            </TabsContent>

            <TabsContent value="following" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : following.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Not following anyone
                </div>
              ) : (
                <UserList users={following} currentUserId={user?.id} onFollow={handleFollow} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function UserList({
  users,
  currentUserId,
  onFollow,
}: {
  users: UserItem[];
  currentUserId?: string;
  onFollow: (userId: string, isFollowing: boolean) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {users.map((user) => (
        <div key={user.id} className="px-4 py-3 hover:bg-secondary/50 transition-colors">
          <div className="flex gap-3">
            <Link to={`/user/${user.username}`}>
              <Avatar className="h-10 w-10 bg-primary">
                <AvatarImage src={user.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user.display_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/user/${user.username}`} className="hover:underline">
                <div className="flex items-center gap-1">
                  <span className="font-bold truncate">{user.display_name}</span>
                  {user.verified_type && (
                    <VerifiedBadge type={user.verified_type as "blue" | "gold"} className="h-4 w-4" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
              </Link>
              {user.bio && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{user.bio}</p>
              )}
            </div>
            {currentUserId && currentUserId !== user.id && (
              <Button
                variant={user.is_following ? "outline" : "default"}
                size="sm"
                className="rounded-full font-bold flex-shrink-0"
                onClick={() => onFollow(user.id, !!user.is_following)}
              >
                {user.is_following ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
