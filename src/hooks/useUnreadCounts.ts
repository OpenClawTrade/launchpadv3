import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadCounts() {
  const { user, isAuthenticated } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotificationCount(0);
      setMessageCount(0);
      return;
    }

    const fetchCounts = async () => {
      // Fetch unread notifications count
      const { count: notifCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      setNotificationCount(notifCount || 0);

      // Fetch unread messages count
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map((c) => c.id);
        const { count: msgCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", conversationIds)
          .eq("read", false)
          .neq("sender_id", user.id);

        setMessageCount(msgCount || 0);
      }
    };

    fetchCounts();

    // Subscribe to realtime updates
    const notifChannel = supabase
      .channel("unread-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    const msgChannel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [isAuthenticated, user?.id]);

  return { notificationCount, messageCount };
}
