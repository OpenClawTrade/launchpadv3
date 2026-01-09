import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BlockedMutedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface BlockedMutedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: "blocked" | "muted";
}

export function BlockedMutedModal({ open, onOpenChange, initialTab = "blocked" }: BlockedMutedModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<BlockedMutedUser[]>([]);
  const [mutedUsers, setMutedUsers] = useState<BlockedMutedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user?.id) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Fetch blocked users
        const { data: blockedData } = await supabase
          .from("user_blocks")
          .select("blocked_user_id")
          .eq("user_id", user.id);

        // Fetch muted users
        const { data: mutedData } = await supabase
          .from("user_mutes")
          .select("muted_user_id")
          .eq("user_id", user.id);

        const blockedIds = blockedData?.map(b => b.blocked_user_id) || [];
        const mutedIds = mutedData?.map(m => m.muted_user_id) || [];

        // Fetch profiles for blocked users
        if (blockedIds.length > 0) {
          const { data: blockedProfiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", blockedIds);
          setBlockedUsers(blockedProfiles || []);
        } else {
          setBlockedUsers([]);
        }

        // Fetch profiles for muted users
        if (mutedIds.length > 0) {
          const { data: mutedProfiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", mutedIds);
          setMutedUsers(mutedProfiles || []);
        } else {
          setMutedUsers([]);
        }
      } catch (error) {
        console.error("Error fetching blocked/muted users:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [open, user?.id]);

  const handleUnblock = async (userId: string) => {
    if (!user?.id) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("user_id", user.id)
        .eq("blocked_user_id", userId);

      if (error) throw error;
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User unblocked");
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast.error("Failed to unblock user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnmute = async (userId: string) => {
    if (!user?.id) return;
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("user_mutes")
        .delete()
        .eq("user_id", user.id)
        .eq("muted_user_id", userId);

      if (error) throw error;
      setMutedUsers(prev => prev.filter(u => u.id !== userId));
      toast.success("User unmuted");
    } catch (error) {
      console.error("Error unmuting user:", error);
      toast.error("Failed to unmute user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserClick = (username: string) => {
    onOpenChange(false);
    navigate(`/${username}`);
  };

  const renderUserList = (users: BlockedMutedUser[], onAction: (id: string) => void, actionLabel: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <p className="text-center py-8 text-muted-foreground">
          No {actionLabel === "Unblock" ? "blocked" : "muted"} accounts
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-colors"
          >
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => handleUserClick(u.username)}
            >
              <Avatar className="h-10 w-10 bg-primary">
                <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {u.display_name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold hover:underline">{u.display_name}</p>
                <p className="text-sm text-muted-foreground">@{u.username}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction(u.id)}
              disabled={actionLoading === u.id}
            >
              {actionLoading === u.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                actionLabel
              )}
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Blocked & Muted Accounts</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={initialTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="blocked">
              Blocked ({blockedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="muted">
              Muted ({mutedUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocked" className="mt-4 max-h-80 overflow-y-auto">
            {renderUserList(blockedUsers, handleUnblock, "Unblock")}
          </TabsContent>

          <TabsContent value="muted" className="mt-4 max-h-80 overflow-y-auto">
            {renderUserList(mutedUsers, handleUnmute, "Unmute")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
