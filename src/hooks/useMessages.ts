import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified_type: string | null;
  };
  last_message_preview: string | null;
  last_message_at: string;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  read: boolean;
  created_at: string;
}

export function useMessages() {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          participant_1,
          participant_2,
          last_message_preview,
          last_message_at,
          user1:profiles!conversations_participant_1_fkey(
            id, username, display_name, avatar_url, verified_type
          ),
          user2:profiles!conversations_participant_2_fkey(
            id, username, display_name, avatar_url, verified_type
          )
        `)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("Error fetching conversations:", error);
        return;
      }

      // Get unread counts for each conversation
      const conversationsWithUnread = await Promise.all(
        (data || []).map(async (conv: any) => {
          const otherUser = conv.participant_1 === user.id ? conv.user2 : conv.user1;
          
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .eq("read", false)
            .neq("sender_id", user.id);

          return {
            id: conv.id,
            other_user: otherUser,
            last_message_preview: conv.last_message_preview,
            last_message_at: conv.last_message_at,
            unread_count: count || 0,
          };
        })
      );

      setConversations(conversationsWithUnread);
      setTotalUnread(conversationsWithUnread.reduce((sum, c) => sum + c.unread_count, 0));
    } catch (error) {
      console.error("Error in fetchConversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const getOrCreateConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-write`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "get_or_create_conversation",
            userId: user.id,
            otherUserId,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error("Error creating conversation:", data.error);
        return null;
      }

      // Refetch conversations to include the new one
      await fetchConversations();

      return data.conversationId;
    } catch (error) {
      console.error("Error in getOrCreateConversation:", error);
      return null;
    }
  }, [user?.id, fetchConversations]);

  // Fetch on mount
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchConversations();
    } else {
      setConversations([]);
      setTotalUnread(0);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, fetchConversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        () => {
          // Refetch conversations when they change
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Update unread count if message is not from current user
          if (payload.new.sender_id !== user.id) {
            setTotalUnread((prev) => prev + 1);
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, fetchConversations]);

  return {
    conversations,
    totalUnread,
    isLoading,
    getOrCreateConversation,
    refetch: fetchConversations,
  };
}

export function useConversation(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      setMessages(data || []);

      // Mark messages as read via edge function
      if (user?.id) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-write`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "mark_messages_read",
              userId: user.id,
              conversationId,
            }),
          }
        ).catch((err) => console.error("Error marking messages read:", err));
      }
    } catch (error) {
      console.error("Error in fetchMessages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, user?.id]);

  const sendMessage = useCallback(async (content: string, imageUrl?: string) => {
    if (!conversationId || !user?.id || (!content.trim() && !imageUrl)) return false;

    setIsSending(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/social-write`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "send_message",
            userId: user.id,
            conversationId,
            content: content.trim() || null,
            imageUrl: imageUrl || null,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error("Error sending message:", data.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in sendMessage:", error);
      return false;
    } finally {
      setIsSending(false);
    }
  }, [conversationId, user?.id]);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dm-images")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        return null;
      }

      const { data } = supabase.storage.from("dm-images").getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error("Error in uploadImage:", error);
      return null;
    }
  }, [user?.id]);

  // Fetch messages on mount
  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    } else {
      setMessages([]);
      setIsLoading(false);
    }
  }, [conversationId, fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          // Mark as read if from other user
          if (user?.id && newMessage.sender_id !== user.id) {
            supabase
              .from("messages")
              .update({ read: true })
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id]);

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
    uploadImage,
    refetch: fetchMessages,
  };
}
