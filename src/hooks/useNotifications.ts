import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  type: "like" | "repost" | "follow" | "mention" | "reply" | "token_launch";
  actor: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified_type: string | null;
  };
  post_id: string | null;
  content: string | null;
  read: boolean;
  created_at: string;
  metadata?: {
    mint_address?: string;
    token_name?: string;
    token_ticker?: string;
  } | null;
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          id,
          type,
          post_id,
          content,
          read,
          created_at,
          metadata,
          actor:profiles!notifications_actor_id_fkey(
            id,
            username,
            display_name,
            avatar_url,
            verified_type
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      const formattedNotifications: Notification[] = (data || []).map((n: any) => ({
        id: n.id,
        type: n.type as Notification["type"],
        actor: n.actor,
        post_id: n.post_id,
        content: n.content,
        read: n.read,
        created_at: n.created_at,
        metadata: n.metadata,
      }));

      setNotifications(formattedNotifications);
      setUnreadCount(formattedNotifications.filter((n) => !n.read).length);
    } catch (error) {
      console.error("Error in fetchNotifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (notificationId?: string) => {
    if (!user?.id) return;

    try {
      if (notificationId) {
        // Mark single notification as read
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notificationId)
          .eq("user_id", user.id);

        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        // Mark all as read
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .eq("read", false);

        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }, [user?.id]);

  // Fetch notifications on mount
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("New notification received:", payload);
          
          // Fetch the complete notification with actor info
          const { data } = await supabase
            .from("notifications")
            .select(`
              id,
              type,
              post_id,
              content,
              read,
              created_at,
              actor:profiles!notifications_actor_id_fkey(
                id,
                username,
                display_name,
                avatar_url,
                verified_type
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            const newNotification: Notification = {
              id: data.id,
              type: data.type as Notification["type"],
              actor: data.actor as any,
              post_id: data.post_id,
              content: data.content,
              read: data.read,
              created_at: data.created_at,
              metadata: (data as any).metadata,
            };

            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refetch: fetchNotifications,
  };
}
